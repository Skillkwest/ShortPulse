# Billing Internal Comp Contracts and Admin Exempt Renewals Plan (2026-04-23)

Status: Planned  
Owner: Engineering

## Goal
Add a non-public, admin-managed recurring contract source that can grant `media`, `studio`, or `business` access without Stripe and still re-up monthly credits correctly.

## Why This Plan Exists
The current repo can manually align an account to a paid tier in the database, but that does not create a real recurring billing contract. For accounts without a live Stripe subscription, monthly credit renewals do not occur automatically.

This plan turns that gap into a bounded implementation lane with explicit stop rules.

## Current Repo Audit
The plan is grounded in the current billing/admin seams:

1. Stripe owns recurring renewals today.
   - `frontend/pages/api/billing/stripe/webhook.ts` grants monthly credits from `invoice.payment_succeeded`.
   - There is no internal recurring renewal path for non-Stripe contracts.

2. The schema is already close to the needed shape.
   - `sql/migrations/085_add_billing_plan_offers_and_subscription_contracts.sql` already created:
     - `billing_plan_offers`
     - `billing_subscription_contracts`
   - `billing_plan_offers` already supports hidden offers and nullable `stripe_price_id`.

3. The admin surface already has the right insertion point.
   - `frontend/features/admin/components/AdminSupportQueueSection.tsx` already shows selected-user billing context and manual support actions.
   - `frontend/features/admin/logic/useAdminUsersCreditsController.ts` already orchestrates admin diagnostics and mutation routes.

4. Diagnostics currently assume non-free paid access should map to Stripe.
   - `frontend/pages/api/admin/billing-diagnostics.ts` would currently misclassify valid internal comp contracts as missing Stripe state.

5. The credit ledger model is already idempotent enough for internal renewals.
   - `ai_credit_ledger` uniqueness on `(user_id, source, source_ref)` can protect internal monthly renewal grants from duplication.

6. The repo already has an internal scheduled-route pattern.
   - Existing internal control-plane routes can be copied for a billing renewal runner instead of inventing login-time side effects.

## What Previous Plans Missed
The earlier chat plans were directionally correct, but too generic in three ways:

1. They did not explicitly separate `plan tier`, `contract source`, and `admin role`.
2. They did not lock conflict behavior between a live Stripe contract and a manual internal override.
3. They did not treat renewal ownership as a first-class implementation phase even though that is the real blocker.

This rewritten plan corrects those gaps.

## Required Policy Decisions
These decisions should be locked before behavior-changing implementation:

1. Immediate grant behavior
   - When internal comp access is granted, does the account receive the current period's monthly credits immediately?
   - Recommended default: yes.

2. Revocation behavior
   - When internal comp access is revoked, does the account fall to `free` or restore another contract?
   - Recommended default: fall to `free` unless the admin explicitly chooses a different trusted path.

3. Stripe conflict behavior
   - If the user already has an active Stripe contract, should internal comp be blocked, replace it, or require an explicit takeover action?
   - Recommended default: require explicit takeover behavior in the admin route and UI copy.

4. Audit metadata
   - Should the grant record store operator identity and reason?
   - Recommended default: yes.

## Recommended Model
Use three separate concepts:

1. `plan tier`
   - `free`, `media`, `studio`, `business`

2. `contract source`
   - `stripe`
   - `internal_comp`

3. `offer`
   - current public acquisition offers
   - hidden internal-comp offers such as `business__internal_comp`

This preserves the public catalog while allowing valid non-Stripe recurring entitlement contracts.

## Phase 0: Policy Lock
Lock the product and operator behavior before coding.

### Deliverables
1. ADR for internal comp billing contracts.
2. Written defaults for:
   - immediate grant
   - revoke behavior
   - Stripe conflict behavior
   - audit fields
3. explicit done state and stop rule.

### Exit Criteria
1. `plan tier` vs `contract source` is explicit.
2. Renewal ownership is explicit for `stripe` vs `internal_comp`.
3. No unresolved ambiguity remains around grant/revoke/takeover behavior.

## Phase 1: Data Model
Extend the billing schema so internal comp contracts are first-class.

### Work
1. Add `contract_source` to `billing_subscription_contracts`.
2. Add audit fields appropriate for manual overrides:
   - `granted_by_user_id`
   - `grant_reason`
   - `updated_by_user_id`
3. Add hidden internal-comp offers for each supported paid tier.
4. Decide whether `billing_profiles` also needs a runtime projection of contract source.

### Exit Criteria
1. The schema can represent a paid account with no Stripe subscription.
2. The current contract row can identify whether renewal comes from Stripe or internal scheduling.
3. Historical contract changes remain auditable.

