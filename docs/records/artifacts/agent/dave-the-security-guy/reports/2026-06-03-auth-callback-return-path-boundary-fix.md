# Auth Callback Return-Path Boundary Fix

Date: 2026-06-03
Agent: Dave the Security Guy
Mode: launch-readiness security fix, no product/UI/UX changes
Repo branch: local `production`

## Scope

This lane checked whether signup, password-reset, email-change, and post-login auth return paths can be steered away from the trusted ShortPulse origin through hostile `next` values or callback URL generation.

No hosted Supabase, Vercel, GitHub secret, production data, UI, UX, or product-flow state was mutated.

## Confirmed Finding

| Finding | Severity | Confidence | Trust boundary | Launch impact | ROI |
| --- | --- | --- | --- | --- | --- |
| Auth `next` sanitizer allowed backslash-containing paths that URL parsers can normalize cross-origin | High | High | Auth callback/user trust boundary | Auth links or post-auth navigation could be abused as an open redirect away from ShortPulse | High; one shared helper fix protects signup, recovery, email-change, and sign-in return paths |

## Attacker Path

An attacker supplies a `next` value such as `/\evil.example/path` to a ShortPulse auth entry or callback URL. The existing helper accepted it because it started with `/` and did not start with `//`. Browser URL parsing can normalize that path to `https://evil.example/path`, turning an auth trust flow into an external redirect.

## Root Cause

The canonical root cause was `frontend/lib/authRedirects.ts`:

- `resolveNextPath` rejected absolute URLs and protocol-relative `//...` paths.
- It did not reject backslash-containing paths.
- The same helper feeds callback URL generation and client router navigation in `frontend/pages/auth.tsx`, `frontend/pages/auth/callback.tsx`, and profile password-reset flows.

## Fix

Changed `resolveNextPath` to fail closed to `/dashboard` when the candidate contains `\`.

Added regression coverage:

- `frontend/tests/lib/authRedirects.test.ts` rejects `/\evil.example...` and `/\/evil.example...`.
- `frontend/tests/api/auth-callback-url.test.ts` proves `/api/auth/callback-url` emits a safe `/dashboard` callback for a hostile backslash `next`.

Updated `docs/security-checklist.md` to record the auth callback return-path contract.

## Validation

Targeted command:

```bash
npm -C frontend test -- --run tests/lib/authRedirects.test.ts tests/api/auth-callback-url.test.ts tests/pages/auth.callback.route-behavior.test.tsx tests/pages/auth.route-behavior.test.tsx
```

Result: passed. 4 files, 34 tests.

## Residual Launch Risk

- This fix proves local code rejects backslash return paths before callback URL generation and callback navigation.
- It does not replace production auth email smoke testing. Production still needs the SOP check that signup, password reset, and email-change emails resolve to `https://www.shortpulse.ai/auth/callback`.
- Preview callback URL generation still intentionally uses the external request origin for exact-host dry runs; that remains governed by the deploy/env contract and Supabase redirect allowlist.

## Stop Condition Reached

Reached. The highest-ROI root cause in this bounded auth-origin lane was fixed and validated. The next auth work is production callback/email smoke proof or a separately proven account-security issue, not adjacent cleanup.
