# Report Issue Insert Observability

Touched:

- `frontend/pages/api/report-issue.ts`
- `frontend/tests/api/report-issue.test.ts`

Change:

- Logged `user_issue_reports` insert failures through `logApiRouteException` while preserving the same safe customer-facing 500 response.
- Added focused test coverage for the insert-failure logging path.

Validation:

- `npm -C frontend test -- --run tests/api/report-issue.test.ts` passed, 6 tests.
- `node scripts/typecheck_changed_files.mjs --path frontend/pages/api/report-issue.ts --path frontend/tests/api/report-issue.test.ts` passed for touched paths.
- `git diff --check -- frontend/pages/api/report-issue.ts frontend/tests/api/report-issue.test.ts` passed.

Boundary:

- No UI, UX, billing, credit, route-shape, production data, or dirty Gear Ball files touched.
