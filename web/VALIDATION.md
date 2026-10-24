# Validation — 2026-10-24

- Production Vinext/Workers build: passed.
- TypeScript no-emit check: passed.
- Drizzle generation: 5 tables, foreign keys, unique request index and partial unique accepted-vote index.
- Generated migration applied to local D1: passed, 8 statements.
- Production vote engine tested against real generated SQLite schema: 19 tests passed, including 36 malformed-argument cases, Bengali candidate labels, invalid configuration, zero-count candidates, duplicate/candidate/eligibility rules, replay/conflict, rejection recovery, close/retry semantics, election isolation, mutation isolation and rollback failure injection.
- In-process async checks: 100 requests accepted once; 20 exact retries returned one receipt. This adapter serializes SQL on one connection and does not establish distributed-load performance.
- Authenticated browser QA: unavailable because managed local preview redirects to the dispatcher sign-in route, which is not available there.
- Local HTTP smoke harness: blocked by preview network connection failures; not reported as passed.
- Real hosted multi-isolate concurrency, external penetration testing, crash/restore and production election certification: not performed.

The original Python reference has its own separately executed 24-test validation in the repository root.

## Analysis and repair pass

- Added 15 regression checks (34 total) for idempotent election creation, conflicting creation payloads, owner scoping, concurrent creation retries, closed-election replay, migration data preservation, browser retry-state recovery, origin checks, actual streamed-byte limits and cancellation, numeric candidate order and coherent audit totals.
- Fixed hidden close-dialog errors and added a 20-second client request deadline. These UI changes are source/type checked; authenticated browser interaction remains unverified.
- Old schema migrations were preserved unchanged; one nullable column was added in a new migration.

## Performance and options pass

- All 43 logic tests pass, including owner-scoped snapshots, five-statement single-batch reads, voter/audit filters, stable ranking and CSV formula neutralization.
- SQLite EXPLAIN QUERY PLAN confirms use of accepted_candidate_tally for the count query.
- Server rendering smoke checks pass for populated, empty and initial-error views; the populated HTML contains data and option controls without the client-loading placeholder.
- First-page client data requests reduced from two sequential API calls to zero when server bootstrap succeeds. Snapshot database statements reduced from six to five. These are structural changes, not a measured real-user speed claim.
- Row display starts with 20 audit events and 10 voters, with Show more controls. Filters/export respect the full loaded latest-100 audit window.
- Index-only migration adds no new personal-data fields and preserves existing election/ballot records.
- Authenticated browser and live multi-isolate load tests remain unverified.
- Bundle observation before/after this options release: total built client JavaScript 414,337 → 420,341 bytes (6,004 additional bytes). The speed work removes request waterfalls and reduces initial row/layout work; it does not claim a smaller JavaScript bundle.
