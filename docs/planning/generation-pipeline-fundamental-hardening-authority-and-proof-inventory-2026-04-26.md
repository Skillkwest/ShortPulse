# Generation Pipeline Fundamental Hardening Authority And Proof Inventory (2026-04-26)

Last updated: 2026-04-26  
Status: Planning baseline  
Master plan: `docs/planning/generation-pipeline-fundamental-hardening-master-plan-2026-04-26.md`

## Purpose
This inventory is the scope justification for the hardening program. It records the exact authority seams and weak proof areas that justify the work.

## In-Scope Authority Seams
| Area | Repo-backed issue | Primary surfaces | Why it matters |
| --- | --- | --- | --- |
| Direct-submit recoverability | Provider acceptance can outpace durable local recoverability. | `frontend/lib/server/api/falSubmitProxy.ts` | Accepted generations must stay recoverable or the pipeline is not trustworthy. |
| No-media terminal handling | Status and recovery do not currently share one `terminal_success_no_media` policy. | `frontend/lib/server/api/falStatusProxy.ts`, `frontend/lib/server/falIntegration/recoveryExecution.ts` | Terminal lifecycle truth must not fork by path. |
| Observation loss | Recoverable terminal evidence can be downgraded to ignored `missing_generation`. | `frontend/lib/server/generationControlPlane/observationBatchExecution.ts` | Silent loss of terminal evidence is a correctness defect. |
| Durable media authority | Transient provider or signed URLs can still act like canonical durable authority. | `frontend/lib/server/api/directGenerationSettlement.ts`, `frontend/lib/server/falIntegration/recoveryExecution.ts`, `frontend/lib/server/elevenlabs.ts` | Durable outputs should remain durable after transient URLs expire. |
| Output-slot convergence | Output, media, publication, and projection state still require repeated repair glue. | `frontend/lib/server/api/generationOutputs.ts`, `frontend/lib/server/falIntegration/recoveryMediaPersistence.ts`, `frontend/pages/api/media/copy-from-url.ts` | The same convergence cost is still paid in multiple places. |

## Weak Proof Areas
| Area | Current proof gap | Primary surfaces |
| --- | --- | --- |
| Direct settlement behavior | Route-level status tests mock `directGenerationSettlement` rather than exercising its real behavior directly. | `frontend/lib/server/api/directGenerationSettlement.ts`, `frontend/tests/api/fal-status-proxy.test.ts` |
| Post-accept submit failure | The direct-submit post-accept failure window is not directly characterized. | `frontend/lib/server/api/falSubmitProxy.ts` |
| `missing_generation` handling | Observation-batch tests do not directly prove the `missing_generation` downgrade behavior. | `frontend/lib/server/generationControlPlane/observationBatchExecution.ts`, `frontend/lib/server/generationControlPlane/__tests__/observationBatchExecution.test.ts` |
| ElevenLabs generated video durability | Audio persistence has direct proof; generated-video durable-authority proof is weaker. | `frontend/lib/server/elevenlabs.ts`, `frontend/tests/lib/` |
| Restored reroll durability | Stale or expired URL behavior after restore is weaker than live reroll proof. | `frontend/features/ai-studio/logic/generationReplay.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioState.reroll.test.ts` |

## Stronger Existing Baseline
These areas are already comparatively well proven and should not be re-audited unless a phase touches them:
1. recovery execution
2. recovery media persistence
3. Fal webhook ingress
4. queue status polling
5. generated-media authority helper baseline behavior

## Evidence Inputs
Use these repo artifacts to measure drift and keep the program tied to real defect classes:
1. `sql/check_generation_convergence_defect_classes.sql`
2. `sql/check_generation_pipeline_backfill_baseline.sql`
3. `scripts/replay_generation_convergence_backlog.ts`
4. `docs/sops/sop_generation_recovery_diagnostics.md`

## Live-Evidence Gate
This inventory is repo-backed, not production-count-backed.

It must not be used by itself to justify compatibility retirement. Any retirement work needs live diagnostic output from a real environment.
