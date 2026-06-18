# Client Error Ingest Auth Boundary

Touched:
- `frontend/pages/api/log/client-error.ts`
- `frontend/tests/api/log-client-error.test.ts`

Done:
- Hardened the authenticated client-error ingest route so unexpected auth verifier failures log route-owned `.auth` diagnostics and return the existing safe ingestion error.
- Added a test proving auth failures stop before telemetry writes.

Validation:
- `npm -C frontend run test -- --run tests/api/log-client-error.test.ts` passed 6 tests.
- `npm -C frontend run test -- --run tests/api/log-client-error.test.ts tests/api/auth-helper.test.ts tests/api/admin-error-events.test.ts tests/api/admin-errors.test.ts tests/api/admin-errors-status.test.ts tests/api/admin-errors-status-bulk.test.ts tests/api/admin-stats-global.test.ts tests/api/admin-access.test.ts` passed 59 tests.
- `npm -C frontend run type-check:touched` passed.
- `npm -C frontend run docs:check` passed.
- `git diff --check -- <touched files>` passed.

Boundary:
- Admin/launch-ops observability source hardening only.
- Does not prove production client-error ingest or authenticated browser runtime behavior.
- Stop before broad route-auth wrapper architecture work.
