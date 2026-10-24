"""Durable local voting prototype. Trusted callers only; not an anonymous election system."""
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import hmac
import json
import re
import sqlite3
import uuid


@dataclass(frozen=True)
class Result:
    accepted: bool
    code: str
    event_id: str


def valid_id(value):
    return isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}", value) is not None


class VoteCountingAgent:
    """Every public operation uses its own connection; writes serialize in SQLite.

    Keep the same private key across restarts. No caller-supplied ID is authenticated
    by this class. Do not expose administrative or voting methods directly as an API.
    """

    def __init__(self, database, key):
        if not isinstance(key, bytes) or len(key) < 32:
            raise ValueError("key must contain at least 32 secret bytes")
        if str(database) == ':memory:':
            raise ValueError("Use a persistent database file")
        self.database = str(database)
        self._key = key
        with self._transaction() as db:
            db.execute("CREATE TABLE IF NOT EXISTS metadata (name TEXT PRIMARY KEY, value TEXT NOT NULL)")
            fingerprint = self._digest('key-check', 'v2')
            stored = db.execute("SELECT value FROM metadata WHERE name='key_check'").fetchone()
            if stored and not hmac.compare_digest(stored[0], fingerprint):
                raise ValueError("Database key does not match; use the original key")
            db.execute("INSERT OR IGNORE INTO metadata VALUES ('key_check', ?)", (fingerprint,))
            for statement in SCHEMA:
                db.execute(statement)

    @contextmanager
    def _transaction(self):
        db = sqlite3.connect(self.database, timeout=30, isolation_level=None)
        try:
            db.execute('PRAGMA foreign_keys=ON')
            db.execute('PRAGMA synchronous=FULL')
            db.execute('BEGIN IMMEDIATE')
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def _digest(self, *parts):
        payload = json.dumps(parts, ensure_ascii=True, separators=(',', ':')).encode()
        return hmac.new(self._key, payload, hashlib.sha256).hexdigest()

    def create_election(self, election_id, candidates, eligible_voters):
        """Trusted administrator: create an OPEN election with a fixed roster."""
        if not valid_id(election_id):
            raise ValueError('Invalid election ID')
        groups = []
        for values in (candidates, eligible_voters):
            if not isinstance(values, (list, tuple)) or not values:
                raise ValueError('Provide non-empty candidate and voter lists')
            if not all(valid_id(v) for v in values) or len(set(values)) != len(values):
                raise ValueError('IDs must be valid and unique')
            groups.append(tuple(values))
        with self._transaction() as db:
            db.execute("INSERT INTO elections VALUES (?, 'OPEN')", (election_id,))
            db.executemany('INSERT INTO candidates VALUES (?, ?)', [(election_id, c) for c in groups[0]])
            db.executemany('INSERT INTO eligible VALUES (?, ?)',
                           [(election_id, self._digest('voter', election_id, v)) for v in groups[1]])

    def close_election(self, election_id):
        if not valid_id(election_id):
            raise ValueError('Invalid election ID')
        with self._transaction() as db:
            if db.execute("UPDATE elections SET state='CLOSED' WHERE id=?", (election_id,)).rowcount != 1:
                raise ValueError('Unknown election')

    def cast_vote(self, election_id, authenticated_voter, candidate_id, request_id):
        """A trusted adapter must authenticate the voter before calling this method.

        Valid-shaped rejected requests are idempotent too: correcting a payload or
        retrying after a policy change requires a NEW request_id. Storage failures
        raise an exception (never a false success); retry with the SAME request_id.
        """
        with self._transaction() as db:
            if not all(valid_id(x) for x in (election_id, authenticated_voter, candidate_id, request_id)):
                return self._audit(db, None, None, 'INVALID_INPUT')
            voter = self._digest('voter', election_id, authenticated_voter)
            request = self._digest('request', election_id, voter, request_id)
            payload = self._digest('payload', election_id, voter, candidate_id)
            previous = db.execute('SELECT payload, code, event_id FROM requests WHERE request_key=?', (request,)).fetchone()
            if previous:
                if not hmac.compare_digest(previous[0], payload):
                    return self._audit(db, election_id, voter, 'REQUEST_CONFLICT')
                return Result(previous[1] == 'ACCEPTED', previous[1], previous[2])
            election = db.execute('SELECT state FROM elections WHERE id=?', (election_id,)).fetchone()
            if not election:
                code = 'UNKNOWN_ELECTION'
            elif election[0] != 'OPEN':
                code = 'ELECTION_CLOSED'
            elif not db.execute('SELECT 1 FROM eligible WHERE election_id=? AND voter_key=?', (election_id, voter)).fetchone():
                code = 'NOT_ELIGIBLE'
            elif not db.execute('SELECT 1 FROM candidates WHERE election_id=? AND id=?', (election_id, candidate_id)).fetchone():
                code = 'INVALID_CANDIDATE'
            elif db.execute('SELECT 1 FROM participation WHERE election_id=? AND voter_key=?', (election_id, voter)).fetchone():
                code = 'ALREADY_VOTED'
            else:
                db.execute('INSERT INTO participation VALUES (?, ?)', (election_id, voter))
                db.execute('INSERT INTO ballots VALUES (?, ?, ?)', (uuid.uuid4().hex, election_id, candidate_id))
                code = 'ACCEPTED'
            result = self._audit(db, election_id, voter, code)
            db.execute('INSERT INTO requests VALUES (?, ?, ?, ?)', (request, payload, code, result.event_id))
            return result

    def _audit(self, db, election, voter, code):
        event = uuid.uuid4().hex
        db.execute('INSERT INTO audit VALUES (?, ?, ?, ?, ?)',
                   (event, datetime.now(timezone.utc).isoformat(), election, voter, code))
        return Result(code == 'ACCEPTED', code, event)

    def count_votes(self, election_id):
        """Trusted reporting operation; zero-vote candidates included."""
        if not valid_id(election_id):
            raise ValueError('Invalid election ID')
        with self._transaction() as db:
            if not db.execute('SELECT 1 FROM elections WHERE id=?', (election_id,)).fetchone():
                raise ValueError('Unknown election')
            return dict(db.execute('''SELECT c.id, COUNT(b.id) FROM candidates c
                LEFT JOIN ballots b ON b.election_id=c.election_id AND b.candidate_id=c.id
                WHERE c.election_id=? GROUP BY c.id ORDER BY c.id''', (election_id,)))


