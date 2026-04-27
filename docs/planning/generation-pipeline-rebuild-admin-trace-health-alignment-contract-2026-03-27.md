# Generation Pipeline Rebuild Admin Trace And Health Alignment Contract (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose
This document locks the current repo-backed authority posture for admin generation trace and health diagnostics before code changes.

It exists to answer:
1. where admin/operator diagnostics are still legacy-first
2. where canonical attempts and outputs can reduce operator ambiguity now
3. which compatibility seams should remain explicit instead of being silently erased

## Source Surfaces
1. `frontend/pages/api/admin/generation-trace.ts`
2. `frontend/pages/admin/generation-trace.tsx`
3. `frontend/pages/api/admin/user-health.ts`
4. `frontend/lib/server/adminUserHealth/deepReport.ts`
5. `frontend/lib/server/adminUserHealth/fleet.ts`
6. `frontend/pages/api/admin/user-health-fleet.ts`
7. `docs/sops/sop_admin_user_health_fleet_operations.md`

## Current Posture
### `/api/admin/generation-trace`
Current behavior:
1. generation lookup starts from `ai_generations.id`, `ai_generations.request_id`, and `ai_generations.metadata.*trace_id` fields
2. reservation lookup is keyed from:
   - `provider_request_id in requestIdList`
   - `source_ref = traceId`
3. ledger lookup is keyed from:
   - `source_ref = traceId`
   - `metadata.provider_request_id`
4. media lookup is keyed from:
   - `media_events.entity_id in generationIds`
   - `media_files.source_ref in generationIds`

Current weakness:
1. there is no first-class `generation_attempts` lookup path
2. there is no first-class `ai_generation_outputs` lookup path
3. operator evidence ordering is still generation/request-id centric even when canonical attempt/output rows exist

Posture decision:
1. `ai_generations` remains the entry identity for admin trace because it is still the top-level generation record
2. `generation_attempts` should become the first canonical expansion path after generation lookup when provider-request or replay evidence is needed
3. `ai_generation_outputs` should become the first canonical output expansion path before relying only on `media_files.source_ref`
4. `request_id` and metadata `source_ref` remain compatibility lookups, not the sole trace authority

### `/api/admin/user-health` and `deepReport.ts`
Current behavior:
1. generations are loaded from `ai_generations`
2. stuck-generation logic depends on:
   - `request_id`
   - `status`
   - `recovery_state`
3. reservation-to-generation linkage is inferred through:
   - `reservation.source_ref`
   - `reservation.provider_request_id`
   - `generationByRequestId`
4. charge-without-success logic depends on:
   - `generation_charge.source_ref`
   - reservation lookup by `source_ref`
   - generation lookup by `provider_request_id -> request_id`

Current weakness:
1. health diagnosis cannot distinguish “missing generation row” from “generation exists but canonical attempt linkage is the real durable provider identity”
2. output-backed success evidence is not first-class in leakage and stuck-case analysis
3. next-step guidance still points operators mainly at `source_ref` / `request_id` evidence

Posture decision:
1. `ai_generations` remains the top-level health row because it is the primary user-facing lifecycle record
2. `generation_attempts` should become canonical provider-ownership evidence where provider linkage matters
3. `ai_generation_outputs` should become canonical persisted-success evidence where output existence materially changes diagnosis
4. reservation `source_ref` and generation `request_id` remain compatibility seams because credits and queue artifacts still depend on them

### `fleet.ts` and `/api/admin/user-health-fleet`
Current behavior:
1. fleet scan remains intentionally compact and set-based
2. it computes cost-without-success by:
   - reservation lookup by `source_ref`
   - generation status lookup by `provider_request_id -> request_id`
3. it does not currently join attempts or outputs

Current weakness:
1. fleet-level findings can overclassify linkage as “missing” when canonical attempt/output evidence exists outside the current compact row set
2. the report cannot tell operators whether an issue is:
   - true missing provider linkage
   - legacy request-id seam only
   - output persisted despite incomplete legacy linkage

Posture decision:
1. fleet scan must remain bounded and compact; do not turn it into bulk deep diagnostics
2. `generation_attempts` and `ai_generation_outputs` may be incorporated only where the marginal diagnostic value is high and the set-based query remains bounded
3. if a canonical join is too heavy at fleet scale, leave the fleet view compatibility-aware and push detailed attempt/output inspection into per-user health or generation trace

## Canonical-First Rules
1. admin trace should prefer:
   - generation row
   - attempt rows
   - output rows
   - reservations / ledger / media files / app errors
2. per-user health should prefer:
   - generation row for lifecycle
   - attempt row for provider linkage
   - output row for persisted-success evidence
3. fleet health should adopt canonical joins only if they remain bounded; otherwise it must explicitly label missing canonical detail as a drill-down requirement, not pretend legacy seams are sufficient

## Compatibility Rules
1. `ai_generations.request_id` remains a compatibility lookup and search affordance for operators
2. reservation `source_ref` remains compatibility-critical because credits and queue artifacts still key off it
3. `media_files.source_ref = generation.id` remains compatibility evidence, but not the only output evidence path
4. no admin surface should silently remove `request_id` or `source_ref` diagnostics before canonical attempt/output evidence is visible

## Implementation Guardrails
1. do not redesign admin UI layout in this job
2. do not reopen billing or lifecycle mutation paths
3. keep fleet-scan query cost bounded
4. prefer adding canonical evidence and clearer operator labeling over deleting compatibility evidence

## Repo-Backed Next Moves
### `GPR-AH-S2`
1. add attempt/output-aware lookup and response sections to `frontend/pages/api/admin/generation-trace.ts`
2. keep `generationId`, `requestId`, and `traceId` query inputs intact for operator usability

### `GPR-AH-S3`
1. add canonical attempt/output-aware linkage to `frontend/lib/server/adminUserHealth/deepReport.ts` where diagnosis materially improves
2. audit `frontend/lib/server/adminUserHealth/fleet.ts` for one bounded canonical enhancement or explicitly reaffirm its compact compatibility posture

## Exit Criteria For The Contract Slice
1. admin trace and health surfaces have explicit canonical-vs-compatibility posture
2. the next code slice can be limited to trace/health evidence ordering rather than another broad audit
