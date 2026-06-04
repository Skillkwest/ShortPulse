# Plan-Based Per-User Concurrency Execution Plan

Status: implemented  
Owner: Runtime and Money  
Last updated: 2026-06-04

## Objective

Implement plan-based per-user concurrency limits so each authenticated user is admitted according to the concurrency entitlement of their current paid plan or non-public baseline runtime state.

Target public contract:

- `starter`: `1`
- `media`: `2`
- `studio`: `4`
- `business`: `8`

This plan was used for the implementation pass that added server-resolved plan concurrency entitlements.

## Stop Condition

This planning lane is complete when:

1. the canonical entitlement model is chosen,
2. the exact schema, runtime, UX, admin, and test changes are mapped to owning files,
3. rollout phases and temporary migration scaffolding are explicit,
4. validation gates and telemetry checks are defined, and
5. the remaining open questions are small enough that implementation can proceed without revisiting architecture.

Do not continue into implementation from this document alone if a new product decision rewrites the public contract away from `1 / 2 / 4 / 8`.

## Current Repo Truth

### Billing truth

- Public sellable plan truth is versioned through `billing_plan_offers`, not through pricing-card copy, in [frontend/lib/server/api/billingCatalog.ts](../../frontend/lib/server/api/billingCatalog.ts).
- Subscriber-specific recurring commercial truth is versioned through `billing_subscription_contracts` in [sql/create_billing_credit_tables.sql](../../sql/create_billing_credit_tables.sql).
- `billing_profiles` is still a runtime projection and fallback seam, not the durable commercial contract.
- The legacy `free` database id still exists as non-public baseline runtime state and downgrade destination in [frontend/pages/api/billing/subscription/change.ts](../../frontend/pages/api/billing/subscription/change.ts) and [frontend/pages/api/billing/stripe/webhook.ts](../../frontend/pages/api/billing/stripe/webhook.ts). It is not a customer-facing plan.

### Admission truth

- Reservation-time admission already exists in the canonical billing path through `reserveGenerationCredits(...)` and the `admit_and_reserve_generation_credits` RPC in [frontend/lib/server/api/generationBilling.ts](../../frontend/lib/server/api/generationBilling.ts) and [sql/migrations/032_admit_and_reserve_generation_credits.sql](../../sql/migrations/032_admit_and_reserve_generation_credits.sql).
- Fal submit routes also run a richer active-capacity admission check using real reserved work plus generation state in [frontend/lib/server/api/generationAdmission/activeProviderCapacity.ts](../../frontend/lib/server/api/generationAdmission/activeProviderCapacity.ts) and [frontend/lib/server/api/generationAdmission/generationAdmissionService.ts](../../frontend/lib/server/api/generationAdmission/generationAdmissionService.ts).
- Current limits are shared runtime flags, not plan entitlements:
  - global max `4`
  - `video_long=2`
  - `image_heavy=3`
  - `image_standard=4`
  in [frontend/lib/server/api/generationAdmission/generationAdmissionPolicy.ts](../../frontend/lib/server/api/generationAdmission/generationAdmissionPolicy.ts).

### Customer messaging truth

- Card concurrency copy in [frontend/features/billing/catalog.ts](../../frontend/features/billing/catalog.ts) is presentation-only today.
- Current limit-hit copy is generic `Too many active generations` / `You already have too many active generations` in [frontend/lib/generationAdmissionErrors.ts](../../frontend/lib/generationAdmissionErrors.ts).

## Chosen Architecture

### Decision

Make concurrency a versioned billing entitlement:

1. define it on `billing_plan_offers`,
2. snapshot it onto `billing_subscription_contracts`,
3. resolve the user's effective entitlement server-side,
4. enforce it in the existing reservation gate and Fal admission gate,
5. keep shared-provider and modality caps as internal protection layers.

### Why this is the correct seam

- It matches the repo's commercial model: offers for acquisition truth, contracts for subscriber truth.
- It supports grandfathering naturally if future offers change.
- It works per user and per plan without trusting client state.
- It avoids creating a second concurrency authority in card copy or env flags.
- It keeps provider-protection logic separate from the customer contract.

