# 0068: Model Pricing Control Plane

## Status
Accepted

## Context

AI Studio model pricing was previously hard-coded in runtime modules:

- `frontend/lib/model-runtime/pricingStrategies.ts`
- `frontend/lib/model-runtime/pricingCredits.ts`

That kept UI estimates and server debits in parity, but it also meant operators could not change:

- credit conversion rate
- markup
- rounding policy
- per-model pricing adjustments

The admin pricing workspace already manages database-backed subscription, top-up, and storage catalog pricing. Model pricing needed the same operator surface without reintroducing estimate-vs-billing drift.

## Decision

Introduce a versioned model-pricing control plane:

- `model_pricing_policy_versions`
  - immutable policy documents
- `model_pricing_policy_runtime`
  - singleton pointer to active and last-known-safe versions
- `model_pricing_policy_events`
  - audit trail for apply and rollback mutations

Expose service-role-only RPCs:

- `get_active_model_pricing_policy()`
- `apply_model_pricing_policy(...)`
- `rollback_model_pricing_policy(...)`

Runtime pricing authority is now:

1. server billing resolves the active policy through the control-plane helper
2. authenticated AI Studio clients fetch the same active policy snapshot through `/api/pricing/model-policy`
3. `computeCostForModel(..., pricingPolicy)` uses that shared document for estimates and debits
4. billable UI surfaces render credits through a shared client adapter that fails closed when the active policy is unavailable
5. billable submit paths attach displayed billed-credit metadata so server billing can persist estimate-vs-debit observability

## Consequences

### Positive

- Admins can change model pricing without code edits.
- UI estimates and server billing stay on the same pricing document.
- Billable UI no longer needs to guess or silently fall back when pricing policy is unavailable.
- Rollback is fast and pointer-based instead of mutating history.
- Pricing changes are attributable by version, actor, and event time.
- Operators can review estimate-vs-debit mismatches from the admin generation trace surface instead of inferring drift from raw ledger rows.

### Negative

- Pricing now depends on a database-backed control plane instead of static constants alone.
- New schema, RPC, docs, and validation responsibilities were introduced.

## Notes

- Subscription/top-up/storage catalog pricing remains a separate control domain.
- Model pricing policy is versioned globally, not per profile/family.
- Billability still depends on route implementation. Model/workflow metadata can declare pricing authority intent, but an action is only truly billable when its server route settles through the shared generation-billing path.
