# Token-First Auth Proxy Metadata Boundary Fix

Date: 2026-06-03
Agent: Dave the Security Guy
Mode: launch-readiness security fix, no product/UI/UX changes
Repo branch: local `production`

## Scope

This lane checked account/session authority around protected API auth, proxy-injected auth context, admin authorization, and account-recovery trust docs. The implemented fix is limited to the shared API auth helper.

No hosted Supabase, Vercel, GitHub secret, production data, UI, UX, or product-flow state was mutated.

## Confirmed Finding

| Finding | Severity | Confidence | Trust boundary | Launch impact | ROI |
| --- | --- | --- | --- | --- | --- |
| Same-user forged proxy metadata could supply missing `app_metadata` to admin authorization | High | High | Authenticated user to admin API boundary | A non-admin bearer token could become admin if the verified Supabase user payload omitted `app_metadata` and the caller supplied matching `x-shortpulse-user-*` headers | High; one shared helper fix protects all `requireAdminUser` routes |

## Attacker Path

An authenticated non-admin sends a valid bearer token plus forged `x-shortpulse-authenticated=1`, `x-shortpulse-user-id=<their user id>`, and `x-shortpulse-user-app-metadata={"role":"admin"}` to an admin API route. Before this fix, `requireApiUser` verified the bearer token but then treated same-id proxy metadata as fallback authority when the verified payload had missing metadata. Because admin checks read `user.app_metadata`, forged proxy metadata could satisfy `requireAdminUser` in that missing-metadata case.

## Root Cause

The canonical root cause was in `frontend/lib/server/api/auth.ts`, not individual admin routes:

- `resolveVerifiedApiUser` correctly verified the bearer token through Supabase.
- It then read `readProxyAuthenticatedUser(req)`.
- If the proxy header user id matched the verified user id, it merged `proxyUser.app_metadata` and `proxyUser.user_metadata` as fallback fields.
- Admin authorization in `resolveAdminAccessVia` relies on `app_metadata.role` / `app_metadata.roles`.

Proxy headers are helpful request context, but they are not an authorization source once a route can be called directly with caller-controlled headers.

## Fix

Changed `frontend/lib/server/api/auth.ts` so `resolveVerifiedApiUser` returns only the verified Supabase user. Proxy-injected metadata is no longer used as fallback authorization data.

Added regression coverage in `frontend/tests/api/auth-helper.test.ts`:

- `does not let forged same-user proxy metadata supply admin authority`

Updated `docs/security-checklist.md` so the token-first auth contract explicitly forbids proxy headers from supplying admin/app metadata or other authorization fields when the verified token payload omits them.

## Validation

Targeted command:

```bash
npm -C frontend test -- --run tests/api/auth-helper.test.ts tests/api/admin-access.test.ts tests/api/proxy-internal-utils.test.ts tests/api/fal-status.auth-context.test.ts
```

Result: passed. 4 files, 33 tests.

## Residual Launch Risk

- This fix proves the shared API helper no longer treats caller-supplied proxy metadata as admin authority.
- It does not prove the hosted Supabase Auth payload shape in production; hosted validation remains separate.
- Account recovery callback origin still needs production smoke proof before launch, per `docs/sops/sop_auth_recovery_trust_smoke.md`.

## Stop Condition Reached

Reached. The highest-ROI root cause in this bounded account/session lane was fixed and validated. The next account-auth work is hosted callback/email smoke validation or a separately proven route-specific issue, not adjacency cleanup.