SCHEMA = (
    "CREATE TABLE IF NOT EXISTS elections (id TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN ('OPEN','CLOSED')))",
    "CREATE TABLE IF NOT EXISTS candidates (election_id TEXT NOT NULL REFERENCES elections(id), id TEXT NOT NULL, PRIMARY KEY(election_id,id))",
    "CREATE TABLE IF NOT EXISTS eligible (election_id TEXT NOT NULL REFERENCES elections(id), voter_key TEXT NOT NULL, PRIMARY KEY(election_id,voter_key))",
    "CREATE TABLE IF NOT EXISTS participation (election_id TEXT NOT NULL, voter_key TEXT NOT NULL, PRIMARY KEY(election_id,voter_key), FOREIGN KEY(election_id,voter_key) REFERENCES eligible(election_id,voter_key))",
    "CREATE TABLE IF NOT EXISTS ballots (id TEXT PRIMARY KEY, election_id TEXT NOT NULL, candidate_id TEXT NOT NULL, FOREIGN KEY(election_id,candidate_id) REFERENCES candidates(election_id,id))",
    "CREATE TABLE IF NOT EXISTS audit (event_id TEXT PRIMARY KEY, timestamp_utc TEXT NOT NULL, election_id TEXT, voter_key TEXT, code TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS requests (request_key TEXT PRIMARY KEY, payload TEXT NOT NULL, code TEXT NOT NULL, event_id TEXT NOT NULL REFERENCES audit(event_id))",
)
