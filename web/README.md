# Voter Agent — private web prototype

A private admin console adapted from the Python Voter AI Agent V2 in the parent GitHub project. The Python code remains the local reference implementation; this web app runs TypeScript/JavaScript on Sites Workers with durable D1 storage.

## What works

- Create an election with 2–20 candidate display names and 1–200 synthetic voter IDs.
- Submit test votes as the workspace owner; verify eligibility, candidate membership and one accepted vote per voter/election.
- Atomic check-and-insert SQL plus a partial unique index prevent duplicate accepted ballots.
- Stable request receipts handle retries. Payload changes under an existing voter/request key return REQUEST_CONFLICT.
- Fixed roster, zero-vote candidate counts, durable election closure, latest-100 audit view and CSV export.
- Authenticated identity comes from the Sites dispatcher; all API operations enforce per-election ownership and state-changing operations enforce same-origin requests.
- No real individual voter authentication: the signed-in owner simulates voters by entering test IDs.

## Security scope

Owner-private Site. Test data only. Database records link test voter IDs to candidate choices; hiding candidate choices in the audit view is not ballot secrecy. Database administration can alter records; this is not a tamper-proof log. Not certified or suitable for a public/real election. Do not change audience to public without reviewing authorization and privacy.

Changing the Site audience does not implement real voter enrollment or voting. Production requires individual authentication, independently reviewed ballot secrecy, audit/reconciliation, abuse controls, recovery and legal requirements.

## Commands

Use the supplied Sites starter lifecycle to install dependencies and build. Node 24 is used for the built-in SQLite test adapter.

```sh
npm test
npm run typecheck
npm run db:generate
npm run build
```

`tests/voting.test.mjs` uses the real generated SQLite schema and production vote SQL with an in-process D1 interface adapter. Its concurrent async cases execute on one synchronous SQLite connection; they are NOT proof of Cloudflare multi-isolate concurrency or throughput. Unique index and SQL atomicity enforce the intended invariant; real hosted concurrency is a remaining integration check.

`tests/api-smoke.mjs` is a local-preview-only HTTP integration harness. It supplies synthetic identity headers solely to represent the trusted local dispatcher. The managed preview network/sign-in limitations prevented that harness and authenticated browser UI verification in this session. Do not run it against a deployed Site or use synthetic headers as production authentication.

Schema migrations live in `drizzle/`. Sites applies them when publishing; local and hosted records are separate. Never write runtime records into migration files. No fixtures are auto-created in the hosted database.

## Behavior and limits

Candidate labels can be Bengali or English; stable candidate IDs are generated as C1, C2, etc. Test voter/request IDs are strict ASCII identifiers of 1–128 characters, with no whitespace. Correcting a rejected payload needs a new request ID. Repeating the same request returns the original receipt, including after election closure.

The audit view shows the latest 100 events only; CSV exports those displayed events. Election selection shows the latest 100 owned elections. Malformed API requests are rejected before a ballot record exists. Exact retries reuse the stored audit event; request conflicts add a separate event. Records persist on the server and survive page reloads. There is no delete or reopen operation.

The `.openai/hosting.json` project identity belongs to the deployed private Site. GitHub is a source mirror; a GitHub push alone does not deploy this Sites app. Publish using the Sites workflow for that project.
