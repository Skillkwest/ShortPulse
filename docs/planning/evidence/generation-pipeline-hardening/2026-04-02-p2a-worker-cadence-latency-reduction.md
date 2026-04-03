# Phase 2A Worker Cadence Latency Reduction (2026-04-02)

1. `slice_id`
   - `p2a-worker-cadence-latency-reduction`
2. `date_utc`
   - `2026-04-03`
3. `phase`
   - `Phase 2A`
4. `surface`
   - resident generation control-plane worker cadence
   - fresh-path queue-to-dispatch latency
   - canonical queue latency SQL verification
5. `commands_run`
   - targeted repo inspection for:
     - `frontend/lib/server/generationControlPlane/workerLoop.ts`
     - `frontend/lib/server/generationControlPlane/runCycle.ts`
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
     - `frontend/scripts/run_generation_control_plane_worker.mjs`
   - targeted validation:
     - `npm -C frontend run test -- lib/server/generationControlPlane/__tests__/workerLoop.test.ts lib/server/generationControlPlane/__tests__/runCycle.test.ts lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`
   - resident worker restart via:
     - `npm -C frontend run dev:generation-worker`
   - real queued generation submit against:
     - `http://127.0.0.1:3000/api/fal/nano-banana-submit`
   - direct `app_error_events` verification through read-only `psql`
   - canonical latency SQL:
     - `psql -f sql/check_generation_queue_dispatch_latency.sql`
6. `results`
   - Code change:
     - reduced `DEFAULT_GENERATION_CONTROL_PLANE_WORKER_INTERVAL_MS` from `5000` to `1000`
     - added worker-loop regression coverage to lock the fast default interval
     - made the rescue-mode request-id repair test explicit about `SHORTPULSE_FAL_LEGACY_DIRECT_SUBMIT_ENABLED`
   - Resident worker restart confirmed the new cadence:
     - bootstrap log showed `interval_ms=1000`
     - worker continued to acquire leadership and complete healthy cycles
   - First runtime probe was intentionally discarded:
     - submit returned `202 GENERATION_QUEUED`
     - deleting the temporary auth user immediately after submit removed the queue row before dispatch
     - result was not used as Phase 2 evidence
   - Valid post-change fresh-path probe:
     - source ref: `c908143b-b209-4610-87f8-006eace43186`
     - generation id: `e05b9be8-486d-4328-97f4-89cad935d605`
     - `telemetry.api.fal_submit.queued` occurred at `2026-04-03 05:02:27.611+00`
     - `telemetry.queue.dispatch.submitted` occurred at `2026-04-03 05:02:30.373+00`
     - observed `queue_latency_ms = 1696`
   - Canonical queue SQL after the change:
     - `last_15m` now contains two validated rows:
       - prior Phase 1 baseline: `3650`
       - Phase 2A fresh-path probe: `1696`
     - aggregate sample over those rows:
       - `avg_queue_latency_ms = 2673`
       - `p50_queue_latency_ms = 2673`
       - `p95_queue_latency_ms = 3552`
       - `max_queue_latency_ms = 3650`
   - Baseline comparison:
     - fresh-path queue latency improved from `3650ms` to `1696ms`
     - absolute improvement: `1954ms`
     - relative improvement: about `53.5%`
7. `failure_codes_asserted`
   - no intentional generation failure path was required for this slice
   - the discarded first probe confirmed an operational pitfall, not a production failure code:
     - deleting the temporary auth user too early removes the queue artifact under test
8. `contract_parity_delta`
   - no architecture contract changed
   - the worker contract remains resident-worker-first
   - Phase 2A improved latency by changing the default poll cadence, not by reopening queue authority or browser behavior
9. `rollback_note`
   - Revert:
     - `frontend/lib/server/generationControlPlane/workerLoop.ts`
     - `frontend/lib/server/generationControlPlane/__tests__/workerLoop.test.ts`
     - `frontend/lib/server/generationControlPlane/__tests__/runCycle.test.ts`
   - Expected rollback effect:
     - resident worker default cadence returns to `5000ms`
     - fresh queued generations can again spend multiple seconds waiting on idle-cycle sleep
10. `linked_pr`
   - None
11. `task_contract_checklist`
   - DoD:
     - `pass` a minimal worker-cadence change was implemented
     - `pass` targeted worker/control-plane tests passed
     - `pass` resident worker restarted on the new default cadence
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
     - the measured `1696ms` is materially better but still above sub-second dispatch, so more Phase 2A work remains if UX targets require it
     - worker cycle durations are often around `1100-1400ms`, which means in-cycle work now consumes a meaningful share of the remaining latency budget
   - `deferred`
     - serial queue-dispatch optimization in `frontend/lib/server/api/generationQueue/dispatch.ts`
     - in-cycle contention analysis across observation and recovery stages in `frontend/lib/server/generationControlPlane/runCycle.ts`
13. `parity_check`
   - `pass`
   - Notes:
     - the worker actually ran on the new default cadence
     - the first valid fresh-path sample moved in the expected direction
     - canonical SQL and raw event reads agree on the new latency sample
14. `changelog_decision`
   - `deferred`
   - owner/date: `Codex / 2026-04-02`

## Phase 2A Decision
This first Phase 2A slice is complete.

Lowering the resident worker default interval was a valid high-leverage latency change:
- it preserved the existing architecture
- it produced a real fresh-path queue-latency improvement
- it restored a more useful baseline for the next round of hot-path inspection

## Next Step
Continue Phase 2A against the remaining server-side latency budget:
- inspect in-cycle contention inside `frontend/lib/server/generationControlPlane/runCycle.ts`
- inspect serial queue dispatch overhead inside `frontend/lib/server/api/generationQueue/dispatch.ts`
- take another real fresh-path measurement after the next highest-ROI hot-path change