## Explicit Non-Goals

- Do not make pricing cards the legal source of concurrency truth.
- Do not expose provider-specific modality caps as the main public contract.
- Do not replace shared-provider admission or recovery backpressure.
- Do not remove the legacy baseline database id in this lane.
- Do not redesign queue/recovery architecture in this lane.

## Exact Entitlement Model

### Public contract

- `starter`: `1 active generation`
- `media`: `2 active generations`
- `studio`: `4 active generations`
- `business`: `8 active generations`

### Internal enforcement contract

- The public contract is a total active-slot cap.
- Internal tier/provider caps remain separate and may still deny work earlier for expensive lanes.
- Customer-visible messaging should distinguish:
  - `per_user` plan-slot exhaustion
  - `shared_provider` capacity pressure
  - `admission unavailable`

### What counts as active

Use the repo's existing active-work model rather than inventing a new one:

- reservation rows with `status='reserved'`
- linked generation lifecycle states `pending | submitted | running`
- stale queued/recovering rows continue using the current ignore rules in [frontend/lib/server/api/generationAdmission/activeProviderCapacity.ts](../../frontend/lib/server/api/generationAdmission/activeProviderCapacity.ts)

This keeps concurrency aligned with the actual submit/settlement lifecycle already used for billing.

## Detailed Build Plan

## Phase 0: Contract Freeze And Entry Gates

Goal:
- freeze product truth before code changes

Actions:
- treat `1 / 2 / 4 / 8` as the only approved public plan ladder
- use `0` active generation slots for the non-public baseline fallback runtime state

Recommendation:
- the baseline fallback is not a public plan and should not be able to generate

Important coupling:
- baseline fallback bootstrap now seeds `0` credits in `sql/create_billing_credit_tables.sql`
- baseline fallback concurrency is `0`
- treat future changes to baseline access as a product-access decision, not just an admission-limit tweak

Stop gate:
- do not implement until fallback-state behavior is explicitly chosen

## Phase 1: Schema And Catalog Contract

Goal:
- add concurrency to the commercial data model

Primary schema changes:

1. Add `max_concurrent_generations integer` to `billing_plan_offers`
2. Add `max_concurrent_generations integer` to `billing_subscription_contracts`

Why both:
- offers define current sellable truth
- contracts preserve subscriber snapshot truth

Do not add this field only to `billing_plans` unless a temporary migration bridge is absolutely required.

Files likely touched:

- `sql/create_billing_credit_tables.sql`
- new forward migration under `sql/migrations/`
- possibly a targeted repair/backfill SQL helper if production rows need explicit population

Backfill rules:

- current active offer rows:
  - `free__current`: `0`
  - `starter`: `1`
  - `media`: `2`
  - `studio`: `4`
  - `business`: `8`
- current open subscription contracts should snapshot from their resolved offer when possible
- for open contracts with missing or drifted offer linkage, backfill from current `plan_id` using a documented one-time repair path

Temporary migration scaffolding allowed:

- during rollout, resolver may use a documented legacy fallback if `max_concurrent_generations` is null
- removal condition: all active offers and open contracts populated, telemetry shows no entitlement fallback reads

## Phase 2: Server Entitlement Resolver

Goal:
- create one canonical server helper that answers "what concurrency limit does this user have right now?"

New helper responsibilities:

- load active `billing_subscription_contracts` row first
- if present, use `contract.max_concurrent_generations`
- otherwise load current plan state from `billing_profiles.plan_id`
- resolve the active current offer for that plan, even when it is not acquisition-enabled
- return:
  - `planId`
  - `offerId`
  - `contractId`
  - `maxConcurrentGenerations`
  - `source` (`contract`, `current_offer`, or temporary fallback)

Suggested location:

- `frontend/lib/server/api/` near billing contract helpers

Important rule:

- this helper is server-only
- client hooks like `useResolvedAccountPlan` remain display helpers, not enforcement authority

Failure behavior:

