# ADR 0094: Paid Signup Intent Gate

## Status

Accepted

## Context

ShortPulse needs email/password and Google account creation for launch, but public Supabase signup and OAuth provider signup can otherwise create `auth.users` rows outside the paid acquisition funnel. The existing billing path is account-first: `/api/billing/subscription/change` requires an authenticated user, validates the selected Stripe-backed paid offer, and then opens Stripe Checkout. Rewriting to guest Checkout would touch the Stripe acquisition flow and webhook surface, which is outside this launch lane.

The hidden `free` bootstrap plan is already zero-value. Signup may create an account shell, but it must not grant credits, storage, concurrency, or paid entitlement before Stripe succeeds.

## Decision

Use a paid signup intent gate:

- `/api/auth/signup-intent` accepts a normalized email plus a safe paid `/pricing` return path, verifies that the selected plan/interval has an active Stripe-backed acquisition offer, then inserts a short-lived `signup_intents` row with hashed email metadata.
- Supabase Auth's Before User Created hook must call `public.hook_shortpulse_paid_signup_intent(event jsonb)` from `sql/migrations/164_add_paid_signup_intent_gate.sql`.
- The hook rejects email/password or Google user creation unless the incoming Supabase email hash matches a fresh pending paid signup intent.
- Auth signup and Google signup both create the intent before calling Supabase Auth.
- Signup intent approval is not payment or entitlement authority. The Auth insert can only create a zero-value account shell; `/api/billing/subscription/change` and Stripe webhook projection remain the paid-plan authority.

## Consequences

- Positive: Direct Supabase Auth and Google OAuth signup attempts without a ShortPulse paid-plan intent are rejected before `auth.users` insertion.
- Positive: Google signup works without changing the existing Stripe Checkout route, subscription contract projection, or webhook behavior.
- Positive: Email addresses are not stored in `signup_intents`; only hashes and route/plan metadata are kept.
- Negative: A user can create a zero-value account shell before payment after choosing a paid plan. This is accepted because it carries no credits or paid entitlement and is required by the current authenticated Checkout route.
- Follow-ups: Hosted launch must apply the migration, configure the Supabase hook, enable Supabase signup only after hook proof, enable `NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED=true`, and manually verify matching/mismatched Google email behavior.

## Alternatives considered

- Guest Stripe Checkout before account: strongest "no account before payment" posture, but it rewrites the acquisition path, customer identity reconciliation, and checkout success handling. Rejected for this launch lane.
- App-only signup guard: simple UI/API change, but direct Supabase Auth or OAuth calls could still create users once provider signup is enabled. Rejected as insufficient.
- Invite-code allowlist: useful for private beta, but not the desired public launch flow and would add another customer-facing signup artifact. Rejected.
