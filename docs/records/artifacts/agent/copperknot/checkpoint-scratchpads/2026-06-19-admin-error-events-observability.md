# Admin Error Events Observability

Touched:

- `frontend/pages/api/admin/error-events.ts`
- `frontend/tests/api/admin-error-events.test.ts`

Change:

- Logged non-missing-table raw event list, actionable-open, actionable-unlinked, and fallback page query failures through `logApiRouteException`.
- Logged degraded raw event forensics health through `logApiRouteException`.
- Preserved existing response statuses and payload shapes.

Validation:

- `npm -C frontend test -- --run tests/api/admin-error-events.test.ts` passed, 8 tests.
- `node scripts/typecheck_changed_files.mjs --path frontend/pages/api/admin/error-events.ts --path frontend/tests/api/admin-error-events.test.ts` passed for touched paths.
- `git diff --check -- frontend/pages/api/admin/error-events.ts frontend/tests/api/admin-error-events.test.ts` passed.

Boundary:

- No UI, UX, billing, credit, production data, route shape, Supabase transform, or dirty Gear Ball files touched.
