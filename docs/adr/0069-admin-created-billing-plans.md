# ADR 0069: Admin-Created Billing Plans

Date: 2026-04-24

## Status
Accepted

## Context

ShortPulse billing originally assumed a fixed plan set (`free`, `media`, `studio`, `business`) and only supported versioning public offers for those existing tiers. The admin pricing workspace needed to support creating a brand-new plan from `/admin/pricing` while keeping the existing separation between:

- `billing_plans` as the durable plan identity table
- `billing_plan_offers` as the versioned acquisition offer table

The live subscription system also depends on Stripe product/price linkage rather than DB-only pricing rows.

## Decision

Introduce admin-created plans as a first-class billing operation:

1. `/api/admin/pricing/plans/create` creates the new `billing_plans` row.
2. The same route creates the initial current `billing_plan_offers` row.
3. The route creates the Stripe product and recurring Stripe price before persisting the plan.
4. `billing_plans` stores:
   - `stripe_product_id`
   - `sort_order`
5. Existing plan-offer versioning remains a separate backend concept through `/api/admin/pricing/plan-offers/create`.

## Consequences

Positive:

- Operators can create new plan tiers from the admin pricing workspace without manual Stripe bootstrapping.
- Plan rendering is no longer restricted to the legacy fixed tier set.
- The billing catalog keeps the existing identity-vs-offer versioning split.

Trade-offs:

- Billing UI surfaces must support unknown/new plan ids with generic presentation defaults.
- Stripe Billing Portal remains an external dependency for live subscription-change visibility of newly created prices.
- Internal comp continues to be modeled separately and is not automatically widened to arbitrary new plans.

## Follow-up constraints

- Do not collapse `billing_plans` and `billing_plan_offers` into one mutable pricing table.
- Keep subscriber contracts locked to historical offer snapshots.
- Treat internal comp support for admin-created plans as a separate billing-contract decision.
