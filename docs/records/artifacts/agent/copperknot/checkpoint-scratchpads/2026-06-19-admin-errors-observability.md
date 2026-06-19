# Admin Errors Observability

Touched:

- `frontend/pages/api/admin/errors.ts`
- `frontend/tests/api/admin-errors.test.ts`

Change:

- Logged non-missing-table admin incident list query failures through `logApiRouteException`.
- Logged degraded admin incident summary metrics through `logApiRouteException`.
- Preserved existing response statuses and payload shapes.

Validation:

- `npm -C frontend test -- --run tests/api/admin-errors.test.ts` passed, 6 tests.
- `node scripts/typecheck_changed_files.mjs --path frontend/pages/api/admin/errors.ts --path frontend/tests/api/admin-errors.test.ts` passed for touched paths.
- `git diff --check -- frontend/pages/api/admin/errors.ts frontend/tests/api/admin-errors.test.ts` passed.

Boundary:

- No UI, UX, billing, credit, production data, route shape, Supabase transform, or dirty Gear Ball files touched.
