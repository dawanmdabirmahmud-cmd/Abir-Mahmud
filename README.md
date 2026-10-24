# Voter AI Agent V2 — local prototype

Issue source: https://github.com/dawanmdabirmahmud-cmd/Abir-Mahmud/issues/1
Reviewed baseline: issue body; repository main commit `21a5f70a2223aa46b74b8f593b1ee8c7482453e1` contained a legacy Azure Node workflow with embedded Python source. V2 is runnable Python source at the repository root. The original malformed Azure file is archived under `docs/legacy/azure-webapps-node.txt`; Python and web checks use separate valid workflows. No web service is hosted by this repository.

## বাংলা: চালানোর নিয়ম

1. GitHub থেকে Code → Download ZIP দিয়ে extract করুন। `vote_counting_agent.py` যেখানে আছে সেখানে Terminal খুলুন।
2. Python 3.10 বা পরবর্তী সংস্করণ ব্যবহার করুন। কোনো third-party package প্রয়োজন নেই। Windows-এ `python` না চললে `py` ব্যবহার করুন।
3. Demo: `python demo.py`
4. Tests: `python -m unittest discover -s tests -v`

Demo-তে অস্থায়ী database/key ব্যবহৃত হয়; demo শেষে মুছে যায়। নিজের integration-এ স্থায়ী database path এবং secret manager থেকে একই private key দিন। Key অবশ্যই কমপক্ষে ৩২ random byte হবে। Key হারালে বা বদলালে existing database খুলবে না। Database ও key দুটোই নিরাপদে backup করুন। Key কখনও source code, ZIP বা GitHub-এ রাখবেন না।

## Contract and integration

```python
from vote_counting_agent import VoteCountingAgent

# Obtain private_key from your secret manager (bytes, >=32 random bytes).
agent = VoteCountingAgent('votes.sqlite3', private_key)
# Trusted administrator only, once per election:
agent.create_election('E2026', ['C1', 'C2'], ['V1', 'V2'])
# Trusted adapter must authenticate V1 and check its identity binding first:
result = agent.cast_vote('E2026', 'V1', 'C1', 'unique-request-1')
print(result.accepted, result.code, result.event_id)
# Trusted reporting/admin only:
print(agent.count_votes('E2026'))
agent.close_election('E2026')
```

This intentionally replaces the unsafe mutable-dictionary `accept_vote` API. All IDs use ASCII letters/numbers initially, then letters/numbers or `_ . : -`, maximum 128 characters. Whitespace, blank, Unicode and non-string IDs are rejected, never silently normalized. Bengali candidate display names belong in a separate presentation layer mapped to stable candidate IDs. Candidate/voter rosters are fixed on creation. Election creation is atomic; duplicate configuration raises instead of overwriting.

`create_election` creates OPEN directly; DRAFT/scheduled opening, reopening and roster updates are not implemented. Closing is idempotent. Count access is available while OPEN to a trusted caller; an API must enforce result-release policy.

Codes: ACCEPTED, INVALID_INPUT, UNKNOWN_ELECTION, ELECTION_CLOSED, NOT_ELIGIBLE, INVALID_CANDIDATE, ALREADY_VOTED, REQUEST_CONFLICT. Results are frozen dataclasses. Database errors propagate; they are not converted into successful receipts or policy rejections.

Request identity is scoped to (election, authenticated voter, request ID). Same request/payload returns the original receipt, including after closure or restart; a changed candidate returns REQUEST_CONFLICT. Valid-shaped rejected requests also retain their result: use a new request ID to submit a corrected vote. Malformed requests have no stable identity and receive a fresh INVALID_INPUT audit event. Exact retries return their existing audit event; they do not append another event. A storage timeout or uncertain response should be retried with the SAME request ID.

## Integrity design

- Persistent SQLite, foreign keys, FULL synchronous commits, BEGIN IMMEDIATE write transactions.
- Each operation opens its own connection; no shared connection/thread state.
- UNIQUE participation primary key per election/voter; ballot candidate foreign key.
- Ballot, participation, accepted audit event and request receipt commit together.
- Separate ballot rows contain no voter ID or audit-event link.
- UTC audit timestamp and random event ID; audit contains keyed voter pseudonyms and reason codes, not candidate choice or raw identity.
- HMAC request keys/fingerprints avoid storing raw request payloads; key mismatch fails on startup.
- Counts include zero-vote candidates and return detached dictionaries.

