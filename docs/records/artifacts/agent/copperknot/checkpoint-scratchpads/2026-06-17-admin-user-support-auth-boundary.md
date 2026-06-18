# Admin User Support Auth Boundary

Touched:
- `frontend/pages/api/admin/users.ts`
- `frontend/pages/api/admin/users/[userId].ts`
- `frontend/tests/api/admin-users.test.ts`
- `frontend/tests/api/admin-user-delete.test.ts`

Done:
- Hardened admin user list and guarded user-delete routes so unexpected admin-auth verifier failures log route-owned `.auth` diagnostics and return safe operator errors.
- Added tests proving auth failures stop before Supabase admin/list/delete or user footprint checks.
- Preserved existing user listing, deletion confirmation, blocker, and delete semantics.

Validation:
- `npm -C frontend run test -- --run tests/api/admin-users.test.ts tests/api/admin-user-delete.test.ts` passed 10 tests.
- `npm -C frontend run test -- --run tests/api/admin-users.test.ts tests/api/admin-user-delete.test.ts tests/api/admin-access.test.ts tests/api/admin-billing-diagnostics.test.ts tests/api/admin-user-health.test.ts tests/api/admin-user-health-fleet.test.ts tests/api/account-identity.test.ts tests/api/auth-helper.test.ts` passed 63 tests.
- `npm -C frontend run type-check:touched` passed.
- `npm -C frontend run docs:check` passed.
- `git diff --check -- <touched files>` passed.

Boundary:
- Row 15 admin/launch-ops and account-support source hardening only.
- Does not prove authenticated production admin user support workflows.
- Stop before broad admin route-wrapper architecture work.
