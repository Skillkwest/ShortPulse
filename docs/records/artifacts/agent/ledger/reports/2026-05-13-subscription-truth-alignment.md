# 2026-05-13 Subscription Truth Alignment

Purpose: retain the first substantive Ledger run covering recurring subscription truth alignment across public pricing, Stripe/Supabase support safety, and post-checkout projection.

## Report Metadata

- Date: 2026-05-13
- Lane: subscriptions
- Requested trigger phrase: recurring supervised billing work prior to formal Ledger setup
- Operator intent: make the public subscription experience truthful, safe, and supportable before finalizing plan pricing

## Starting State

- Public truth state:
  - public pricing cards and profile plan cards were not fully live-catalog driven
  - customer-facing auth/pricing/profile surfaces still leaked the hidden internal `free` tier
  - annual plan UI could present options that checkout could not actually sell
- Sellable catalog state:
  - live offers existed, but UI fallback logic could diverge from active acquisition offers
- Billing/runtime state:
  - Stripe customer repair could recreate or project paid users incorrectly
  - post-checkout profile state could remain stale until manual refresh
  - annual renewal behavior was split between Stripe webhook projection and the internal renewal worker
- Support/admin state:
  - diagnostics existed, but customer-id mismatch handling and operator-facing annual renewal clarity needed hardening

## Actions Taken

1. Corrected public truth:
   - moved pricing/profile subscription cards onto live catalog values
   - removed customer-facing hidden-`free` language
   - blocked unsellable annual plan actions
2. Hardened billing/runtime truth:
   - made Stripe customer repair contract-aware
   - synchronized repaired Stripe customer ids across profile and active contract surfaces
   - blocked silent test/live mismatch customer recreation
3. Hardened post-purchase truth:
   - added short-lived profile resync polling after checkout, plan-change, and storage add-on return flows
4. Hardened annual renewal and operator truth:
   - added annual monthly-credit-allocation coverage to the renewal worker tests
   - corrected docs describing the internal renewal worker
5. Closed the public acquisition telemetry gap:
   - added public pricing-page upgrade-click telemetry

## Validation

- Commands run:
  - `npx vitest run tests/pages/auth.route-behavior.test.tsx tests/pages/pricing.route-behavior.test.tsx tests/pages/profile.subscription-actions.test.tsx features/billing/__tests__/catalog.test.ts`
  - `npx vitest run tests/api/stripe-customer.test.ts tests/api/admin-billing-diagnostics.test.ts tests/api/admin-billing-customer-sync.test.ts tests/api/admin-billing-portal.test.ts tests/api/stripe-portal.test.ts`
  - `npx vitest run tests/pages/profile.route-state.test.tsx tests/pages/profile.storage-actions.test.tsx tests/pages/profile.subscription-actions.test.tsx tests/pages/profile.billing-actions.test.tsx`
  - `npx vitest run tests/api/internal-billing-contract-renewals-run.test.ts`
  - `npx vitest run tests/pages/pricing.route-behavior.test.tsx`
  - `git diff --check` on touched billing and docs files
- Live/manual checks:
  - local renewal route correctly returned `404` while disabled
  - production renewal route posture returned `401`, confirming enabled-and-protected state
  - working-development and staging Supabase projects showed no due annual allocations during the audit window
- Gaps or blockers:
  - no full real Stripe test-mode purchase walkthrough was completed in this run
  - no integrated automated subscription funnel test existed yet
  - production contract-row verification remained limited by available access

## Outcome

- Public truth result:
  - public pricing and profile subscription surfaces are materially closer to live sellable truth
  - customer-facing `free` language was removed from the targeted subscription surfaces
  - unsellable annual plan actions are blocked instead of routing into backend rejection
- Sellable catalog result:
  - recurring plan selection is better aligned with live offers
  - annual interval drift risk was reduced on the user-facing acquisition path
- Billing/runtime result:
  - Stripe customer repair is safer and contract-aware
  - profile state now self-refreshes after Stripe return flows
  - annual monthly-allocation behavior is test-locked in the repo
- Support/admin result:
  - billing diagnostics now expose Stripe customer mismatch more explicitly
  - renewal worker docs are clearer for operators
- Docs/index updates:
  - billing route docs, internal route docs, and agent/package indexes were updated as part of the lane

## Lessons Learned

- Durable lesson(s):
  - subscription truth-alignment work is most effective in this order: public truth, support/runtime safety, post-purchase sync, then annual ops verification
  - hidden internal `free` semantics can remain backend truth while public UX is cleaned up
  - Stripe customer repair is one of the highest-risk support surfaces and should be treated as a first-class verification lane
  - annual subscriptions in this repo are not fully “done” when webhook logic looks correct; the internal renewal worker must also be verified
- Tooling gap(s):
  - integrated end-to-end subscription funnel test still missing
  - deeper production annual-renewal verification still needs a stronger access path
- SOP/doc updates needed:
  - if Ledger keeps owning recurring subscription truth, add a recurring subscription checklist or rubric after a few more runs

## Follow-Ups

- Immediate next step:
  - run a real Stripe test-mode subscription walkthrough
- Deferred validation:
  - add and maintain an integrated automated subscription funnel test
  - verify production annual-renewal worker state through stronger SQL/admin access
- Remaining risk:
  - end-to-end subscription flow still lacks one full real purchase proof and one integrated automated proof
