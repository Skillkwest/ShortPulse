# ADR 0077: Paid Starter Tier With Baseline Access Sentinel

Date: 2026-05-09

## Status

Accepted; constrained by `docs/adr/0095-account-first-signup-intent-gate.md`

ADR 0095 makes the product language stricter: ShortPulse has baseline access,
not a free plan. Any `free` references in this ADR describe only the legacy
database id for the non-public baseline-access sentinel. That sentinel must not
be exposed, sold, acquisition-enabled, or recreated as a customer-facing plan,
trial, subscription, or paid entitlement.

## Context

ShortPulse pricing surfaces moved to a new four-card public ladder:

- `Starter`
- `Media`
- `Studio`
- `Business`

The existing billing system, however, still contains the legacy `free` database
id as a non-public baseline-access sentinel for:

- default signup/bootstrap tier
- downgrade destination
- unpaid storage-gating tier
- baseline non-Stripe billing state

Repricing or exposing the legacy `free` database id as a paid public tier would
couple a commercial change to multiple billing-contract assumptions and make the
rollout much riskier than necessary.

## Decision

Keep the legacy `free` database id as a non-public baseline-access sentinel and
introduce `starter` as the real first paid public tier.

Implications:

1. Public pricing and account comparison surfaces should prefer `starter`, `media`, `studio`, and `business` when `starter` exists.
2. The legacy `free` database id remains the zero-value downgrade/cancel target
   and signup fallback for baseline access.
3. Admin simulator defaults should seed from the public paid ladder when `starter` exists, without changing the admin pricing grid or model pricing control plane.
4. Stripe and Supabase catalog rollout should create real `starter` monthly and annual offers rather than overloading `free`.

## Consequences

Positive:

- preserves existing baseline-access sentinel semantics
- reduces rollout risk for checkout, cancel, and storage-addon flows
- keeps the public four-tier ladder aligned with the pricing UI

Trade-offs:

- billing catalog now has a non-public baseline-access sentinel plus a public
  first paid tier
- some UI/filtering logic must distinguish public comparison plans from the full catalog
- internal comp support remains a separate decision if `starter` ever needs exempt-contract support

## Follow-up constraints

- Do not convert the legacy `free` database id into a paid acquisition offer or
  customer-facing plan as part of the catalog repricing rollout.
- Annual offer values must be stored as true yearly totals, not monthly-equivalent display values.
- Remove UI-only pricing overrides only after Stripe and Supabase become the single pricing source of truth.
