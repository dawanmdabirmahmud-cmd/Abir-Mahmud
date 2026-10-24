"""Disposable demonstration: no real voter information or persistent demo key."""
from pathlib import Path
from secrets import token_bytes
from tempfile import TemporaryDirectory
from vote_counting_agent import VoteCountingAgent


def main():
    with TemporaryDirectory() as directory:
        agent = VoteCountingAgent(Path(directory)/'demo.db', token_bytes(32))
        agent.create_election('DEMO', ['Alice','Bob','Charlie'], ['V001','V002','V003','V004'])
        for voter, candidate, request in [
            ('V001','Alice','R1'), ('V002','Bob','R2'), ('V003','Charlie','R3'),
            ('V001','Bob','R4'), ('V004','Dave','R5'), ('V004','Alice','R6'),
        ]:
            print(agent.cast_vote('DEMO', voter, candidate, request).code)
        print('Final count:', agent.count_votes('DEMO'))
        agent.close_election('DEMO')
        print('After close:', agent.cast_vote('DEMO','V004','Bob','R7').code)


if __name__ == '__main__':
    main()