## Security boundaries — read before integration

This is a trusted local prototype, **not production voting software** and not cryptographically anonymous. No authentication, authorization, network API, TLS, rate limiting, election certification, encrypted database, schema migration or tamper-evident audit storage is included. Anyone with database write access can change votes or audit records. Appending in application code does not make audit storage immutable. Admin changes themselves are not audited in this version.

Pseudonyms are personal data. The database/key holder can correlate identities, candidate fingerprints (small candidate spaces), insertion order and timestamps. Separating tables does NOT establish ballot secrecy. A production secret-ballot design needs independently reviewed unlinkability and verifiability, not merely more hashing.

SQLite serializes writers; use local disk, not a shared network filesystem, and measure your workload. This is not a distributed or high-throughput service. Reporting currently also acquires a write reservation to keep operations simple; benchmark before scaling. A full disk, lock timeout or corruption may raise sqlite3 errors; service adapters must log operational errors separately without logging voter choices. No automatic retry hides an uncertain commit.

## Validation and next release gates

Run tests from this directory. The suite covers 44 malformed argument combinations, zero counts, configuration errors, input/result mutation isolation, candidate and eligibility rejection, election isolation/closure, request replay/conflicts, restart, wrong key, database constraints, 100 concurrent connections, concurrent retries, four spawned processes, and injected failures on audit/receipt insert.

The injection tests verify transaction rollback after ballot/participation writes; they are NOT power-loss or OS process-kill tests. Before production integration:

1. Add authenticated identity binding, admin roles, roster provenance, trusted opening/closing and result-release policies.
2. Specify ballot secrecy and legal/audit requirements; obtain independent architecture/security review.
3. Design tamper detection and independent reconciliation; restrict database/key access.
4. Run process-kill/commit-boundary, lock-timeout, disk-full, backup/restore and load tests on target storage/OS.
5. Add migration/version checks and operational recovery procedures; test key backup and restoration.
6. Configure CI for your supported Python/OS versions; record actual results before claiming portability.
7. Check invariants: tally total = committed ballot count = participation count = ACCEPTED audit count, separately per election. This check detects some corruption; it does not prove correct voter intent or secrecy.

No production-ready claim follows from passing these local tests.

## GitHub checks

The Voter Python Tests workflow runs demo and the full unittest suite on push, pull request, or manual dispatch using Python 3.12 on Ubuntu. Local validation is recorded in VALIDATION.txt; check the Actions tab for hosted-run results. The malformed original Azure file is archived under `docs/legacy/azure-webapps-node.txt` and no longer runs as a workflow.

## Private web application

Live owner-private workspace: https://abir-voter-agent.dawanmdabirmahmud.chatgpt.site

The complete web adaptation is in [`web/`](web/README.md), including its D1 schema, migration, UI, API and 43-test suite. Sign in with the owner ChatGPT account to open the app, then choose **New election**. Use synthetic voter IDs only. This is an admin simulator, not individual voter authentication or a certified secret-ballot system.

The Python implementation above remains runnable from the repository root. The web app uses TypeScript/JavaScript and D1 on Sites; GitHub hosts the source mirror, while Sites hosts the running application. A GitHub push alone does not redeploy the Site. Web validation limits are recorded in `web/VALIDATION.md`.

### Reliability repair

The deployed web app now preserves retry IDs across ordinary reloads, makes election creation idempotent, enforces the actual JSON byte limit, orders candidates numerically and reconciles conflict events in attempt totals. The web suite has 43 tests; see `web/VALIDATION.md` for execution limits. The new nullable schema migration preserves existing elections and votes.

### Workspace speed and options

The private web app now server-renders its first election snapshot, caches recent snapshots during election switching, and uses indexed vote counts. New controls include voter search/participation filters, audit search/status filters with progressive display, results/audit/roster CSV exports, candidate ranking, copy-settings and optional 15-second auto-refresh. The logic suite has 43 tests; server rendering checks pass. See `web/VALIDATION.md` for measured structural changes and browser-verification limits.
