# AI Studio Inpaint Reference Contract Phase 2: Current-State Audit And Guardrails Plan (2026-04-14)

Status: Planned  
Owner: Engineering

## Goal
Translate the contract decision into repo-backed implementation guardrails and close any remaining ambiguity about the current runtime seams, doc drift, and shared-lane regression risks.

## Scope
Phase 2 focuses on the current implementation surfaces that govern:
1. prompt token parsing and compilation,
2. prompt authoring affordances (`@` picker and drag-to-insert),
3. linked reference-input construction and `referenceInputsMode`,
4. inpaint submit dispatch,
5. provider payload assembly,
6. preflight URL normalization:
   - blob/data upload,
   - signed URL refresh,
   - base/mask preparation,
7. effective model id usage in the Edit panel,
8. cost override and polling-provider selection,
9. durable doc drift against the current runtime.

## Required Audit Outputs
1. Confirm the authoritative files for:
   - token parsing and figure-map compilation,
   - token picker and drag insertion,
   - submission-preparation reference assembly,
   - inpaint submit override construction,
   - final inpaint payload assembly,
   - preflight upload/refresh normalization,
   - mask export geometry and object-url lifecycle,
   - resolution/aspect option derivation,
   - cost override and polling-provider wiring.
2. Record the exact current runtime facts that later phases must preserve or replace:
   - active generic submit/status route usage,
   - current lack of resolution field in the FLUX Fill payload,
   - current hidden-model debit/polling behavior,
   - current prompt authoring affordances,
   - current stale durable doc claims.
3. Record the exact guardrails for the chosen contract:
   - what must be blocked,
   - what must be hidden,
   - what must be stripped,
   - what must be transmitted,
   - what must be test-covered,
   - what docs must be updated.
4. Record the shared orchestration seams that must remain lane-aware so standard edit behavior is not accidentally regressed.

## Deliverables
1. file-level implementation map for later phases,
2. explicit guardrails for prompt authoring, payload, preflight, mask, billing/polling, and UI layers,
3. a doc-drift inventory for the durable docs touched by this program,
4. no unresolved ambiguity around which code paths own the chosen contract.

## Non-Goals
1. No provider-lane replacement in this phase.
2. No UI or payload behavior changes in this phase.
3. No doc edits yet beyond the planning set itself.

## Entry Criteria
1. Phase 1 contract is locked.
2. The current repo audit remains consistent with the chosen direction.

## Exit Criteria
1. Every contract-relevant seam has an identified owner file or hook.
2. Later phases have a stop-rule for shared-lane regressions.
3. There is no ambiguity about why the current `2K` inpaint selector state is wrong.
4. There is no ambiguity about why linked secondaries are currently dropped from the final inpaint payload.
5. There is no ambiguity about how preflight currently prepares images that inpaint may later drop.
6. There is no ambiguity about how debit, polling-provider, and route docs would change if the inpaint model changes.
7. There is no ambiguity about which durable docs are currently stale.

## Validation
1. Reconcile the contract against the current payload builder and model registry/catalog definitions.
2. Reconcile the contract against the current generic submit/status route usage.
3. Reconcile the contract against the current Edit panel resolution/aspect derivation path.
4. Reconcile the contract against the current preflight upload/refresh path.
5. Reconcile the contract against the current mask export path.

## Rollback Note
If Phase 2 exposes unresolved architectural ambiguity, do not begin implementation. Publish the ambiguity and rescope instead.
