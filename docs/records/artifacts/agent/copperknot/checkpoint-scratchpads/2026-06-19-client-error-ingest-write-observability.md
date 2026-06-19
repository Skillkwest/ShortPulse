# Client Error Ingest Write Observability

Touched:

- `frontend/pages/api/log/client-error.ts`
- `frontend/tests/api/log-client-error.test.ts`

Change:

- Logged client-error ingest write failures through `logApiRouteException`.
- Preserved the existing safe 500 response.
- Added focused regression coverage for the operator-visible write-failure branch.

Validation:

- `npm -C frontend test -- --run tests/api/log-client-error.test.ts` passed, 6 tests.
- `node scripts/typecheck_changed_files.mjs --path frontend/pages/api/log/client-error.ts --path frontend/tests/api/log-client-error.test.ts` passed for touched paths.
- `git diff --check -- frontend/pages/api/log/client-error.ts frontend/tests/api/log-client-error.test.ts` passed.

Boundary:

- No UI, UX, billing, credit, production data, route shape, Supabase transform, or dirty Gear Ball files touched.
