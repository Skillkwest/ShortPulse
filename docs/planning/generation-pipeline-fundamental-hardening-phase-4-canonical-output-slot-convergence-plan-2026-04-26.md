# Generation Pipeline Fundamental Hardening Phase 4 Canonical Output-Slot Convergence Plan (2026-04-26)

Last updated: 2026-04-26  
Status: Not started  
Master plan: `docs/planning/generation-pipeline-fundamental-hardening-master-plan-2026-04-26.md`

## Goal
Introduce one canonical internal convergence path for output rows, media linkage, publication linkage, and projection repair.

## Problem Statement
The repo still has repeated places where the same output slot must be reconciled across:
1. canonical output row state
2. media linkage
3. publication linkage
4. projection state

That repeated reconciliation is the recurring defect seam behind drift between current writes, recovery, copy, and save flows.

## Required Canonical Outcome
The phase is successful only if the repo ends with one real internal convergence path that:
1. can reconcile one output slot idempotently
2. produces canonical output/media/publication/projection convergence for the in-scope flows
3. removes the need for the same repair logic to remain scattered across several current-write paths

## In Scope
1. canonical output/media/publication/projection repair for current writes and recovery flows
2. the smallest internal helper or path consolidation required to make that repair idempotent and authoritative
3. adoption in recovery/copy/save surfaces only where needed to close the real drift seam

## Primary Surfaces
1. `frontend/lib/server/api/generationOutputs.ts`
2. `frontend/lib/server/falIntegration/recoveryMediaPersistence.ts`
3. `frontend/pages/api/media/copy-from-url.ts`
4. any tightly related generation publication or projection helpers required to close the seam safely

## Out Of Scope
1. generalized persistence-layer redesign
2. broad projection simplification
3. compatibility retirement that depends on live-environment prevalence work
4. unrelated media-library cleanup
5. any abstraction that does not directly reduce the output-slot convergence seam

## Entry Gate
1. Phase 3 complete
2. durable owned-media authority shape for current writes is stable

## Deliverables
1. one canonical internal convergence path for the in-scope output slot state
2. adoption in the minimum set of current-write or recovery flows needed to close the seam
3. direct tests that prove the canonical path converges the slot idempotently

## Exit Gate
1. one canonical internal output-slot convergence path exists
2. the repeated convergence seam between output/media/publication/projection state is materially reduced
3. intended external behavior remains unchanged
4. no larger persistence redesign was introduced under the banner of convergence

## Validation
1. direct tests for the convergence path pass
2. targeted generation server/control-plane slices pass
3. diagnostics relevant to convergence are unchanged or improved

## Failure Conditions
Do not close this phase if:
1. convergence still depends on materially different repair paths for the same output slot shape
2. the phase only wraps existing drift in a new helper without reducing the real seam
3. persistence architecture was broadened beyond what was required to close the in-scope defect

## Stop Rule
At the end of this phase, evaluate the master done state. If the done state is satisfied, stop the program instead of opening additional cleanup work.
