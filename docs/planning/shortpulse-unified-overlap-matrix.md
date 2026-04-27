# ShortPulse Unified Overlap Matrix

Last updated: 2026-03-02
Status: active

## Purpose
Map overlapping plan tracks to one execution surface so work is not duplicated.

| Track | Overlap Surface | Canonical Resolution | Owner Phase |
| --- | --- | --- | --- |
| Security hardening plans | Route auth trust model | Token-first fail-closed, proxy headers metadata-only | 02 |
| Runtime hardening plans | Queue/recovery transitions | Treat `036/037/038` as baseline; implement only residual integrity controls | 03-04 |
| AI Studio foundation plans | Large hook modularization and boundaries | Targeted extraction only, no broad rewrite | 07 |
| Admin hardening plans | Access gate + transition correctness | Dedicated admin access contract + atomic status updates | 02 + 09 |
| Billing hardening plans | Stripe webhook idempotency/replay | Single durable claim flow + replay-safe processing | 08 |
| Media security plans | Upload authority + preview trust | Server upload route + centralized trust policy | 05 |
| Character hardening plans | DnD trust + cross-surface sync | Preserve local/internal flows, block arbitrary external payloads | 06 |
| CI/reliability plans | Guardrail drift + enforcement policy | Fix stale references then enforce with exact required checks | 01 |
| Fal->Kie migration plans | Provider abstraction and rollout | Start only after prior hardening phases are green | 11 |
| Runtime + autosave plans | `recoveryExecution.ts` policy enforcement | One shared policy seam for timeout/exhaustion/autosave decisions | 13 |
| UX + autosave plans | `ReferenceGridCard.tsx` card actions | Single consolidated card-action contract rollout | 13 |
| Prompt-adjacency + session plans | Assistant message identity and linkage | Message-ID foundation lands before thumbnail/session restore features | 13 |
| Multi-stream SQL plans | Migration numbering (`041`-`046`) | Central reservation map required before migration PRs | 13 |

## Active Hotspots
1. `frontend/lib/server/api/auth.ts`
2. `frontend/proxy.ts`
3. `frontend/lib/server/api/generationQueue/*`
4. `frontend/pages/api/internal/generation-recovery/run.ts`
5. `frontend/pages/api/fal/queue-status.ts`
6. `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
7. `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`
8. `frontend/pages/api/billing/stripe/webhook.ts`
9. `frontend/lib/server/falIntegration/recoveryExecution.ts`
10. `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx`
11. `frontend/features/ai-agent/useAiAgent.ts`

## Duplication Ban List
1. Do not create parallel auth verification paths.
2. Do not add second queue/recovery lifecycle implementation.
3. Do not duplicate pricing/model contract logic in both `features` and `lib/model-runtime`.
4. Do not keep temporary compatibility aliases past Phase 12.
5. Do not create parallel unified trackers or overlap matrices.
6. Do not assign migration numbers without reservation-map entry.
