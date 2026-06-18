# Customer Issue Report Auth Boundary

Touched:
- `frontend/pages/api/report-issue.ts`
- `frontend/tests/api/report-issue.test.ts`

Done:
- Hardened the customer issue-report route so unexpected auth verifier failures log route-owned `.auth` diagnostics and return the existing safe report-save error.
- Added a test proving auth failures stop before rate limit checks and `user_issue_reports` writes.

Validation:
- `npm -C frontend run test -- --run tests/api/report-issue.test.ts tests/api/admin-reports.test.ts tests/api/admin-reports-detail.test.ts` passed 9 tests.
- `npm -C frontend run test -- --run tests/api/report-issue.test.ts tests/api/admin-reports.test.ts tests/api/admin-reports-detail.test.ts tests/api/admin-stats-global.test.ts tests/api/admin-error-events.test.ts tests/api/admin-errors.test.ts tests/api/admin-user-health.test.ts tests/api/admin-user-health-fleet.test.ts tests/api/admin-access.test.ts tests/api/auth-helper.test.ts tests/api/account-identity.test.ts` passed 70 tests.
- `npm -C frontend run type-check:touched` passed.
- `npm -C frontend run docs:check` passed.
- `git diff --check -- <touched files>` passed.

Boundary:
- Public/account trust plus admin/launch-ops source hardening only.
- Does not prove authenticated production issue-report submission.
- Stop before broad route-auth wrapper architecture work.
