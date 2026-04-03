# Phase 2A Dispatch Priority Reorder (2026-04-02)

1. `slice_id`
   - `p2a-dispatch-priority-reorder`
2. `date_utc`
   - `2026-04-03`
3. `phase`
   - `Phase 2A`
4. `surface`
   - generation control-plane cycle ordering
   - fresh-path queue-dispatch prioritization
   - canonical queue latency SQL verification
5. `commands_run`
   - targeted repo inspection for:
     - `frontend/lib/server/generationControlPlane/runCycle.ts`
     - `frontend/lib/server/generationControlPlane/__tests__/runCycle.test.ts`
   - targeted validation:
     - `npm -C frontend run test -- lib/server/generationControlPlane/__tests__/runCycle.test.ts lib/server/generationControlPlane/__tests__/workerLoop.test.ts lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`
   - resident worker restart via:
     - `npm -C frontend run dev:generation-worker`
   - real queued generation submit against:
     - `http://127.0.0.1:3000/api/fal/nano-banana-submit`
   - direct `app_error_events` verification through read-only `psql`
   - canonical latency SQL:
     - `psql -f sql/check_generation_queue_dispatch_latency.sql`
6. `results`
   - Code change:
     - moved `dispatchGenerationSubmitQueueBatch(...)` ahead of reservation-cleanup RPCs in `runGenerationControlPlaneCycle(...)`
     - maintained rescue-mode semantics
     - added a test assertion proving queue dispatch now runs before the first cleanup RPC in primary worker mode
   - Rationale:
     - reservation cleanup and provider-attached cleanup are maintenance tasks
     - queue dispatch is the UX hot path
     - the prior ordering forced new queued work to wait behind maintenance RPCs every cycle
   - Resident worker restart confirmed the new ordering was live:
     - worker continued healthy `interval_ms=1000` cycles
   - Valid post-change fresh-path probe:
     - source ref: `bcddb2b7-fec5-4cc6-83f4-41e1458816b6`
     - generation id: `0dce3837-837e-42b2-b301-7f2e1192d576`
     - `telemetry.api.fal_submit.queued` occurred at `2026-04-03 05:08:27.247+00`
     - `telemetry.queue.dispatch.submitted` occurred at `2026-04-03 05:08:29.243+00`
     - observed `queue_latency_ms = 1079`
   - Canonical queue SQL after the change:
     - `last_15m` now reflects the two Phase 2A rows:
       - worker-cadence slice: `1696`
       - dispatch-priority slice: `1079`
     - `last_15m` aggregate:
       - `avg_queue_latency_ms = 1388`
       - `p50_queue_latency_ms = 1388`
       - `p95_queue_latency_ms = 1665`
       - `max_queue_latency_ms = 1696`
   - Baseline comparison:
     - Phase 1 baseline: `3650ms`
     - after worker cadence reduction: `1696ms`
     - after dispatch-priority reorder: `1079ms`
     - improvement from Phase 1 baseline to this slice: `2571ms`
     - relative improvement from Phase 1 baseline: about `70.4%`
7. `failure_codes_asserted`
   - no intentional generation failure path was required for this slice
8. `contract_parity_delta`
   - no authority change
   - no browser/client ownership change
   - the control plane still runs the same stages, but now prioritizes queue dispatch before maintenance cleanup during primary worker cycles
9. `rollback_note`
   - Revert:
     - `frontend/lib/server/generationControlPlane/runCycle.ts`
     - `frontend/lib/server/generationControlPlane/__tests__/runCycle.test.ts`
   - Expected rollback effect:
     - queued work again waits behind reservation-cleanup RPCs before dispatch on each primary cycle
     - fresh-path queue latency should regress toward the slower post-cadence, pre-reorder window
10. `linked_pr`
   - None
11. `task_contract_checklist`
   - DoD:
     - `pass` queue dispatch was moved ahead of maintenance cleanup in the primary control-plane cycle
     - `pass` test coverage locks the new ordering
     - `pass` worker restarted on the updated code
     - `pass` a real queued generation produced a lower fresh-path `queue_latency_ms`
     - `pass` canonical queue latency SQL captured the new sample
   - Required gates:
     - `pass` no staging or production environment used
     - `pass` runtime secrets were used ephemerally only and not persisted in repo artifacts
     - `pass` the temporary Phase 2 probe auth user was deleted after verification
   - Docs/tracker/evidence parity:
     - `pass` Phase 2A evidence packet added to the governed evidence surface
12. `audit_findings`
   - `blocking`
     - none
   - `non-blocking`
     - the remaining fresh-path latency budget is now close to the worker-cycle floor, so further reductions will likely require either faster empty-cycle work or tighter dispatch-path internals
     - queue SQL `last_15m` still includes a slower `1696ms` Phase 2A row, so aggregates are useful but the newest direct sample remains the best signal for this slice
   - `deferred`
     - serial item processing and per-item capacity evaluation inside `frontend/lib/server/api/generationQueue/dispatch.ts`
     - observation and recovery stage timing visibility if we need deeper control-plane profiling
13. `parity_check`
   - `pass`
   - Notes:
     - the reordered cycle is locked by test coverage
     - raw telemetry and canonical SQL agree on the new `1079ms` fresh-path sample
     - the next bottleneck is no longer the pre-dispatch cleanup ordering
14. `changelog_decision`
   - `deferred`
   - owner/date: `Codex / 2026-04-02`

## Phase 2A Decision
This second Phase 2A slice is complete.

Moving queue dispatch ahead of cleanup was the right hot-path decision:
- it kept the architecture intact
- it removed maintenance work from the critical path
- it produced another real latency improvement on top of the faster worker cadence

## Next Step
Continue Phase 2A in the queue hot path:
- inspect serial item processing in `frontend/lib/server/api/generationQueue/dispatch.ts`
- focus on per-item capacity checks, repeated lookups, and refill-pass overhead
- take the next real fresh-path measurement after the highest-ROI dispatch-path change
