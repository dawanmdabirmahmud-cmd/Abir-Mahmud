import concurrent.futures as futures
import multiprocessing
from pathlib import Path
import sqlite3
import tempfile
import unittest
from vote_counting_agent import VoteCountingAgent

KEY = b'test-only-key-never-use-in-production-123'

def worker(args):
    path, i = args
    return VoteCountingAgent(path, KEY).cast_vote('E1','V1','Alice',f'P{i}').code

class AgentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = str(Path(self.tmp.name)/'votes.db')
        self.agent = VoteCountingAgent(self.path, KEY)
        self.agent.create_election('E1',['Alice','Bob'],['V1','V2'])

    def vote(self, voter='V1', candidate='Alice', request='R1', election='E1'):
        return self.agent.cast_vote(election,voter,candidate,request)

    def rows(self, table):
        with sqlite3.connect(self.path) as db:
            return db.execute(f'SELECT * FROM {table}').fetchall()

    def invariant(self, n):
        self.assertEqual(sum(self.agent.count_votes('E1').values()),n)
        for table in ('ballots','participation'):
            self.assertEqual(len(self.rows(table)),n)
        self.assertEqual(sum(r[-1]=='ACCEPTED' for r in self.rows('audit')),n)

    def test_valid_zero_counts(self):
        self.assertTrue(self.vote().accepted)
        self.assertEqual(self.agent.count_votes('E1'),{'Alice':1,'Bob':0})
        self.invariant(1)

    def test_duplicate(self):
        self.vote()
        self.assertEqual(self.vote(candidate='Bob',request='R2').code,'ALREADY_VOTED')
        self.invariant(1)

    def test_invalid_candidate_preserves_right(self):
        self.assertEqual(self.vote(candidate='Mallory').code,'INVALID_CANDIDATE')
        self.assertTrue(self.vote(request='R2').accepted)
        self.invariant(1)

    def test_malformed(self):
        for pos in range(4):
            for value in (None,[],{},True,1,'',' ',' V1','V1 ','x'*129,'a\nb'):
                with self.subTest(pos=pos,value=value):
                    args=['E1','V1','Alice','R1']; args[pos]=value
                    self.assertEqual(self.agent.cast_vote(*args).code,'INVALID_INPUT')
        self.invariant(0)
        self.assertEqual(len(self.rows('audit')),44)

    def test_ineligible(self):
        self.assertEqual(self.vote(voter='Stranger').code,'NOT_ELIGIBLE')
        self.invariant(0)

    def test_unknown_election(self):
        self.assertEqual(self.vote(election='Missing').code,'UNKNOWN_ELECTION')

    def test_closed(self):
        self.agent.close_election('E1'); self.agent.close_election('E1')
        self.assertEqual(self.vote().code,'ELECTION_CLOSED')
        self.invariant(0)

    def test_retry(self):
        first=self.vote()
        self.assertEqual(first,self.vote())
        self.assertEqual(len(self.rows('audit')),1)
        self.invariant(1)

    def test_retry_after_close(self):
        first=self.vote(); self.agent.close_election('E1')
        self.assertEqual(first,self.vote())

    def test_conflict(self):
        self.vote()
        self.assertEqual(self.vote(candidate='Bob').code,'REQUEST_CONFLICT')
        self.invariant(1)

    def test_rejected_retry(self):
        first=self.vote(candidate='Mallory')
        self.assertEqual(first,self.vote(candidate='Mallory'))
        self.assertEqual(self.vote().code,'REQUEST_CONFLICT')
        self.assertTrue(self.vote(request='R2').accepted)

    def test_request_voter_scope(self):
        self.vote(); self.assertTrue(self.vote(voter='V2').accepted)
        self.invariant(2)

    def test_restart(self):
        first=self.vote(); self.agent=VoteCountingAgent(self.path,KEY)
        self.assertEqual(first,self.vote())
        self.assertEqual(self.vote(request='R2').code,'ALREADY_VOTED')
        self.invariant(1)

    def test_election_scope(self):
        self.agent.create_election('E2',['Alice'],['V1'])
        self.vote(); self.assertTrue(self.vote(election='E2').accepted)
        self.assertEqual(self.agent.count_votes('E2'),{'Alice':1})

    def test_mutation_isolated(self):
        source=dict(voter='V1',candidate='Alice',request='R1')
        self.vote(**source); source['candidate']='Mallory'
        result=self.agent.count_votes('E1'); result['Alice']=999
        self.assertEqual(self.agent.count_votes('E1'),{'Alice':1,'Bob':0})
        self.assertEqual(self.rows('audit')[0][-1],'ACCEPTED')

    def test_wrong_key(self):
        with self.assertRaises(ValueError): VoteCountingAgent(self.path,b'x'*32)

    def test_invalid_setup(self):
        for key in (None,'x'*40,b'short'):
            with self.assertRaises(ValueError): VoteCountingAgent(self.path,key)
        with self.assertRaises(ValueError): VoteCountingAgent(':memory:',KEY)
        for candidates,voters in [('Alice',['V1']),([],['V1']),(['Alice','Alice'],['V1']),(['Alice'],[]),(['Alice'],['V1','V1']),([None],['V1'])]:
            with self.subTest(candidates=candidates,voters=voters):
                with self.assertRaises(ValueError): self.agent.create_election('E2',candidates,voters)
        with self.assertRaises(sqlite3.IntegrityError): self.agent.create_election('E1',['Alice'],['V1'])
        self.invariant(0)

    def test_unknown_reporting_admin(self):
        for method in (self.agent.close_election,self.agent.count_votes):
            for value in ('Unknown',None):
                with self.assertRaises(ValueError): method(value)

    def test_failure_rolls_back(self):
        for table in ('audit','requests'):
            with self.subTest(table=table):
                with sqlite3.connect(self.path) as db:
                    db.execute(f"CREATE TRIGGER fail BEFORE INSERT ON {table} BEGIN SELECT RAISE(ABORT,'injected'); END")
                with self.assertRaises(sqlite3.IntegrityError): self.vote()
                self.invariant(0)
                self.assertEqual(self.rows('audit'),[])
                self.assertEqual(self.rows('requests'),[])
                with sqlite3.connect(self.path) as db: db.execute('DROP TRIGGER fail')
        self.assertTrue(self.vote().accepted)

    def test_100_concurrent_connections(self):
        with futures.ThreadPoolExecutor(max_workers=16) as pool:
            results=list(pool.map(lambda i:self.vote(request=f'T{i}').code,range(100)))
        self.assertEqual(results.count('ACCEPTED'),1)
        self.assertEqual(results.count('ALREADY_VOTED'),99)
        self.invariant(1)

    def test_concurrent_retry(self):
        with futures.ThreadPoolExecutor(max_workers=8) as pool:
            results=list(pool.map(lambda _:self.vote(),range(20)))
        self.assertEqual(len(set(results)),1)
        self.assertEqual(len(self.rows('audit')),1)
        self.invariant(1)

    def test_multiprocess(self):
        with futures.ProcessPoolExecutor(max_workers=4,mp_context=multiprocessing.get_context('spawn')) as pool:
            results=list(pool.map(worker,[(self.path,i) for i in range(20)]))
        self.assertEqual(results.count('ACCEPTED'),1)
        self.assertEqual(results.count('ALREADY_VOTED'),19)
        self.invariant(1)

    def test_audit_minimization(self):
        self.vote(); audit=self.rows('audit')[0]
        self.assertTrue(audit[1].endswith('+00:00'))
        self.assertNotIn('V1',audit); self.assertNotIn('Alice',audit)

    def test_db_constraints(self):
        self.vote()
        with sqlite3.connect(self.path) as db:
            db.execute('PRAGMA foreign_keys=ON')
            with self.assertRaises(sqlite3.IntegrityError): db.execute("INSERT INTO ballots VALUES ('bad','E1','Mallory')")
            with self.assertRaises(sqlite3.IntegrityError): db.execute('INSERT INTO participation VALUES (?,?)',self.rows('participation')[0])

if __name__=='__main__': unittest.main()
