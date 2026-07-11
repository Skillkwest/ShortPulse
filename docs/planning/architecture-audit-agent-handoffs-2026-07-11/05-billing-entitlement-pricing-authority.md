# Next-Agent Handoff: Billing Entitlement And Pricing Authority

Lane id: `architecture-audit-05-billing-entitlement-pricing-authority`

Status: high ROI, but currently overlap-gated by active pricing and generation changes. Start after Lane 01 establishes webhook durability for any Stripe-derived state.

## Copy/Paste Assignment

Make billing decisions atomic, versioned, and explicit. Consolidate entitlement status semantics, close internal-credit and storage-quota races, and require price evidence before paid generation. Preserve current plans, prices, credits, and customer-visible behavior unless the user separately authorizes a product change.

## Required Context

Read first:

- `AGENTS.md` and the current startup spine
- `skills/skill-pricing-audit/SKILL.md`
- the current pricing wiring/audit skill used by this repo
- current pricing, credits, storage, and billing ADRs/SOPs
- Lane 01 and Lane 03 contracts

Inspect first:

- `frontend/lib/server/generationBilling.ts`
- `frontend/lib/server/api/falSubmitProxy.ts`
- `frontend/features/ai-studio/hooks/useActiveModelPricingPolicy.ts`
- current pricing policy, plan, model, workflow, account-limit, and storage-quota services
- current Style Preview save/submit paths and pricing drift checks
- SQL/RPCs that reserve, consume, refund, comp, or reconcile credits

## Confirmed Problems

- Different limits can produce inconsistent status vocabulary and response shape.
- Internal credit compensation can read then write without one atomic database operation.
- Storage quota admission can race across concurrent uploads.
- Price availability may be sampled from mutable state without a bounded version or compare-and-swap contract.
- Style Preview is recognized by current pricing classification work, but its paid save path still needs an explicit price-evidence/action handshake rather than relying on hidden auto-billing.

## Owned Write Surface

- shared entitlement/status resolver and response contract
- pricing evidence/version contract at admission
- internal compensation RPC and storage-quota reservation primitive
- Style Preview price disclosure and paid-action handshake
- focused billing, pricing, quota-concurrency, and status-parity tests
- related ADR/SOP/data dictionary updates

## Avoid Surface

- Stripe event ingestion and replay, owned by Lane 01
- durable provider-execution identity, owned by Lane 03
- model activation/retirement semantics, owned by Lane 11
- new plans, prices, promotions, or credit economics
- broad UI redesign

## Implementation Sequence

1. Inventory the canonical resolver for concurrency, workflow, account, and storage limits.
2. Define one typed status taxonomy and map old callers explicitly.
3. Bind generation admission to a versioned, bounded pricing snapshot.
4. Require explicit price evidence before Style Preview creates a billable action.
5. Replace read-then-write internal comp with one idempotent atomic RPC.
6. Serialize storage admission per user or use a reservation/counter primitive that cannot oversubscribe.
7. Add reconciliation and invariant checks without creating a second billing path.

## Acceptance Criteria

- Equivalent entitlement failures return equivalent status semantics.
- No concurrent internal-comp request can double-credit.
- Concurrent storage admissions cannot exceed the account limit.
- A billable request records the exact pricing version/evidence used for admission.
- Price changes cannot silently alter an already-admitted request.
- Style Preview displays/acknowledges price before a paid save or generation action.
- Existing successful billing, refund, and quota behavior remains covered.

## Validation And Proof

- Run the repo pricing audit and drift checks.
- Add database concurrency tests for comp and storage admission.
- Run focused billing/API/UI tests and targeted type checking.
- For SQL, follow Lane 00; local migration tests are not hosted proof.
- Production closure requires non-spend readback plus separately authorized minimal spend/refund proof if the user approves it.

## Stop Rules

- Stop if current pricing/generation files remain owned by another active batch.
- Do not change product economics to solve an implementation inconsistency.
- Do not add a fallback price or silently permit missing price evidence.
- Stop before hosted SQL, deploy, or provider spend without explicit authority.

