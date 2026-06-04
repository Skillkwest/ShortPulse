# Email Confirmation Billing Error Boundary Fix

Date: 2026-06-03
Agent: Dave the Security Guy
Mode: launch-readiness security fix, no product/UI/UX redesign
Repo branch: local `production`

## Scope

This lane checked the authenticated account identity mutation path:

- email-change request
- email-change callback confirmation
- downstream Stripe customer identity sync
- profile display-name sync

No hosted Supabase, Vercel, GitHub secret, billing/customer state, production data, UI, UX, or intended account-flow behavior was mutated.

## Prompt Audit

Dave's goal prompt remains fit for this lane. It targets the July 7, 2026 launch date, prioritizes user account isolation and billing/customer boundaries, forbids cleanup drift and unnecessary UI/UX/product-behavior changes, and defines the active stop condition: after one verified high-ROI fix or one bounded no-fix audit, stop unless the next candidate independently clears the threat, evidence, root-cause, validation, and ROI gate.

No prompt update was needed.

## Confirmed Finding

| Finding | Severity | Confidence | Trust boundary | Launch impact | ROI |
| --- | --- | --- | --- | --- | --- |
| Email-change confirmation returned raw downstream billing sync errors to the browser | Medium | High | Authenticated account callback to billing/provider error boundary | A normal authenticated user could see raw Stripe/database/internal details during email confirmation sync failure | High for this lane; one route-layer fix closes a real sensitive account-route leakage without changing ownership or product flow |

## Attacker Path

An authenticated user completes or retries an email-change confirmation. If downstream Stripe customer sync fails, `/api/account/email/confirm` previously returned `error.message` directly to the browser. Provider or persistence errors can include internal diagnostics such as customer identifiers, mode mismatch details, table/column names, or other implementation detail. The route already logged the exception server-side, so returning the raw message was unnecessary exposure.

## Root Cause

The canonical root cause was `frontend/pages/api/account/email/confirm.ts`:

- the route correctly required `requireApiUser`
- it correctly called `syncStripeCustomerForUser` using the verified user id, email, and display name
- but the catch block returned `error.message` directly in the JSON response

The route response boundary, not the Stripe ownership helper, was the right source to fix.

## Fix

Changed `frontend/pages/api/account/email/confirm.ts` to return the stable generic message:

`Unable to finish confirming your email change.`

The raw exception continues to be logged through `logApiRouteException` for operator diagnosis.

Added regression coverage in `frontend/tests/api/account-identity.test.ts` proving a downstream billing sync failure containing a sensitive-looking Stripe customer id is logged server-side but not returned to the client.

Updated `docs/security-checklist.md` with the email-change confirmation error-safety contract.

## Validation

Targeted command:

```bash
npm -C frontend test -- --run tests/api/account-identity.test.ts tests/pages/auth.callback.route-behavior.test.tsx tests/pages/profile.account-actions.test.tsx tests/api/stripe-customer.test.ts
```

Result: passed. 4 files, 42 tests.

Docs validation:

```bash
npm -C frontend run docs:check
```

Result: passed. Documentation checks, semantic drift checks, migration/doc parity, archive manifest, model catalog parity, naming canonical drift, and operator map drift all passed.

## Residual Launch Risk

- This fix proves local code no longer returns raw downstream billing sync errors from the email-change confirmation route.
- It does not replace production auth-email smoke testing. Production still needs signup, password-reset, and email-change callback proof against `https://www.shortpulse.ai` before release signoff.
- It does not claim hosted Stripe/Supabase state is clean; it only closes the client-visible error boundary in this route.

## Deferred Findings

No cross-user account, credit, billing, media, storage, or row leakage was confirmed in this bounded account/email mutation audit. Broader raw-error cleanup remains intentionally deferred unless a specific sensitive route is proven to leak secrets, signed URLs, customer-private data, session artifacts, or usable attack detail.

## Stop Condition Reached

Reached for this lane after the verified high-ROI route fix and focused validation. The next highest-ROI step is production auth-email smoke proof or a separate fresh account-isolation target, not continuing through adjacent error-response cleanup.
