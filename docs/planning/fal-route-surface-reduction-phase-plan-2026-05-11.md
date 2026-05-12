# Fal Route Surface Reduction Phase Plan (2026-05-11)

## Purpose

Define the next model-platform phase after the `ModelModal` shared-metadata stop point. This phase is scoped to the remaining compatibility route surface under `frontend/pages/api/fal/`.

The goal is not to redesign provider routing. The goal is to reduce operator churn around queued Fal/Kie model onboarding and removal **without** changing public route behavior, client behavior, or runtime execution semantics.

## Current Assessment

The repo is in a materially better state than before:

- queued Fal/Kie models now use a shared route inventory in `scripts/lib/fal_route_inventory.js`
- route wrappers are generated through `scripts/sync_fal_route_wrappers.js`
- `model:doctor` and route-coverage tests already protect the catalog-to-route contract
- onboarding guidance now points operators at the inventory + sync workflow instead of hand-authoring wrappers

Even with that improvement, the repo still ships `35` files under `frontend/pages/api/fal/`:

- `34` generated submit/status compatibility wrappers
- `1` webhook route

That means same-family queued model churn is better than before, but the repo still carries a large compatibility file surface.

## Problem Statement

Queued Fal/Kie onboarding/removal is no longer blocked by duplicate route truth, but it still pays a maintenance tax because:

- the compatibility wrapper file surface is large
- route ownership is still visually spread across many files
- future contributors can still overestimate those wrappers as durable hand-maintained logic

The next phase should decide whether that surface should:

1. remain as generated compatibility artifacts with stronger ownership signaling
2. shrink through a smaller parameterized route layer
3. stay exactly as-is because compatibility risk outweighs the maintenance cost

## Non-Negotiable Constraints

- no route path changes in this phase unless explicitly planned as a separate compatibility migration
- no client contract changes
- no provider execution behavior changes
- no auth/billing behavior changes
- no queue URL or polling behavior changes
- no UI/UX changes

## Phase Goal

Make the queued Fal/Kie route surface clearly intentional and cheaper to maintain, while preserving all existing route behavior.

## What Is Already True

- `scripts/lib/fal_route_inventory.js` is the source of truth
- `scripts/sync_fal_route_wrappers.js` can regenerate the compatibility wrappers
- `frontend/tests/api/fal-route-inventory-regression.test.ts` locks expected file inventory
- `frontend/tests/api/model-catalog-route-coverage.test.ts` locks inventory alignment with active runtime catalog models
- `scripts/model_doctor.js` fails when the generated wrapper layer drifts

This phase should build on that, not start over.

## Recommended Execution Order

### Phase A: Ownership Hardening

Do not reduce route count yet.

1. make generated-wrapper ownership explicit in the generated files and/or regression checks
2. document that `frontend/pages/api/fal/*` wrappers are compatibility artifacts, not source-of-truth logic
3. ensure operators are directed to inventory + sync tooling first

Success:

- contributors can quickly tell those wrappers are generated compatibility files
- accidental hand-editing becomes less likely

### Phase B: Surface Classification

Inventory the remaining Fal route files by role:

1. generated submit/status wrappers
2. special-case non-generated routes like `webhook.ts`
3. any route shapes that would block parameterization

Success:

- the repo has a precise map of what is truly reducible versus what must remain distinct

Current classification:

1. **Generated compatibility wrappers**
   - `34` files
   - structure: `17` route families x `submit`/`status`
   - source of truth: `scripts/lib/fal_route_inventory.js`
   - generator: `scripts/sync_fal_route_wrappers.js`
   - current providers:
     - `12` Fal families
     - `5` Kie families
   - current validator shapes:
     - `13` generic
     - `2` `seedream-image`
     - `2` `seedream-edit`

2. **Distinct non-generated route**
   - `frontend/pages/api/fal/webhook.ts`
   - purpose: signed Fal webhook ingestion, payload verification, and reconciliation ingress
   - not a candidate for wrapper reduction because it is not a catalog-model compatibility route

3. **Wrapper variability that matters**
   - provider-specific route config import selection (`fal` vs `kie`)
   - validator selection (`generic`, `seedream-image`, `seedream-edit`)
   - optional `statusRouteLabel`
   - optional `reExportValidator` for the Seedream edit compatibility lane

