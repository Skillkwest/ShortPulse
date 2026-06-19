# Admin Error Status Observability

Touched:

- `frontend/pages/api/admin/errors-status.ts`
- `frontend/pages/api/admin/errors-status-bulk.ts`
- `frontend/tests/api/admin-errors-status.test.ts`
- `frontend/tests/api/admin-errors-status-bulk.test.ts`

Change:

- Logged single-incident RPC errors and malformed RPC success payloads through `logApiRouteException`.
- Logged one aggregate bulk-update failure event when any item fails.
- Preserved existing response statuses and payload shapes for success, partial success, and all-failed batches.

Validation:

- `npm -C frontend test -- --run tests/api/admin-errors-status.test.ts tests/api/admin-errors-status-bulk.test.ts` passed, 18 tests.
- `node scripts/typecheck_changed_files.mjs --path frontend/pages/api/admin/errors-status.ts --path frontend/pages/api/admin/errors-status-bulk.ts --path frontend/tests/api/admin-errors-status.test.ts --path frontend/tests/api/admin-errors-status-bulk.test.ts` passed for touched paths.
- `git diff --check -- frontend/pages/api/admin/errors-status.ts frontend/pages/api/admin/errors-status-bulk.ts frontend/tests/api/admin-errors-status.test.ts frontend/tests/api/admin-errors-status-bulk.test.ts` passed.

Boundary:

- No UI, UX, billing, credit, production data, route shape, Supabase transform, or dirty Gear Ball files touched.
