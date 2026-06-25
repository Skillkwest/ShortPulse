# ADR 0095: Account-First Signup Intent Gate

## Status

Accepted

Supersedes: `docs/adr/0094-paid-signup-intent-gate.md`

## Context

ShortPulse needs public account creation that lets a logged-out visitor enter the product before paying. New users should be able to create a zero-credit account, explore AI Studio, and choose a paid plan only when they are ready or when they attempt a billable generation without enough credits.

ADR 0094 kept signup tied to a selected paid pricing plan. That protected Supabase Auth from direct public account creation, but it also made the public funnel incoherent: public CTAs could invite signup while the auth page refused generic account creation. The product decision now changes that posture. Signup should be account-first, but it still needs an app-controlled gate so direct Supabase Auth or OAuth-provider calls cannot create users outside the ShortPulse signup flow.

The hidden `free` bootstrap plan remains zero-value. Signup must not grant paid credits, paid storage, concurrency, or Stripe subscription entitlement. Paid access remains owned by `/api/billing/subscription/change` plus Stripe webhook projection.

## Decision

Use one canonical signup intent gate for account-first signup and pricing-return signup:

- Public account creation starts from ShortPulse-owned routes such as `/sign-up`, public dashboard CTAs, gallery CTAs, and logged-out pricing plan actions.
- The app creates a short-lived `signup_intents` row before email/password signup or Google signup calls Supabase Auth. Email/password and typed-email Google signup use hashed-email matching; ADR 0096 extends this with a Google-only IP-bound fallback for blank-email OAuth starts.
- The Supabase Before User Created hook consumes that pending intent before `auth.users` insertion.
- The intent supports account signup without a paid plan and pricing signup with a selected paid plan. Paid-plan metadata remains required only for pricing-return intents.
- A successful signup creates only the zero-value baseline account shell from the existing new-user billing bootstrap: hidden `free` plan, zero credits, and no paid entitlement.
- Signup completion must idempotently bootstrap a Stripe customer record for the authenticated user, using the existing server-side Stripe customer sync authority. Stripe customer bootstrap is identity setup, not entitlement.
- The expected signed-up state is a real active Supabase user, a real active Stripe customer identity, and access to navigate AI Studio with a credit balance of exactly zero. This is not a bypass, trial, or free plan entitlement.
- `/api/billing/subscription/change` remains the only customer-facing recurring plan checkout authority, and Stripe webhooks remain the subscription/credit projection authority.
- Credits may enter a customer account only from paid subscription/webhook projection or a credit top-up flow available to an established paying account. Signup, account bootstrap, Stripe customer creation, and AI Studio access must never mint credits by themselves.
- `/sign-up` and `/log-in` are the canonical customer-facing auth pages. `/auth` may remain a compatibility route during migration, but it should not remain the primary public signup experience.
- AI Studio should allow zero-credit users to navigate the workspace. A billable generation attempt with insufficient credits should be blocked at submit time and hand the user to pricing without disabling Generate as a static low-balance state.

## Consequences

- Positive: The public funnel can honestly invite account creation without sending users into a closed-signup dead end.
- Positive: Direct Supabase Auth and Google OAuth user creation remain gated by a server-side hook instead of relying only on UI routing.
- Positive: Free exploration carries no paid value because the existing zero-credit bootstrap remains authoritative.
- Positive: Stripe customer identity exists before first plan purchase, reducing checkout/account reconciliation ambiguity.
- Positive: Pricing, checkout, and webhook projection keep their existing billing authority instead of moving to a guest-checkout model.
- Negative: The signup intent schema and hook must be migrated from paid-only constraints to account-first constraints.
- Historical note: the first Google signup implementation remained email-first because it used the hashed-email hook match. ADR 0096 adds the Google-only short-lived IP-bound fallback that lets the button open OAuth before the app knows the selected Google account email.
- Negative: Production rollout now requires coordinated app deploy, SQL migration, Supabase hook update, env review, and live signup proof.
- Follow-ups: Update auth/pricing/dashboard tests, route docs, Supabase auth setup docs, security checklist, and billing docs to reflect account-first signup. Production hook/env/deploy work remains an owner-approved release step.

## Alternatives considered

- Keep ADR 0094 paid-plan-only signup: secure but no longer matches the product requirement for free zero-credit exploration.
- Open Supabase signup directly: simpler, but direct Auth/OAuth calls could create users outside the app-controlled signup surface.
- Guest Stripe Checkout before account creation: strong purchase-first posture, but it contradicts the free-exploration requirement and would rewrite checkout success identity linking.
- UI-only `/sign-up` page over the paid-only gate: visually better, but it would preserve the broken account-creation contract.