4. **What is already effectively reduced**
   - route-owned business logic is already centralized in shared handlers:
     - `createFalSubmitHandler(...)`
     - `createFalStatusHandler(...)`
   - the public route files are now mostly compatibility modules generated from inventory data rather than handwritten logic

5. **What would block deeper reduction**
   - the Next.js pages router still maps public route paths to physical files
   - existing public route names are already consumed by the client/runtime contract
   - validator re-export behavior means at least one wrapper family exposes a small route-local compatibility seam
   - collapsing all wrappers into one dynamic route would be a route-architecture change, not just maintenance cleanup

### Phase C: Reduction Decision

Choose one of these outcomes explicitly:

1. **Keep generated wrappers**
   - strongest compatibility
   - lowest migration risk
   - acceptable if ownership/signaling is good enough
2. **Reduce wrapper count via a smaller parameterized route layer**
   - only if it can preserve existing route paths and route-specific invariants
   - should still keep compatibility aliases where needed
3. **Hybrid**
   - keep public wrapper files but make them thinner or generated from a smaller template boundary

This is the actual decision point for the phase. Do not jump to implementation before the decision is explicit.

Preliminary read after classification:

- the repo is already most of the way to the "keep generated wrappers" outcome
- the current wrapper files are thin enough that the remaining cost is mostly file-count and visual noise, not duplicated route logic
- any deeper reduction now looks more like a route-architecture decision than a straightforward operator-maintenance win

Decision:

- **Keep generated wrappers** as the intended ownership model for the current system phase.

Rationale:

- route-owned business logic is already centralized, so the remaining wrapper files are compatibility modules rather than duplicated route logic
- public route paths are already part of the client/runtime contract
- the Next.js pages router still makes physical files the lowest-risk compatibility boundary
- reducing wrapper count further would now be a route-architecture redesign, not a maintenance win

Implication:

- `frontend/pages/api/fal/*.ts` submit/status files should be treated as generated compatibility artifacts long-term unless a future explicit route-architecture phase replaces them
- route-count reduction is **not** a goal inside the current maintenance phase anymore

### Phase D: Guardrail Expansion

Whichever decision wins, lock it with:

1. stronger route-surface regression coverage
2. `model:doctor` checks for the chosen ownership model
3. doc/SOP updates for the operator workflow

Completed in the current phase:

- generated-wrapper ownership banners are enforced in the wrapper files
- `frontend/tests/api/fal-route-inventory-regression.test.ts` verifies generated-wrapper ownership markers
- `frontend/tests/api/model-catalog-route-coverage.test.ts` and `scripts/model_doctor.js` continue to lock inventory alignment and route-surface invariants
- operator docs now explicitly treat the wrappers as generated compatibility artifacts and the intended ownership model

## What Not To Do

- do not remove public route files casually
- do not collapse everything into a single dynamic route without proving compatibility and debuggability
- do not weaken route-local auth, billing, or payload validation contracts
- do not broaden this phase into direct-provider route cleanup
- do not change route paths just to make the codebase look cleaner

## Acceptance Criteria

This phase is successful when:

- the Fal/Kie wrapper surface has an explicit, durable ownership model
- same-family queued model onboarding/removal is clearly inventory-first
- route compatibility is preserved
- the remaining compatibility surface is either intentionally retained or safely reduced
- `model:doctor` and route regression checks enforce the chosen model

## Stop Rule

Stop this phase once:

- wrapper ownership is explicit
- the reduction decision is made and documented
- the resulting guardrails are in place

Current phase status:

- Phase A ownership hardening: complete
- Phase B surface classification: complete
- Phase C reduction decision: complete
- Phase D guardrail/doc alignment: complete
- phase outcome: complete enough to stop

Final outcome:

- keep the generated wrappers as the intentional long-term ownership model for the current system phase
- treat `frontend/pages/api/fal/*.ts` submit/status files as generated compatibility artifacts, not source-of-truth route logic
- defer any deeper route-count reduction to a future explicit route-architecture redesign phase only if it develops a stronger ROI than the current generated-wrapper model

At that point, any deeper route-architecture redesign should be treated as a separate system decision, not more of this maintenance phase.
