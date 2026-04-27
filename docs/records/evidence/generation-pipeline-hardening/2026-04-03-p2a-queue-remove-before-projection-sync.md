# Phase 2A Queue Remove Before Projection Sync (2026-04-03)

1. `slice_id`
   - `p2a-queue-remove-before-projection-sync`
2. `date_utc`
   - `2026-04-03`
3. `phase`
   - `Phase 2A`
4. `surface`
   - queue-dispatch success-path ordering
   - queue-status handoff improvement
   - real queued-submit no-regression probe
5. `commands_run`
   - targeted repo inspection for:
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
     - `frontend/lib/server/api/generationQueue/service.ts`
     - `frontend/lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`
     - `frontend/lib/server/api/__tests__/generationQueue.service.test.ts`
   - targeted validation:
     - `npm -C frontend run test -- lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/api/__tests__/generationQueue.dispatch.test.ts lib/server/api/__tests__/generationQueue.service.test.ts`
   - resident worker restart via:
     - `npm -C frontend run dev:generation-worker`
   - real queued generation submit against:
     - `http://127.0.0.1:3000/api/fal/nano-banana-submit`
   - direct `app_error_events` read through Supabase admin runtime access
6. `results`
   - Code change:
     - on both successful queue-dispatch paths, `removeQueueItem(...)` now runs before `syncQueueDispatchProjection(...)`
     - projection sync remains awaited and best-effort logged, but the queue row is cleared earlier
     - added ordering assertions proving queue removal occurs before projection sync on:
       - existing-request reconcile path
       - normal accepted submit path
   - Contract rationale:
     - `/api/fal/queue-status` already falls back from `generation_projection` to `ai_generations.request_id`
     - the authoritative request id is persisted before queue removal during the accepted-running transition
     - that means clearing the queue row earlier allows faster status-path handoff to the dispatched fallback without reopening authority
   - Live no-regression probe:
     - generation id: `a2d69ea5-f313-442a-aadd-3a31ce4a64bc`
     - `queue_latency_ms = 2304`
     - `dispatch_stage_timings_ms`:
       - `generationTransition = 620`
       - `capacityCheck = 247`
       - `providerSubmit = 193`
       - `projectionSync = 184`
       - `reservationSubmit = 150`
       - `queueRemove = 96`
     - worker cycle:
       - `queueDispatch.durationMs = 1926`
   - Interpretation:
     - this slice is a queue-status handoff improvement, not a raw provider-submit latency optimization
     - the live probe shows the reordered path remained healthy and continued to emit valid dispatch telemetry
     - remaining raw latency budget is still concentrated in `generationTransition`, `capacityCheck`, and provider start time
7. `failure_codes_asserted`
   - no intentional generation failure path required
   - this slice was validated through ordering tests plus successful queued-submit telemetry
8. `contract_parity_delta`
   - no authority change
   - no browser/runtime ownership change
   - queue row removal now happens as soon as authoritative dispatch state is durable, before the compatibility projection write completes
9. `rollback_note`
   - Revert:
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
     - `frontend/lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`
   - Expected rollback effect:
     - queue rows remain in `dispatching` state until after projection sync completes
     - `/api/fal/queue-status` may stay on the queue-row path slightly longer before falling through to authoritative dispatched state
10. `linked_pr`
   - None
11. `task_contract_checklist`
   - DoD:
     - `pass` successful queue-dispatch paths remove the queue row before projection sync
     - `pass` targeted tests lock the new ordering
     - `pass` existing queue-status fallback coverage remains green
     - `pass` worker restarted on the updated code
     - `pass` a real queued generation completed with valid dispatch telemetry on the updated code
   - Required gates:
     - `pass` no staging or production environment used
     - `pass` runtime secrets remained ephemeral and were not persisted in repo artifacts
     - `pass` disposable probe auth user removed after verification
     - `pass` unrelated frontend/UI dirty files remained untouched
   - Docs/tracker/evidence parity:
     - `pass` evidence packet added to the governed evidence surface
12. `audit_findings`
   - `blocking`
     - none
   - `non-blocking`
     - the live probe did not show a raw latency step-change because this slice targets status handoff ordering rather than the dominant dispatch substage costs
     - `projectionSync` still remains synchronous within the worker cycle even though it no longer blocks queue-row removal
   - `deferred`
     - inspect whether `generationTransition` can be reduced further without weakening durability checks
     - inspect whether provider-submit start latency has a bounded repo-safe optimization path
13. `parity_check`
   - `pass`
   - Notes:
     - targeted tests, queue-status fallback coverage, and live telemetry are consistent with the new ordering
     - the reordered path remained healthy under a real queued probe
14. `changelog_decision`
   - `deferred`
   - owner/date: `Codex / 2026-04-03`

## Phase 2A Decision
This slice is complete.

It is intentionally narrow:
- it improves the queue-status handoff path after authoritative dispatch persistence
- it does not attempt to change provider-submit or transition semantics

This is worth keeping because it reduces one avoidable source of UX lag without adding architectural risk.

## Next Step
Continue Phase 2A on the measured dominant stages:
- inspect `generationTransition` for another durable write-path reduction
- if no clean transition win appears, move next to provider-submit start latency or bounded post-submit tail work
