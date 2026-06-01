> Archived 2026-06-01 during planning cleanup. Reason: superseded rebuild-era packet that is no longer in the active planning reading path and no longer has live repo references; retained as historical generation-pipeline rebuild context, not active planning authority.

# Generation Pipeline Rebuild State-Machine Read-Model Posture (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose

This document completes `GPR-SM-S4` by classifying the remaining post-submit queue/status readers against the canonical lifecycle transition boundary.

The goal is not to force every read surface into the mutation service. The goal is to make reader posture explicit so lifecycle authority is no longer implicit.

## Classification Outcomes

### `frontend/lib/server/api/generationQueue/service.ts`

Posture:

1. read-only observer with bounded compatibility seams

Why:

1. `readGenerationQueueStatus(...)` does not mutate lifecycle state
2. it projects queue-table state, generation-row state, and latest-attempt request ownership into a polling status result
3. it already prefers canonical attempt request ownership when `ai_generations.request_id` is absent

Observer inputs:

1. `ai_generation_submit_queue.status`
2. `ai_generations.status`
3. `ai_generations.request_id`
4. latest `generation_attempts.provider_request_id`

Bounded compatibility seams:

1. `ai_generations.request_id` remains a transitional read input
2. `ai_generations.metadata.source_ref` remains a source-ref fallback
3. `ai_generations.error_message` remains the fallback failure message source

Decision:

1. keep this module read-only
2. do not route it through the lifecycle mutation service
3. only revisit if a dedicated lifecycle read model is introduced later

### `frontend/lib/server/api/falStatusPersistedResults.ts`

Posture:

1. read-only observer with one explicit compatibility seam

Why:

1. it only resolves whether a persisted success already exists for a `request_id`
2. it prefers canonical `ai_generation_outputs` rows for successful generations
3. it does not own transition behavior

Observer inputs:

1. successful `ai_generations` rows by `request_id`
2. canonical `ai_generation_outputs`

Bounded compatibility seam:

1. `ai_generations.metadata.result_urls` remains fallback-only when canonical output reads fail or historical rows lack canonical outputs

Decision:

1. keep this module read-only
2. keep canonical outputs as primary authority
3. retain metadata URL fallback only as bounded historical compatibility

### `frontend/lib/server/api/falStatusProxy.ts`

Posture:

1. read-only observer/enricher

Why:

1. it verifies request ownership
2. it short-circuits to persisted completed results when available
3. otherwise it probes provider status/result endpoints and normalizes the response
4. it explicitly avoids settlement or recovery mutation

Observer inputs:

1. ownership resolution
2. persisted success context from `falStatusPersistedResults.ts`
3. provider status/result payloads

Bounded compatibility seams:

1. it inherits the persisted-results metadata URL fallback transitively
2. it still presents provider payloads directly for in-flight polling rather than a separate lifecycle read model

Decision:

1. keep this module read-only
2. do not convert it into a transition-service caller
3. only revisit if a future dedicated post-submit read model replaces direct provider polling normalization

## Summary Table

1. `generationQueue/service.ts`: read-only observer with bounded compatibility seams
2. `falStatusPersistedResults.ts`: read-only observer with bounded historical compatibility seam
3. `falStatusProxy.ts`: read-only observer/enricher

## Exit-Gate Conclusion

`GPR-SM-S4` is satisfied because:

1. the remaining queue/status readers now have explicit posture
2. no major forward-path lifecycle authority remains implicit in these modules
3. no additional mutation-path migration is justified by the current repo state

## Next-Step Boundary

The next work should only continue under a new explicit objective:

1. introduce a dedicated lifecycle read model for queue/status surfaces, or
2. reopen a concrete observer surface only if it starts mutating lifecycle state or competing with canonical authority

Neither of those should be opened by momentum alone.
