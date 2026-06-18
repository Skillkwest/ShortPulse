# Copperknot checkpoint scratchpad - account email failure honesty

Date: 2026-06-17

Lane:
- Public entry and account trust.
- Fix shape: bounded source hardening in the authenticated account email route.

Touched:
- `frontend/pages/api/account/email/update.ts`
- `frontend/tests/api/account-identity.test.ts`
- This scratchpad.

Changed:
- Email-update password verification now runs inside the route's logged safe-error boundary.
- If Supabase password verification is unavailable, the route returns the existing customer-safe `Unable to update your email.` response instead of escaping the handler.
- Added a route invariant proving failed verification infrastructure does not call the Supabase user update path and logs the route exception.

Validated:
- `npm -C frontend run test -- --run tests/api/account-identity.test.ts tests/pages/auth.callback.route-behavior.test.tsx tests/api/auth-callback-url.test.ts tests/pages/profile.account-settings.test.tsx tests/pages/profile.route-state.test.tsx`
  - Passed: 5 files, 48 tests.
- `npm -C frontend run type-check:touched`
  - Passed.
- `npm -C frontend run docs:check`
  - Passed.
- `git diff --check`
  - Passed.

Boundary:
- No UI/UX change, no billing policy change, no email-provider change, no Supabase transform use, no commit/push/deploy.
- This is local source/test proof only; authenticated production profile/email mutation remains a final watch proof.
