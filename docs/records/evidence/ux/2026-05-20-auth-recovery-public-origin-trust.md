# Auth Recovery Public-Origin Trust

Purpose: retain the first live UX evidence packet for the auth recovery surface, using the new UX framework on a real ShortPulse trust failure.

## Surface

- signup confirmation email flow
- password reset email flow
- account recovery callback flow

## Observed behavior

Production users reported that auth emails could send them to `localhost` instead of the real public app origin.

That created a visible trust failure:

- the user clicked an email from a production product
- the link did not feel safe or legitimate
- the recovery path no longer felt dependable
- the user needed manual intervention instead of self-service recovery

This was raised during live production support work while trying to restore access for a real user.

## Likely hesitation or trust issue

This is a first-class trust failure, not a minor routing bug.

At the moment a user needs recovery, they are already carrying tension:

- "can I get back into my account"
- "is this email real"
- "will this work"

A production email that resolves to `localhost` or any non-canonical host teaches the user:

- the system is unstable
- the company may not control its own auth flow
- the next click might not be safe

That is exactly the kind of moment that collapses confidence.

## Supporting evidence

### User-side evidence

- Live user report: production password reset and confirmation flows were leading to `localhost` instead of the production ShortPulse host.
- The issue was severe enough that access restoration shifted from self-serve recovery to manual operator work.

### Product contract evidence

- [docs/ux-decision-framework.md](../../../ux-decision-framework.md) defines recovery flows as first-class trust surfaces.
- [docs/product-instrumentation.md](../../../product-instrumentation.md) names auth and recovery as a core decision journey.
- [docs/supabase_auth_setup.md](../../../supabase_auth_setup.md) requires production auth callbacks to allow and resolve to `https://www.shortpulse.ai/auth/callback`.
- [docs/sops/sop_supabase_auth_email_operations.md](../../../sops/sop_supabase_auth_email_operations.md) requires production smoke tests for auth links landing on the real public origin.
- [docs/adr/0078-public-origin-authority-contract.md](../../../adr/0078-public-origin-authority-contract.md) states production public-origin resolution must normalize to `https://www.shortpulse.ai`.

### Runtime/code evidence

- `frontend/pages/api/auth/callback-url.ts` is the server-owned callback URL authority used by client auth flows.
- `frontend/lib/server/api/appOrigin.ts` is designed to fail closed in production unless the configured or request origin resolves to the approved production hostname set.
- `frontend/lib/authRedirects.ts` uses the callback-url route and intentionally avoids browser fallback in production.

### Inference

Given the runtime contract above, a production auth email landing on `localhost` strongly suggests one of these:

1. production `APP_BASE_URL` or related deployed origin configuration was wrong at the time of email generation
2. Supabase redirect allowlist or auth email configuration drifted from the repo contract
3. a recovery/confirmation path outside the current canonical callback-url flow was still active

## Recommended decision

Treat auth callback host correctness as a release-gating trust check.

Immediate operating decisions:

1. production auth emails must never be considered healthy without a fresh smoke test
2. callback-origin verification should be part of auth or deploy change control, not an optional check
3. any report of `localhost` or preview-host auth links in production should be handled as a trust incident

Recommended implementation and operations follow-up:

1. add a repeatable smoke procedure that verifies:
   - signup confirmation
   - password reset
   - email-change confirmation
2. verify production deployed envs and Supabase auth redirect configuration against the public-origin contract
3. record production auth-host failures in this namespace, not only in chat history

## Follow-up metric

The main measurement targets for this surface should be:

- password reset request -> password reset completion rate
- signup start -> confirmation completion rate
- auth failure rate by step
- repeated reset attempts per user/session

Expected improvement after a real fix:

- recovery completions increase
- manual access-restoration requests decrease
- support reports about invalid or suspicious auth links drop toward zero
