# Admin Report Summary Observability

Touched:

- `frontend/pages/api/admin/reports.ts`
- `frontend/tests/api/admin-reports.test.ts`

Change:

- Logged degraded admin issue-report summary count queries through `logApiRouteException`.
- Preserved the existing 200 response and zeroed summary behavior when counts degrade.
- Added focused regression coverage for the log plus preserved response.

Validation:

- `npm -C frontend test -- --run tests/api/admin-reports.test.ts tests/api/admin-reports-detail.test.ts tests/api/report-issue.test.ts` passed, 14 tests.
- `node scripts/typecheck_changed_files.mjs --path frontend/pages/api/admin/reports.ts --path frontend/tests/api/admin-reports.test.ts` passed for touched paths.
- `git diff --check -- frontend/pages/api/admin/reports.ts frontend/tests/api/admin-reports.test.ts` passed.

Boundary:

- No UI, UX, billing, credit, production data, route shape, or dirty Gear Ball files touched.
