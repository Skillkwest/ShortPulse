# Auth Recovery Trust Smoke

Purpose: define the minimum repeatable smoke test for ShortPulse signup confirmation, password reset, and email-change confirmation flows so production auth links do not silently drift to the wrong host or break user trust.

## Scope

- signup confirmation callback host
- password reset callback host
- email-change confirmation callback host
- production and exact-host non-production dry runs

During the pre-launch closed-signup window, production should keep public signup disabled at the app and Supabase Auth provider layers. In that state, skip the live fresh-signup email step and instead verify `npm -C frontend run auth:signup-config -- --project-ref <production-project-ref>` passes. Run the signup-confirmation email step only when public signup has been explicitly opened for a paid-checkout-first launch smoke.

This SOP is for trust verification of auth email flows. It does not replace the broader SMTP configuration and provider posture documented in [docs/sops/sop_supabase_auth_email_operations.md](./sop_supabase_auth_email_operations.md).

## Why this matters

Auth recovery is a trust surface.

If a production auth email lands on `localhost`, a preview host, or any other non-canonical origin, the user learns:

- the product may not be stable
- the next click may not be safe
- self-serve recovery may not work

That should be treated as a trust incident, not a minor routing bug.

Reference evidence:

- [docs/records/evidence/ux/2026-05-20-auth-recovery-public-origin-trust.md](../records/evidence/ux/2026-05-20-auth-recovery-public-origin-trust.md)

## Source of truth

- Canonical origin contract: [docs/adr/0078-public-origin-authority-contract.md](../adr/0078-public-origin-authority-contract.md)
- Auth setup contract: [docs/supabase_auth_setup.md](../supabase_auth_setup.md)
- SMTP and auth email ops: [docs/sops/sop_supabase_auth_email_operations.md](./sop_supabase_auth_email_operations.md)
- Callback URL route: `frontend/pages/api/auth/callback-url.ts`
- Public origin resolver: `frontend/lib/server/api/appOrigin.ts`

## Prerequisites

1. Know the exact environment under test:

- `production`
- one exact non-production dry-run host if used

2. Confirm environment config:

- `APP_BASE_URL` is set correctly
- if `SHORTPULSE_PUBLIC_API_BASE_URL` is set, it exactly matches `APP_BASE_URL`

3. Confirm Supabase redirect allowlist includes:

- `https://www.shortpulse.ai/auth/callback` for production
- one exact dry-run callback URL if a non-production dry run is being used

4. Have access to at least one inbox that can receive:

- signup confirmation
- password reset
- email-change confirmation

## Workflow

### 1. Verify callback-url authority first

Run:

```bash
GET /api/auth/callback-url?flow=recovery&next=%2Fdashboard
GET /api/auth/callback-url?flow=signup&next=%2Fdashboard
GET /api/auth/callback-url?flow=email-change&next=%2Fprofile%3Fsection%3Daccount
```

Expected results:

- production resolves to `https://www.shortpulse.ai/auth/callback?...`
- non-production dry run resolves to the one exact allowlisted dry-run host

If this step fails, stop. Do not trust downstream email tests until origin resolution is fixed.

### 2. Verify signup confirmation email

If public signup is intentionally closed for the environment, run the provider-level signup-config check instead and mark this email step as not applicable for that smoke.

1. Start a fresh signup only after public signup has been intentionally opened for launch verification.
2. Open the email.
3. Inspect the destination host before completing the flow.

Expected:

- host is `https://www.shortpulse.ai` in production
- host is the exact dry-run host in non-production
- callback completes successfully and returns through `/auth/callback`

### 3. Verify password reset email

1. Request a reset from the live auth surface.
2. Open the email.
3. Inspect the destination host before completing the flow.
4. Complete the reset.

Expected:

- host is `https://www.shortpulse.ai` in production
- host is the exact dry-run host in non-production
- recovery completes on `/auth/callback`
- password update succeeds

### 4. Verify email-change confirmation

1. Start an email change from the authenticated account surface.
2. Open the confirmation email.
3. Inspect the destination host before completing the flow.
4. Complete the confirmation.

Expected:

- host is `https://www.shortpulse.ai` in production
- host is the exact dry-run host in non-production
- callback completes successfully
- downstream confirmed-email sync behavior remains intact

### 5. Record the result

If the smoke test is run as part of:

- release signoff
- incident response
- auth repair
- production verification

record the result in:

- `docs/records/evidence/ux/` when the finding is durable
- or the relevant release/incident evidence packet

## Pass criteria

The smoke test passes only if all applicable checks are true:

1. callback-url resolution returns the correct environment host
2. signup confirmation email uses the correct host, or public signup is intentionally closed and the provider-level signup-config check passes
3. password reset email uses the correct host
4. email-change confirmation uses the correct host
5. all applicable callback flows complete successfully

## Failure handling

Treat any of these as a failure:

- production auth email links resolve to `localhost`
- production auth email links resolve to a preview/staging host
- dry-run links resolve to a host other than the exact allowlisted dry-run host
- callback flow reaches the wrong route or fails to complete

On failure:

1. stop rollout or signoff
2. verify `APP_BASE_URL` and `SHORTPULSE_PUBLIC_API_BASE_URL`
3. verify Supabase redirect allowlist
4. verify no alternate auth email path is bypassing the canonical callback-url route
5. record a retained UX evidence packet if the issue is operator- or user-visible

## Follow-up metrics

The most relevant trust metrics for this SOP are:

- signup start -> confirmation completion rate
- password reset request -> password reset completion rate
- auth failure rate by step
- repeated reset attempts per user/session

If this SOP is working and the underlying flow is healthy, those numbers should not degrade after auth-related changes.

## Maintenance

Run this smoke:

- after auth-origin env changes
- after Supabase auth email config changes
- after SMTP provider changes
- before production auth signoff
- after any incident involving broken recovery or confirmation links
