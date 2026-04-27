# Phase 2A Capacity Query Tightening (2026-04-03)

1. `slice_id`
   - `p2a-capacity-query-tightening`
2. `date_utc`
   - `2026-04-03`
3. `phase`
   - `Phase 2A`
4. `surface`
   - queue-dispatch provider-capacity snapshot query tightening
   - real fresh-path queue-dispatch latency remeasurement
5. `commands_run`
   - targeted repo inspection for:
     - `frontend/lib/server/api/generationQueue/activeProviderCapacity.ts`
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
     - `frontend/lib/server/api/__tests__/activeProviderCapacity.test.ts`
   - targeted validation:
     - `npm -C frontend run test -- lib/server/api/__tests__/activeProviderCapacity.test.ts lib/server/api/__tests__/generationQueue.dispatch.test.ts lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`
   - resident worker restart via:
     - `npm -C frontend run dev:generation-worker`
   - real queued generation submit against:
     - `http://127.0.0.1:3000/api/fal/nano-banana-submit`
   - direct `app_error_events` read through Supabase admin runtime access
6. `results`
   - Code change:
     - `readActiveProviderCapacitySnapshot(...)` now pushes `provider_request_id IS NOT NULL` into the reservation query whenever `includeUnattachedReservations=false`
     - queue-dispatch capacity reads no longer load unattached reservation rows just to discard them in memory
     - added regression coverage that locks the new query shape for queue-dispatch capacity reads
   - Validation probe:
     - generation id: `82513bc9-b2ac-4b4f-8bae-a5a982497baf`
     - `queue_latency_ms = 756`
     - `dispatch_stage_timings_ms`:
       - `generationTransition = 584`
       - `providerSubmit = 231`
       - `capacityCheck = 218`
       - `reservationSubmit = 122`
       - `queueRemove = 116`
       - `projectionSync = 98`
     - worker cycle:
       - `queueDispatch.durationMs = 1713`
   - Comparison against the prior dispatch-substage probe:
     - previous fresh-path sample:
       - generation id: `799584bd-48a8-44ed-8259-7c1a32096a45`
       - `queue_latency_ms = 1419`
       - `capacityCheck = 234`
       - `queueDispatch.durationMs = 2003`
     - current fresh-path sample:
       - `queue_latency_ms = 756`
       - `capacityCheck = 218`
       - `queueDispatch.durationMs = 1713`
   - Interpretation:
     - the specific `capacityCheck` reduction was modest but real on the probe
     - the queue hot path stayed in the faster band after removing the unnecessary unattached-reservation scan
     - dispatch remains the dominant live stage, with `generationTransition`, `providerSubmit`, and `capacityCheck` still the highest-value remaining internal contributors
7. `failure_codes_asserted`
   - no intentional generation failure path required
   - this slice was driven by successful queued-submit telemetry and worker-cycle attribution
8. `contract_parity_delta`
   - no authority change
   - no browser/runtime ownership change
   - no queue-state semantic change
   - queue-dispatch capacity reads now avoid a known non-authoritative reservation class earlier in the query path
9. `rollback_note`
   - Revert:
     - `frontend/lib/server/api/generationQueue/activeProviderCapacity.ts`
     - `frontend/lib/server/api/__tests__/activeProviderCapacity.test.ts`
   - Expected rollback effect:
     - queue-dispatch capacity reads resume scanning unattached reserved rows even when the caller explicitly ignores them
     - live fresh-path latency may regress slightly under reserved-row accumulation
10. `linked_pr`
   - None
11. `task_contract_checklist`
   - DoD:
     - `pass` queue-dispatch capacity reads skip unattached reservation rows at the query layer when requested
     - `pass` targeted tests cover the new query behavior
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
     - `capacityCheck` is no longer the only obvious internal candidate; `generationTransition` and `providerSubmit` still consume comparable or more time on the fresh path
     - the observed latency gain is larger than the isolated `capacityCheck` reduction, so at least part of the improvement is normal live-path variance rather than this query tightening alone
   - `deferred`
     - inspect whether `projectionSync` can move off the synchronous dispatch path without weakening queue correctness
     - inspect whether provider-submit start latency has a bounded, repo-safe tuning lever
13. `parity_check`
   - `pass`
   - Notes:
     - targeted tests and live telemetry agree that the query tightening is active
     - the fresh-path probe remained in the faster dispatch band after the change
14. `changelog_decision`
   - `deferred`
   - owner/date: `Codex / 2026-04-03`

## Phase 2A Decision
This slice is complete.

It is intentionally narrow:
- it removes known unnecessary work from queue-dispatch capacity reads
- it does not change queue semantics or admission authority

The live result is good enough to keep, but it does not justify overstating the win. The next useful reduction should keep targeting the synchronous dispatch path with the same measured approach.

## Next Step
Continue Phase 2A inside queue dispatch:
- inspect whether `projectionSync` can move off the synchronous success path safely
- inspect whether `generationTransition` can be reduced again without reopening authority
- remeasure immediately after the next hot-path change
