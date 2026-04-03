# Phase 2A Dispatch Substage And Attempt Fast Path (2026-04-03)

1. `slice_id`
   - `p2a-dispatch-substage-and-attempt-fast-path`
2. `date_utc`
   - `2026-04-03`
3. `phase`
   - `Phase 2A`
4. `surface`
   - queue-dispatch substage timing attribution
   - accepted-running generation-attempt fast path
   - fresh-path queue-dispatch latency remeasurement
5. `commands_run`
   - targeted repo inspection for:
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
     - `frontend/lib/server/api/generationAttempts.ts`
     - `frontend/lib/server/api/generationAcceptedTransitionService.ts`
     - `frontend/lib/server/api/generationLifecycleTransitionService.ts`
   - targeted validation:
     - `npm -C frontend run test -- lib/server/api/__tests__/generationAttempts.test.ts lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/api/__tests__/generationQueue.dispatch.test.ts lib/server/generationControlPlane/__tests__/runCycle.test.ts`
     - `npm -C frontend run docs:check`
   - resident worker restart via:
     - `npm -C frontend run dev:generation-worker`
   - real queued generation submits against:
     - `http://127.0.0.1:3000/api/fal/nano-banana-submit`
   - direct `app_error_events` read through Supabase admin runtime access
6. `results`
   - Code change:
     - `telemetry.queue.dispatch.submitted` now persists `dispatch_stage_timings_ms` for:
       - `existingRequestReconcile`
       - `capacityCheck`
       - `providerKeyRead`
       - `targetResolution`
       - `payloadPreparation`
       - `providerSubmit`
       - `reservationSubmit`
       - `generationTransition`
       - `projectionSync`
       - `queueRemove`
     - `ensureAcceptedRunningGenerationAttempt(...)` now updates the known attempt by `attemptId` and merged metadata instead of performing a second provider-request lookup during the same accepted-running transition
     - added regression coverage proving the accepted-running helper avoids the extra lookup path
   - Pre-fast-path attribution probe:
     - generation id: `ff44e4da-90c9-43a2-9a72-79ef1d8665c7`
     - `queue_latency_ms = 2151`
     - `dispatch_stage_timings_ms`:
       - `generationTransition = 1588`
       - `providerSubmit = 558`
       - `capacityCheck = 432`
       - `projectionSync = 255`
       - `reservationSubmit = 177`
       - `queueRemove = 180`
     - worker cycle:
       - `queueDispatch.durationMs = 3735`
   - Post-fast-path validation probe:
     - generation id: `799584bd-48a8-44ed-8259-7c1a32096a45`
     - `queue_latency_ms = 1419`
     - `dispatch_stage_timings_ms`:
       - `generationTransition = 692`
       - `providerSubmit = 243`
       - `capacityCheck = 234`
       - `projectionSync = 171`
       - `reservationSubmit = 133`
       - `queueRemove = 140`
     - worker cycle:
       - `queueDispatch.durationMs = 2003`
   - Interpretation:
     - the accepted-running transition path was a real internal bottleneck
     - removing the extra attempt lookup materially reduced that stage
     - queue dispatch is still the dominant stage under real queued submit, but its remaining time is now distributed more evenly across transition, provider submit, and capacity evaluation
7. `failure_codes_asserted`
   - no intentional generation failure path required
   - this slice was driven by successful queued-submit telemetry and worker-cycle attribution
8. `contract_parity_delta`
   - no authority change
   - no browser/runtime ownership change
   - successful queue-dispatch telemetry now carries finer-grained internal timing metadata for diagnostics
   - accepted-running attempt state keeps the same semantic contract while using a cheaper implementation path
9. `rollback_note`
   - Revert:
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
     - `frontend/lib/server/api/generationAttempts.ts`
     - `frontend/lib/server/api/__tests__/generationAttempts.test.ts`
     - `frontend/lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`
   - Expected rollback effect:
     - dispatch telemetry loses substage attribution
     - accepted-running transitions resume the extra provider-request lookup
     - queue dispatch latency should regress toward the slower pre-fast-path band
10. `linked_pr`
   - None
11. `task_contract_checklist`
   - DoD:
     - `pass` successful queue-dispatch telemetry includes substage timings
     - `pass` accepted-running attempt path avoids the redundant lookup when `attemptId` is already known
     - `pass` targeted tests cover the new timing metadata and the generation-attempt fast path
     - `pass` worker restarted on the updated code
     - `pass` a real queued generation produced improved fresh-path latency
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
     - queue dispatch remains the dominant live stage for fresh queued submits even after the attempt fast-path reduction
     - provider submit and capacity evaluation are now a larger share of the remaining queue-dispatch budget than before
   - `deferred`
     - inspect whether capacity snapshots can be reused or simplified within one dispatch pass
     - inspect whether projection sync or queue removal can move off the critical path without weakening correctness
13. `parity_check`
   - `pass`
   - Notes:
     - persisted telemetry, worker logs, and targeted tests all agree on the new dispatch attribution contract
     - live validation showed a real reduction in both `generationTransition` and end-to-end queue latency
14. `changelog_decision`
   - `deferred`
   - owner/date: `Codex / 2026-04-03`

## Phase 2A Decision
This slice is complete.

It did two useful things:
- exposed queue-dispatch internals without changing authority or semantics
- removed a real redundant lookup in the accepted-running transition path

That combination produced a real improvement on the fresh path and narrowed the remaining queue-dispatch budget to smaller follow-on targets.

## Next Step
Continue Phase 2A inside queue dispatch:
- inspect whether `readActiveProviderCapacitySnapshot(...)` can be reduced or reused within a pass
- inspect whether `projectionSync` or `queueRemove` can move off the dispatch critical path without correctness risk
- remeasure immediately after the next hot-path change
