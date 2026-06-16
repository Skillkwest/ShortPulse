# 2026-06-16 Free Signup Billing Security Audit

Agent: Dave the Security Guy  
Mode: launch-readiness account/billing security audit with one scoped hardening fix  
Branch: local `production`

## Scope

Investigated production accounts that appeared in Admin with `Plan: Free`, `Billing state: Active`, and zero spendable credits. The goal was to determine whether unknown users bypassed subscription, received free credits, could use paid generation without balance, or could cross into another user's credits, media, rows, or Stripe data.

Out of scope: deleting users, mutating hosted Supabase/Stripe/Vercel state, changing UI/UX, disabling Supabase Auth provider settings, or running live purchases without explicit approval.

## Findings

### 1. The accounts did not bypass Stripe; public auth signup is open

Severity: medium launch-control risk  
Confidence: high  
Boundary: public visitor to authenticated account bootstrap  
Root cause: `frontend/pages/auth.tsx` calls `supabase.auth.signUp` for `mode === "signup"`. The signup trigger then creates a hidden `free` billing profile as the bootstrap state.  
Launch impact: explains how users can appear in Admin before paid subscription. This is not evidence of Stripe/customer bypass by itself.

Production evidence:

- The production `/auth?mode=signup` page is reachable.
- The selected June 15 account had a hidden `free` profile, no Stripe customer id, no Stripe subscription id, zero balance, no ledger rows, no reservations, no generation rows, no media rows, and no projects.
- Unauthenticated production probes to `/api/credits/snapshot`, `/api/projects`, `/api/media/list`, `/api/billing/stripe/portal`, and `/api/admin/users` returned `401`.

### 2. Current signup does not grant credits, but production had stale free-offer value

Severity: high for launch trust if left stale  
Confidence: high  
Boundary: hidden free tier to paid-value credits/storage/concurrency  
Root cause: migration `158_disable_signup_seed_credit_grants.sql` stopped new signup seed credits, but live catalog metadata still had a non-acquisition `free__current` offer with `100` monthly credits and `free` storage entitlement at 1GB.  
Launch impact: no current public acquisition path was confirmed for that offer, but hidden free metadata carrying paid value is not acceptable launch posture.

Production evidence:

- Newer free signup checked during this audit had zero ledger rows and zero balance.
- Two older May accounts had historical `signup_seed` ledger rows. One spent 10 credits through captured reservations before an admin adjustment removed remaining credits; the other had the old seed removed and did not generate.

Fix made:

- Added `sql/migrations/161_harden_hidden_free_billing_offer.sql` to force hidden `free` plan and offers to zero price, zero credits, zero storage, zero concurrency, no Stripe price, and non-acquisition.
- Replaced `activate_billing_plan_offer` so service-role offer activation rejects `p_plan_id = 'free'` and rejects zero-price public offers.
- Updated admin pricing plan/offer create routes to reject `free` as system-owned and require positive pricing for public plans/offers.
- Updated canonical `sql/create_billing_credit_tables.sql` so fresh bootstrap metadata also gives hidden `free` zero storage and zero credits.
- Updated the auth/pricing funnel so app-level signup is disabled by default unless `NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED=true` and `next` points to `/pricing` with an explicit paid plan id (`starter`, `media`, `studio`, or `business`). Direct `/auth?mode=signup`, protected-route signup, `/pricing` without a selected paid plan, `plan=free`, and normal production default signup intents fail closed at the app layer.
- Updated public pricing helpers so guest signup links carry a selected paid plan, the hidden `free` plan is always filtered from public subscription cards, and fallback free presentation metadata no longer advertises storage.
- Added `scripts/check_supabase_auth_signup_config.mjs` plus `npm -C frontend run auth:signup-config` to verify production Supabase Auth `disable_signup` and optionally apply `disable_signup=true` through an explicit project-ref-confirmed operator command.

### 3. Zero-credit accounts should fail closed for paid generation

Severity: no confirmed exploitable issue after current hardening  
Confidence: high from repo evidence, medium-high from production row checks  
Boundary: authenticated zero-balance user to paid provider generation  
Root cause checked: generation routes call `chargeGenerationRequest`, which calls the reservation RPC before provider submission. The RPC locks the caller's balance and raises `Insufficient credits` when balance minus active reservations is below the requested amount.  
Launch impact: zero-balance users should not be able to run paid provider work.

Evidence:

- Shared generation billing reserves credits before provider calls.
- `admit_and_reserve_generation_credits` checks `ai_credit_balance` and active reservations before inserting reservation rows.
- The newest highlighted account had zero balance, zero reservations, and zero generations.

## Residual Risk And Required Hosted Step

The repo fix is not live until the SQL migration is applied to production Supabase and the app deploy containing the auth/admin route guards is promoted. No hosted mutation was performed in this audit.

If the desired pre-launch posture is "nobody can create an auth account except through the paid-plan funnel," the app now fails closed by default for ShortPulse signup routes. To make it absolute against direct calls to Supabase Auth's public signup endpoint, production Supabase Auth must have `disable_signup=true` or ShortPulse must ship a server-owned paid-checkout-first signup design. No app-only route guard can fully prevent direct Supabase Auth API signup while provider signup remains enabled.

## Validation

- `git diff --check` passed.
- `npm -C frontend run type-check:touched` passed for the touched frontend TypeScript files.
- `npx eslint pages/api/admin/pricing/plan-offers/create.ts pages/api/admin/pricing/plans/create.ts` passed from `frontend/`.
- `npx vitest run tests/lib/authRedirects.test.ts tests/pages/auth.route-behavior.test.tsx tests/pages/pricing.route-behavior.test.tsx` passed from `frontend/`.
- `npx eslint pages/auth.tsx lib/authRedirects.ts features/pricing/paths.ts features/pricing/components/PricingRouteContent.tsx features/billing/catalog.ts tests/lib/authRedirects.test.ts tests/pages/auth.route-behavior.test.tsx tests/pages/pricing.route-behavior.test.tsx pages/api/admin/pricing/plan-offers/create.ts pages/api/admin/pricing/plans/create.ts` passed from `frontend/`.
- `npm -C frontend run billing:launch-readiness -- --base-url https://www.shortpulse.ai` passed 8 checks with 1 existing Stripe webhook proof warning.
- `node scripts/check_supabase_auth_signup_config.mjs --help` passed.

## Stop Condition

Stop after this fix and report unless a fresh current-repo or hosted-production proof shows a remaining path where an unpaid/free account can receive credits, run paid provider work, upload free storage after the migration, access another user's credits/media/projects/billing, or create accounts despite an explicitly approved provider-level signup shutdown.