- if concurrency entitlement cannot be resolved safely after rollout scaffolding is removed, fail closed as `GENERATION_ADMISSION_UNAVAILABLE`
- do not silently invent a plan limit from card copy

## Phase 3: Reservation Gate Integration

Goal:
- make all billable generation routes enforce plan slots through the canonical reservation gate

Why this is the primary seam:

- OpenAI and ElevenLabs billable routes already depend on `chargeGenerationRequest(...)`
- Fal routes also start here before provider submit

Implementation work:

1. Extend the server charge path to resolve per-user concurrency entitlement before `reserveGenerationCredits(...)`
2. Pass the resolved `maxConcurrentGenerations` into the reservation RPC as `p_global_max`
3. Preserve current tier-based admission inputs for internal provider protection

Files likely touched:

- `frontend/lib/server/api/generationBilling.ts`
- `frontend/lib/server/api/generationBilling/reservationRpcAdapter.ts`
- `sql/migrations/032_admit_and_reserve_generation_credits.sql` only if the RPC contract needs more explicit entitlement metadata

Important nuance:

- reservation admission is currently user-scoped and counts `reserved` rows only
- that is acceptable as the cross-provider base gate because all billable generation paths reserve first

## Phase 4: Fal Active-Capacity Admission Alignment

Goal:
- keep Fal's richer admission logic aligned with the same plan entitlement

Implementation work:

1. Resolve the user's plan concurrency limit before calling `evaluateScopedGenerationAdmission(...)`
2. Use the resolved plan limit as the user-scoped `globalMax`
3. Keep shared-provider admission on its own ceiling
4. Keep tier caps and recovery backpressure unchanged unless later telemetry proves they conflict with the new public contract

Files likely touched:

- `frontend/lib/server/api/falSubmitProxy.ts`
- `frontend/lib/server/api/generationAdmission/generationAdmissionService.ts`

Key rule:

- there must not be one per-user concurrency number in the reservation gate and a different one in Fal submit

## Phase 5: Admin And Catalog Wiring

Goal:
- make concurrency part of the real pricing/admin control plane

Implementation work:

1. include `max_concurrent_generations` in:
  - `loadBillingCatalogSnapshot`
  - admin pricing state payload
  - admin plan creation
  - admin plan-offer activation
2. ensure new public plans cannot be created without explicit concurrency
3. ensure current pricing-state surfaces expose the field for operator verification

Files likely touched:

- `frontend/lib/server/api/billingCatalog.ts`
- `frontend/pages/api/admin/pricing/state.ts`
- `frontend/pages/api/admin/pricing/plans/create.ts`
- `frontend/pages/api/admin/pricing/plan-offers/create.ts`
- admin pricing client state/types under `frontend/features/admin/`

Design recommendation:

- operator-facing label should be `Max active generations`
- keep it plan-level, not modality-split

## Phase 6: Customer Experience

Goal:
- make limit behavior understandable without turning pricing cards into infrastructure copy

V1 required UX:

1. limit-hit API response stays deterministic
2. plan-aware error copy for `per_user`
3. preserve distinct copy for `shared_provider`
4. optional top-notice or local warning surface in AI Studio when blocked

Files likely touched:

- `frontend/lib/generationAdmissionErrors.ts`
- any AI Studio submit hooks already parsing admission errors
- any AI Studio surface that displays top notices or blocking messages

Recommended copy shape:

- `Starter includes 1 active generation at a time. Wait for the current job to finish before starting another.`
- `Studio includes up to 4 active generations at a time. Wait for one to finish or upgrade for more capacity.`

V2, separate but planned:

- exact disclosure in comparison table
- FAQ/help explanation of "active generation"
- in-product status indicator such as `2 of 4 active`

## Phase 7: Test Plan

Goal:
- verify contract, resolver, enforcement, and messaging across providers

Required test lanes:

1. SQL / RPC behavior
  - reservation deny at plan limit
  - reservation allow below plan limit
  - idempotent behavior unchanged

2. Server unit/integration
  - entitlement resolver: contract path
  - entitlement resolver: fallback-offer path
  - entitlement resolver: temporary fallback path
  - generation billing reservation path uses resolved limit
  - Fal submit path uses same resolved limit

