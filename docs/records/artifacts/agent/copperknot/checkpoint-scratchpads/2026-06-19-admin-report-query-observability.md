# Admin Report Query Observability

Touched:

- `frontend/pages/api/admin/reports.ts`
- `frontend/pages/api/admin/reports/[reportId].ts`
- `frontend/tests/api/admin-reports.test.ts`
- `frontend/tests/api/admin-reports-detail.test.ts`

Change:

- Logged admin issue-report list, detail-load, and detail-update query failures through `logApiRouteException`.
- Kept the same safe API responses.
- Added focused regression tests for the new logging branches.

Validation:

- `npm -C frontend test -- --run tests/api/admin-reports.test.ts tests/api/admin-reports-detail.test.ts tests/api/report-issue.test.ts` passed, 13 tests.
- `node scripts/typecheck_changed_files.mjs --path frontend/pages/api/admin/reports.ts --path 'frontend/pages/api/admin/reports/[reportId].ts' --path frontend/tests/api/admin-reports.test.ts --path frontend/tests/api/admin-reports-detail.test.ts --path frontend/pages/api/report-issue.ts --path frontend/tests/api/report-issue.test.ts` passed for touched paths.
- `git diff --check` passed for touched files.

Boundary:

- No UI, UX, billing, credit, production data, route shape, or dirty Gear Ball files touched.
