# Admin Reports Auth Boundary

Touched:
- `frontend/pages/api/admin/reports.ts`
- `frontend/pages/api/admin/reports/[reportId].ts`
- `frontend/tests/api/admin-reports.test.ts`
- `frontend/tests/api/admin-reports-detail.test.ts`

Done:
- Hardened admin issue-report list/detail routes so unexpected admin-auth verifier failures log route-owned `.auth` diagnostics and return safe operator errors.
- Added tests proving those auth failures stop before `user_issue_reports` reads or updates.

Validation:
- `npm -C frontend run test -- --run tests/api/admin-reports.test.ts tests/api/admin-reports-detail.test.ts tests/api/report-issue.test.ts` passed 8 tests.
- `npm -C frontend run test -- --run tests/api/admin-reports.test.ts tests/api/admin-reports-detail.test.ts tests/api/report-issue.test.ts tests/api/admin-stats-global.test.ts tests/api/admin-error-events.test.ts tests/api/admin-errors.test.ts tests/api/admin-user-health.test.ts tests/api/admin-user-health-fleet.test.ts tests/api/admin-access.test.ts tests/api/auth-helper.test.ts` passed 51 tests.
- `npm -C frontend run type-check:touched` passed.
- `npm -C frontend run docs:check` passed.
- `git diff --check -- <touched files>` passed.

Boundary:
- Row 15 admin/launch-ops source hardening only.
- Does not prove authenticated production issue-report workflows.
- Stop before broad admin route-wrapper architecture work.