3. API route coverage
  - OpenAI image route plan-limited
  - ElevenLabs route plan-limited
  - Fal submit route plan-limited
  - shared-provider pressure still returns `admissionScope: "shared_provider"`

4. UI/message coverage
  - client error parsing remains correct
  - plan-aware message rendering

Likely existing test seams to extend:

- `frontend/tests/api/generation-billing.reservations.test.ts`
- `frontend/tests/api/fal-submit-proxy.test.ts`
- `frontend/lib/server/api/generationAdmission/__tests__/generationAdmissionService.test.ts`
- `frontend/lib/__tests__/falClient.admission-limit.test.ts`
- `frontend/lib/__tests__/openAiImageClient.admission-limit.test.ts`
- admin pricing tests

## Phase 8: Rollout Strategy

Goal:
- land the entitlement system without breaking live generation paths

Recommended rollout order:

1. schema + backfill
2. admin/catalog payload wiring
3. server entitlement resolver with telemetry only
4. reservation gate uses resolved limit with temporary fallback enabled
5. Fal per-user admission uses resolved limit
6. customer-facing plan-aware messages
7. remove temporary entitlement fallback after telemetry proves full population

Telemetry to add:

- `plan_id`
- `contract_id`
- `offer_id`
- `max_concurrent_generations`
- `entitlement_source`
- `admission_scope`
- active-count snapshot when denied

Removal condition for temporary fallback:

- all active offers populated
- all open contracts populated or intentionally exempted
- no fallback reads during a stable validation window

## Key Risks And How To Handle Them

### Risk 1: `Business = 8` is undercut by hidden provider caps

Why:
- current internal tier caps are still `2 / 3 / 4` by modality class

Mitigation:
- keep the public contract as total active slots
- run a pre-implementation ops review of tier caps and shared-provider ceilings
- do not promise `8` operationally if internal provider caps make routine `8`-slot usage impossible

### Risk 2: fallback runtime users have no contract row

Why:
- fallback users rely on `billing_profiles` and hidden `free`

Mitigation:
- explicitly support `current_offer` resolution for non-contracted users
- do not rely on acquisition-enabled offers only

### Risk 3: OpenAI/ElevenLabs and Fal drift apart

Why:
- OpenAI and ElevenLabs rely on reservation admission only
- Fal uses reservation plus active-capacity admission

Mitigation:
- one entitlement resolver
- one per-user slot number
- explicit tests across provider families

### Risk 4: schema rollout drift

Why:
- repo bootstrap SQL, hosted production state, and migrations have drifted before

Mitigation:
- ship a dedicated forward migration
- update bootstrap SQL in the same implementation lane
- validate admin pricing state and live billing catalog after schema cutover

## Resolved Build Decisions

1. The non-public baseline fallback runtime state gets `0` active generation slots.
2. Baseline fallback state is not allowed to generate.
3. Bootstrap baseline credits are `0`.
4. V1 limit messages return plan-aware slot metadata and customer-readable wait/access copy.
5. Admin pricing exposes max active generations in plan and offer creation/editing.

## Execution Checklist

- [ ] Confirm fallback runtime entitlement decision
- [ ] Add offer + contract concurrency fields via migration
- [ ] Backfill current offers and open contracts
- [ ] Update bootstrap SQL
- [ ] Build server entitlement resolver
- [ ] Thread entitlement into reservation gate
- [ ] Thread entitlement into Fal user admission gate
- [ ] Wire admin/catalog payloads
- [ ] Update plan-aware limit messaging
- [ ] Add tests across OpenAI, ElevenLabs, and Fal
- [ ] Add telemetry for entitlement source and slot limit
- [ ] Verify fallback reads drop to zero
- [ ] Remove temporary entitlement fallback

## Confidence Audit

This plan is strong enough for autonomous implementation because it now specifies:

- the canonical authority seam,
- the exact data model additions,
- the runtime integration points,
- the provider-family differences,
- the rollout scaffolding,
- the validation surfaces,
- and the resolved baseline fallback product-access decision.
