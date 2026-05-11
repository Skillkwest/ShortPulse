# ADR 0077: Paid Starter Tier With Hidden Free Default

Date: 2026-05-09

## Status
Accepted

## Context

ShortPulse pricing surfaces moved to a new four-card public ladder:

- `Starter`
- `Media`
- `Studio`
- `Business`

The existing billing system, however, still treats `free` as a real platform contract:

- default signup/bootstrap tier
- downgrade destination
- unpaid storage-gating tier
- baseline non-Stripe billing state

Repricing the existing `free` plan into a paid public tier would couple a commercial change to multiple billing-contract assumptions and make the rollout much riskier than necessary.

## Decision

Keep `free` as the hidden/default system tier and introduce `starter` as the real first paid public tier.

Implications:

1. Public pricing and account comparison surfaces should prefer `starter`, `media`, `studio`, and `business` when `starter` exists.
2. `free` remains the downgrade/cancel target and signup fallback.
3. Admin simulator defaults should seed from the public paid ladder when `starter` exists, without changing the admin pricing grid or model pricing control plane.
4. Stripe and Supabase catalog rollout should create real `starter` monthly and annual offers rather than overloading `free`.

## Consequences

Positive:

- preserves existing free-tier billing semantics
- reduces rollout risk for checkout, cancel, and storage-addon flows
- keeps the public four-tier ladder aligned with the pricing UI

Trade-offs:

- billing catalog now has a hidden system tier plus a public first paid tier
- some UI/filtering logic must distinguish public comparison plans from the full catalog
- internal comp support remains a separate decision if `starter` ever needs exempt-contract support

## Follow-up constraints

- Do not convert `free` into a paid acquisition offer as part of the catalog repricing rollout.
- Annual offer values must be stored as true yearly totals, not monthly-equivalent display values.
- Remove UI-only pricing overrides only after Stripe and Supabase become the single pricing source of truth.