## Phase 2: Admin Mutation Path
Add a trusted admin-only route for grant/change/revoke.

### Work
1. Add an admin route for billing contract updates.
2. Validate:
   - target user
   - requested plan tier
   - requested contract source
   - takeover rules when a live Stripe contract exists
3. Upsert:
   - `billing_profiles`
   - the current `billing_subscription_contracts` row
4. Seed current-period monthly credits if the policy says grant is immediate.

### Exit Criteria
1. Admin can grant internal comp access without direct SQL edits.
2. Repeated requests do not duplicate initial period credit grants.
3. Manual overrides are recorded with operator context.

## Phase 3: Renewal Engine
Add the non-Stripe monthly renewal path.

### Work
1. Add an internal protected route such as `/api/internal/billing-contract-renewals/run`.
2. Scan active due `internal_comp` contracts.
3. Grant monthly credits idempotently using a period-derived `source_ref`.
4. Advance `current_period_start` and `current_period_end`.
5. Skip non-due contracts and all `stripe` contracts.

### Exit Criteria
1. Internal comp accounts re-up monthly credits without Stripe.
2. Duplicate runner execution is safe.
3. Renewal logic does not mint credits for the wrong contract source.

## Phase 4: Admin UX
Add the manual operator control to `/admin`.

### Work
1. Add a compact billing override panel in `AdminSupportQueueSection`.
2. Show:
   - current tier
   - contract source
   - recurring amount
   - monthly credits
   - next renewal date
3. Add actions:
   - grant internal comp
   - change internal comp tier
   - revoke internal comp
4. Add clear confirmation copy describing the consequences.

### Exit Criteria
1. Operators can manage internal comp access from the admin page.
2. The UI makes it obvious that the contract bypasses Stripe billing.
3. Accidental destructive overrides are guarded by confirmation and API validation.

## Phase 5: Diagnostics and Read Surfaces
Teach reads and diagnostics that internal comp is valid.

### Work
1. Extend `/api/admin/users` and admin types to expose contract source.
2. Update `/api/admin/billing-diagnostics` so missing Stripe state is only a problem for Stripe-owned contracts.
3. Show internal comp clearly in support surfaces and billing snapshots.
4. Verify account/profile/dashboard reads still resolve the plan correctly from the contract row.

### Exit Criteria
1. Internal comp accounts no longer appear broken in admin diagnostics.
2. Support can see whether a paid account is Stripe-backed or internally comped.
3. User-facing plan surfaces remain truthful.

## Phase 6: Docs, Operations, and Validation
Close the lane with operator-ready documentation and proofs.

### Work
1. Update:
   - `docs/sops/sop_billing_credits_operations.md`
   - `docs/product/billing-pricing-catalog.md`
   - `docs/data-dictionary.md`
   - `docs/supabase_full_schema.sql`
2. Add tests for:
   - admin grant
   - admin revoke
   - internal renewal due
   - internal renewal duplicate run
   - Stripe contract unaffected by internal renewal route
   - diagnostics behavior for internal comp
3. Add a scheduler configuration/runbook for the renewal route.

### Exit Criteria
1. The implementation is documented as a real operating model, not tribal knowledge.
2. Internal comp billing behavior is covered by targeted tests.
3. Operators have a repeatable recovery path for missed renewals.

## Done State
Stop when all of the following are true:

1. Admin can grant or revoke `media`, `studio`, or `business` as internal comp access from `/admin`.
2. The account resolves correctly across billing/profile/admin surfaces without requiring a live Stripe subscription.
3. Monthly credits re-up automatically for internal comp contracts.
4. Renewal grants are idempotent and source-scoped.
5. Admin diagnostics clearly distinguish `stripe` vs `internal_comp`.
6. Valid internal comp accounts do not trigger false Stripe drift failures.
7. Docs and tests cover the new operating model.

## Hard Stop Rule
When the done state is fully true, stop. Do not continue into annual plans, coupons, broader comp-program tooling, or public pricing UX changes unless a new explicit request reopens scope.

## Non-Goals
1. No new public plan tier.
2. No replacement of Stripe portal or Stripe-paid subscription flows.
3. No annual billing or promotional-code work in this lane.
4. No team-billing or seat-based access model in this lane.

## Validation
Before closing this plan, verify:

1. A valid internal comp account receives the expected monthly credits without Stripe.
2. A valid Stripe-paid account still renews only through the Stripe webhook path.
3. A user cannot end up with two conflicting current contracts.
4. Admin/support surfaces explain the source of paid access without ambiguity.

## Recommended Execution Order
1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6 and stop
