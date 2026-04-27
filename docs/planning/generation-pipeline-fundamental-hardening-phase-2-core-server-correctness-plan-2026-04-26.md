# Generation Pipeline Fundamental Hardening Phase 2 Core Server Correctness Plan (2026-04-26)

Last updated: 2026-04-26  
Status: complete  
Master plan: `docs/planning/generation-pipeline-fundamental-hardening-master-plan-2026-04-26.md`

## Goal
Close the three core server correctness gaps and nothing more:
1. post-accept direct-submit recoverability
2. `terminal_success_no_media` consistency
3. recoverable observation loss on `missing_generation`

## Problem Statement
Three correctness gaps remain fundamental:
1. provider acceptance can happen before the repo guarantees durable local recoverability
2. the same `terminal_success_no_media` condition does not currently converge to one consistent server policy across the in-scope terminal lanes
3. recoverable provider evidence can be lost when observation processing downgrades `missing_generation` to ignored

Until those are fixed, the pipeline can still accept work that it cannot reliably recover or reconcile.

## In Scope
1. `frontend/lib/server/api/falSubmitProxy.ts`
2. `frontend/lib/server/api/falStatusProxy.ts`
3. `frontend/lib/server/falIntegration/recoveryExecution.ts`
4. `frontend/lib/server/generationControlPlane/observationBatchExecution.ts`
5. the smallest related helpers required to close those three gaps safely

## Acceptable Repair Shapes
1. direct-submit recoverability can be fixed by guaranteeing durable local state before returning accepted success, or by repairing that state synchronously before the route completes
2. `terminal_success_no_media` consistency can be fixed by routing the status path through the same recovery policy or by extracting one shared policy surface
3. `missing_generation` handling can be fixed by keeping the observation retryable, replayable, or otherwise recoverable instead of terminally ignored

## Out Of Scope
1. queue redesign
2. broad recovery refactors
3. compatibility retirement
4. client-side behavior cleanup
5. trust-boundary behavior changes

## Entry Gate
1. Phase 1 complete
2. weak branches for these areas are directly characterized

## Deliverables
1. code changes that close each of the three correctness gaps
2. direct tests that prove the corrected behavior
3. no route-contract or payload drift

## Exit Gate
1. accepted provider submit always leads to durable recoverability
2. `terminal_success_no_media` no longer forks by in-scope terminal path
3. recoverable `missing_generation` observations are not silently dropped
4. intended external behavior remains unchanged
5. no new competing lifecycle authority was introduced while fixing the gaps

## Execution Notes
Completed correctness work:
1. direct-submit acceptance now attempts synchronous local tracking repair before returning from the two post-accept degraded branches in `frontend/lib/server/api/falSubmitProxy.ts`
2. terminal success without media now routes through recovery execution in `frontend/lib/server/api/falStatusProxy.ts` instead of being failed inline on the polling path
3. `missing_generation` observation results now requeue to `pending` in `frontend/lib/server/generationControlPlane/observationBatchExecution.ts` instead of being silently downgraded to ignored

Updated direct proof:
1. `frontend/tests/api/fal-submit-proxy.test.ts`
2. `frontend/tests/api/fal-status-proxy.test.ts`
3. `frontend/lib/server/generationControlPlane/__tests__/observationBatchExecution.test.ts`

## Validation
1. direct tests for the changed correctness branches pass
2. targeted generation server/control-plane regression slices pass
3. any relevant diagnostics or route assertions are unchanged or improved

## Failure Conditions
Do not close this phase if:
1. one of the three defects is merely hidden behind a fallback instead of corrected
2. the fix depends on adding a second competing lifecycle authority
3. correctness improved only by changing user-visible behavior

## Stop Rule
Stop when the three correctness gaps are closed. Do not roll into cleanup or compatibility retirement.
