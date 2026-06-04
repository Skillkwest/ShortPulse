# Stripe Public Plan Truth Audit Request

Purpose: give Money Stuff one clean read-only request for reconciling current public plan-card pricing truth against Stripe, Supabase, and billing-runtime truth.

## Context

For this pass, treat the plan cards in `frontend/features/billing/catalog.ts` as the intended public product truth for pricing:

- `starter`: `$15`
- `media`: `$49`
- `studio`: `$129`
- `business`: `$299`

The immediate product question is whether Stripe and the live billing stack actually support that ladder, and where the repo still disagrees.

Concurrency product decisions are out of scope for this request. Concurrency truth is being evaluated separately at the product layer. Money Stuff should only report whether any Stripe, catalog, or billing-contract source currently backs plan-specific concurrency claims.

## Scope

Read-only audit only unless the user explicitly authorizes billing/catalog changes after review.

## Request

Please do a Stripe-and-billing truth audit for the current public subscription ladder.

### 1. Public sellable truth

For each public plan (`starter`, `media`, `studio`, `business`), confirm:

- whether it exists in Stripe
- Stripe product id
- active monthly price id and amount
- active annual price id and amount, if any
- whether each offer is acquisition-enabled in the app/billing catalog
- whether checkout would currently charge the card-price amounts we intend

### 2. Supabase and catalog truth

For each plan, confirm the live values in:

- `billing_plans`
- current acquisition rows in `billing_plan_offers`

Please report:

- `plan_id`
- display name
- recurring price
- monthly credits
- storage limit
- billing interval
- Stripe price id linkage
- acquisition-enabled state

### 3. Seed and docs drift

Check whether these repo/source surfaces are stale relative to the intended card truth:

- `docs/product/billing-pricing-catalog.md`
- `sql/create_billing_credit_tables.sql`
- any live/admin pricing state that still reflects the older ladder

I want an exact mismatch list, not just a yes/no.

### 4. Free-plan contract reality

Confirm whether `free` still exists in:

- Stripe product or price configuration
- `billing_plans`
- current offer rows
- downgrade and cancel runtime behavior
- signup fallback behavior

We need a precise statement of whether `free` is still an active commercial or billing dependency or just legacy residue.

### 5. Concurrency backing check

The cards currently say:

- `starter`: `1 image`
- `media`: `2 audio / 2 image / 1 video`
- `studio`: `4 audio / 3 image / 2 video`
- `business`: `6 audio / 4 image / 3 video`

Please verify only whether any Stripe, catalog, entitlement, or admin source actually defines plan-specific concurrency entitlements, or whether this is only UI copy with no billing/catalog backing. If it is only UI copy, say that clearly.

Do not make a recommendation here about what the concurrency limits should be. We only need the factual billing/source-of-truth answer from your lane.

### 6. Additional clarifications needed

Please also answer these so we can make a clean product decision:

- Is this audit using Stripe production mode, Stripe test mode, or both?
- If production and test differ, give both ladders separately instead of collapsing them.
- Are there any legacy Stripe prices still acquisition-enabled or still reachable through checkout or portal flows even if they are no longer intended?
- Are there existing subscribers on grandfathered recurring prices that would make the public card ladder different from the acquisition ladder for new customers?
- If `starter` does not exist as a real sellable Stripe plan in some environments, what exact plan id or price currently handles first-time paid acquisition?
- Do monthly and annual offers map cleanly to the same public plan ids, or are there environment-specific exceptions or stale offer rows?

### 7. Recommendation closeout

At the end, please give:

- the exact public price ladder that is truly sellable today
- the exact plan, credits, and storage ladder that is truly wired today
- whether concurrency claims are backed by billing/catalog truth or are currently presentation-only
- the minimum set of docs, catalog, Stripe, and runtime changes needed to make these four truths align:
  - public truth
  - commercial truth
  - billing/runtime truth
  - support truth

## Expected output format

Please prefer:

1. evidence table by plan
2. mismatch list
3. risks to customer trust or checkout correctness
4. minimum safe remediation path

## Relevant repo references

- `frontend/features/billing/catalog.ts`
- `frontend/lib/server/api/billingCatalog.ts`
- `frontend/pages/api/billing/catalog.ts`
- `frontend/pages/api/billing/subscription/change.ts`
- `frontend/pages/api/billing/stripe/webhook.ts`
- `frontend/pages/api/admin/pricing/state.ts`
- `docs/product/billing-pricing-catalog.md`
- `docs/sops/sop_billing_credits_operations.md`
- `sql/create_billing_credit_tables.sql`
