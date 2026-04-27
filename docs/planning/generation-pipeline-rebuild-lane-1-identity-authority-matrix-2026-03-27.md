# Generation Pipeline Rebuild Lane 1 Identity And Authority Matrix (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose
This document inventories the current request, attempt, output, and billing identities used by the generation pipeline.

It is the source-of-truth input for Lane 1. It names:
1. what identity exists today
2. where it is created
3. which module currently mutates it
4. which modules consume it
5. what the Lane 1 target identity should be

## Current Identity Matrix
| Identity | Current storage/shape | Created or attached by | Current mutation authority | Current consumers | Current drift risk | Lane 1 target |
| --- | --- | --- | --- | --- | --- | --- |
| `client_submission_id` / trace ids | Optional payload metadata such as `submission_trace_id` or `generation_trace_id`, copied into `ai_generations.metadata` by direct submit persistence | Client payload composition, then `frontend/lib/server/api/generationSubmitPersistence.ts` | No canonical server owner; treated as trace metadata only | Submit diagnostics, admin trace-style debugging, compatibility tracing | Not guaranteed, not required, not authoritative | Keep as trace-only metadata; never use as lifecycle identity |
| `source_ref` | Reservation/source correlation key stored in billing rows, queue rows, and `ai_generations.metadata.source_ref` | `frontend/lib/server/api/generationBilling.ts` resolves it before submit; queue enqueue carries it into RPC state | Billing reservation helpers, queue enqueue/dispatch, direct submit persistence, recovery metadata writes | Billing, queue status, recovery, AI Studio client linkage, compatibility readers | Strong cross-system key today, but overloaded as request identity substitute | Keep as pre-provider correlation key only; request identity must no longer depend on it |
| Billing reservation identity | Reservation row keyed by `source_ref`; legacy direct-debit charge rows also exist | `frontend/lib/server/api/generationBilling.ts` via `reserveGenerationCredits(...)` or direct ledger insert fallback | Billing reservation submit/capture/release in `generationBilling.ts` and `generationBilling/settlementService.ts` | Submit path, queue dispatch, recovery settlement, admin diagnostics | Reservation is linked by `source_ref` first and repaired to `provider_request_id` later when necessary | Attach reservation to canonical request immediately; remove repair-first linkage model |
| Request record id | `ai_generations.id` | Queued path creates it via `enqueue_generation_submit`; direct submit creates it only after provider acceptance in `frontend/lib/server/api/generationSubmitPersistence.ts` | Direct submit persistence, queue dispatch row updates, recovery lifecycle updates | Status proxy, recovery, queue status, canonical outputs, AI Studio client | Current request row is created at different lifecycle points depending on path | Replace with canonical request identity created before provider submit for all paths |
| Queue item id | `ai_generation_submit_queue.id` | `enqueue_generation_submit` RPC | Queue claim/retry/exhaust/release/remove in `frontend/lib/server/api/generationQueue/service.ts` and `dispatch.ts` | Queue worker, queue status endpoint, admin diagnostics | Queue item is a real lifecycle record today, not just transport state | Keep as queue transport state only; it must not compete with request/attempt identity |
| Attempt identity | No canonical row; currently implicit across queue attempts, provider request id, and recovery attempt counters | Implicit in `queue_attempts`, `recovery_attempts`, and provider submit acceptance | Queue dispatch and recovery mutate attempt-like state independently | Queue dispatch, recovery, admin diagnostics | Biggest Lane 1 gap: no durable attempt lineage, retry ownership, or timeout identity | Introduce explicit attempt identity and attempt row |
| `provider_request_id` | `ai_generations.request_id`, billing reservation linkage metadata, canonical output rows, provider callbacks | Direct submit provider acceptance in `falSubmitProxy.ts`; queued acceptance in `generationQueue/dispatch.ts` | Submit path, queue dispatch, recovery settlement, persisted status readers | Status proxy, recovery, billing settlement, canonical outputs, provider/webhook handling | Provider handle is currently doing double duty as both request handle and attempt identity | Move under explicit attempt record; request consumes it indirectly through current attempt |
| Output record id | `ai_generation_outputs.id` | Recovery output persistence and later/manual save attachment paths in `frontend/lib/server/api/generationOutputs.ts` | Recovery output writes and media attachment helpers | Persisted status, generated download/reference resolution, save/copy paths | Exists now, but only after provider success; historical rows still rely on fallback paths | Keep as canonical output-slot identity |
| Saved media id | `media_files.id` | Recovery media persistence, browser/manual save, server copy fallback | Media persistence helpers and media library flows | Reference reuse, storage-backed download, library views | Historically acted like output identity via `metadata.generation_output_index` | Keep as durable asset identity only; output identity must stay in `ai_generation_outputs` |

## Current Path Split
### Direct submit path
1. `frontend/lib/server/api/generationBilling.ts` reserves credits using `source_ref`.
2. `frontend/lib/server/api/falSubmitProxy.ts` sends the provider submit.
3. Only after provider acceptance does `frontend/lib/server/api/generationSubmitPersistence.ts` create or update `ai_generations`.
4. Result: direct submit creates request identity late.

### Queued submit path
1. `frontend/lib/server/api/falSubmitProxy.ts` queues work through `enqueueGenerationSubmit(...)`.
2. The queue RPC creates a queue item and returns `generationId` before provider dispatch.
3. `frontend/lib/server/api/generationQueue/dispatch.ts` later attaches `provider_request_id` and marks the generation row running.
4. Result: queued submit creates request identity early, but still has no explicit attempt record.

## Identity Ownership Problems Lane 1 Must Solve
1. Request identity is not created at the same lifecycle point across direct submit and queued submit.
2. Attempt identity is implicit and split between queue bookkeeping, provider request ids, and recovery counters.
3. Billing reservation identity begins at `source_ref` and can still require later repair to align with provider identity.
4. Queue item identity still participates in lifecycle truth instead of remaining transport state.
5. Historical compatibility surfaces still let `media_files` and `ai_generations.metadata` behave like partial output authorities.

## Lane 1 Identity Decisions
### Request identity
1. Must exist before any provider submit.
2. Must be the top-level billing owner.
3. Must survive queueing, retries, provider acceptance, and recovery without changing.

### Attempt identity
1. Must be explicit.
2. Must own provider dispatch lineage, retries, timeouts, and provider request handle.
3. Must absorb what is currently spread across queue attempts, recovery attempts, and `request_id`.

### Output identity
1. `ai_generation_outputs` remains the canonical output-slot authority.
2. `media_files` stays a durable asset record only.

## Immediate Lane 1 Follow-On
This matrix closes `GPR-L1-S1` only if it is paired with an explicit legal transition matrix. The next artifact must define:
1. legal request transitions
2. legal attempt transitions
3. which module may trigger each transition
4. which modules must become read-only observers
