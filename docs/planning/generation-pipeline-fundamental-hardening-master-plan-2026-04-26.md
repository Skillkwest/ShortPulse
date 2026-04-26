# Generation Pipeline Fundamental Hardening Master Plan (2026-04-26)

Last updated: 2026-04-26  
Status: Planning ready  
Owner: Engineering

## Purpose
This is the execution contract for the smallest repo-backed hardening program that materially strengthens the generation pipelines without intended UI, UX, or external behavior changes.

## Program Contract
This program exists only to harden fundamental pipeline trustworthiness.

The work is in scope only if it improves one of these areas:
1. direct-submit post-accept recoverability
2. `terminal_success_no_media` consistency across terminal paths
3. recoverable observation handling for `missing_generation`
4. durable owned/generated media authority
5. canonical output-slot convergence and repair
6. direct proof for the weak branches that guard the items above

If a proposed task does not improve one of those six areas, it is out of scope.

## Constraints
1. No intended UI changes.
2. No intended UX changes.
3. No intended route-contract or payload changes unless explicitly approved later.
4. No invented work for the sake of cleanup.
5. No fallback retirement unless it is directly required to close an in-scope defect.
6. No structural refactor justified only by file size.

## Repo-Backed Problem Set
| Area | Repo-backed issue | Primary surfaces |
| --- | --- | --- |
| Submit recoverability | Provider acceptance can outpace durable local recoverability. | `frontend/lib/server/api/falSubmitProxy.ts` |
| No-media terminal policy | Status and recovery do not currently share one `terminal_success_no_media` policy. | `frontend/lib/server/api/falStatusProxy.ts`, `frontend/lib/server/falIntegration/recoveryExecution.ts` |
| Observation loss | Recoverable terminal evidence can be downgraded to ignored `missing_generation`. | `frontend/lib/server/generationControlPlane/observationBatchExecution.ts` |
| Durable media authority | Transient provider or signed URLs can still act like canonical durable media authority. | `frontend/lib/server/api/directGenerationSettlement.ts`, `frontend/lib/server/falIntegration/recoveryExecution.ts`, `frontend/lib/server/elevenlabs.ts` |
| Output-slot convergence | Output, media, publication, and projection state still require repeated repair glue. | `frontend/lib/server/api/generationOutputs.ts`, `frontend/lib/server/falIntegration/recoveryMediaPersistence.ts`, `frontend/pages/api/media/copy-from-url.ts` |
| Weak proof | A few high-risk branches are weaker than the surrounding proof baseline. | see authority/proof inventory |

## Program Artifacts
| Artifact | Role |
| --- | --- |
| `docs/planning/generation-pipeline-fundamental-hardening-tracker-2026-04-26.md` | Compact execution tracker and gate surface |
| `docs/planning/generation-pipeline-fundamental-hardening-done-state-and-stop-rules-2026-04-26.md` | Final stopping point and reporting contract |
| `docs/planning/generation-pipeline-fundamental-hardening-authority-and-proof-inventory-2026-04-26.md` | Scope justification and proof baseline |
| `docs/planning/generation-pipeline-fundamental-hardening-phase-1-proof-and-characterization-plan-2026-04-26.md` | Direct proof for weak high-risk branches |
| `docs/planning/generation-pipeline-fundamental-hardening-phase-2-core-server-correctness-plan-2026-04-26.md` | Three core server correctness fixes |
| `docs/planning/generation-pipeline-fundamental-hardening-phase-3-durable-media-authority-plan-2026-04-26.md` | Current-write durable media authority normalization |
| `docs/planning/generation-pipeline-fundamental-hardening-phase-4-canonical-output-slot-convergence-plan-2026-04-26.md` | One canonical output-slot convergence path |

## Phase Sequence
1. Phase 1 proves the weak high-risk branches directly.
2. Phase 2 closes the three core server correctness gaps.
3. Phase 3 normalizes durable owned/generated media authority for current writes.
4. Phase 4 adds one canonical internal output-slot convergence path.
5. Stop if the done state is satisfied.

## Evidence And Validation Inputs
Use these as the baseline evidence surfaces for planning and validation:
1. `sql/check_generation_convergence_defect_classes.sql`
2. `sql/check_generation_pipeline_backfill_baseline.sql`
3. `scripts/replay_generation_convergence_backlog.ts`
4. `docs/sops/sop_generation_recovery_diagnostics.md`
5. targeted generation-pipeline tests under `frontend/tests/api/` and `frontend/lib/server/falIntegration/__tests__/`

## Non-Goals
These items are out of scope unless a new repo-backed fundamental defect forces them in:
1. trust-boundary behavior changes for AI Studio agent or Style Creator URL intake
2. project association semantic changes
3. client-state redesign beyond what is strictly required by the in-scope defects
4. file splitting or modularization for size/readability alone
5. broad compatibility retirement
6. docs cleanup unrelated to this hardening contract

## Done State Summary
This program is done when:
1. the weak high-risk branches are directly proven
2. the three core server correctness gaps are fixed
3. durable owned/generated media authority is internally storage-backed for current writes
4. one canonical internal output-slot convergence path exists
5. no intended external behavior changes were introduced
6. remaining work would be optional cleanup, not fundamental hardening

The full stop rules live in `docs/planning/generation-pipeline-fundamental-hardening-done-state-and-stop-rules-2026-04-26.md`.
