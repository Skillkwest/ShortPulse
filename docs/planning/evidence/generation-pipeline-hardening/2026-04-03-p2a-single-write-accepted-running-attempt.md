# Phase 2A Single-Write Accepted Running Attempt (2026-04-03)

1. `slice_id`
   - `p2a-single-write-accepted-running-attempt`
2. `date_utc`
   - `2026-04-03`
3. `phase`
   - `Phase 2A`
4. `surface`
   - accepted-running generation-attempt transition collapse
   - queue-dispatch generationTransition reduction
   - fresh-path queue-dispatch latency remeasurement
5. `commands_run`
   - targeted repo inspection for:
     - `frontend/lib/server/api/generationAttempts.ts`
     - `frontend/lib/server/api/generationAcceptedTransitionService.ts`
     - `frontend/lib/server/api/generationLifecycleTransitionService.ts`
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
   - targeted validation:
     - `npm -C frontend run test -- lib/server/api/__tests__/generationAttempts.test.ts lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/api/__tests__/requestIdRepair.test.ts lib/server/api/__tests__/generationLifecycleTransitionService.test.ts`
   - resident worker restart via:
     - `npm -C frontend run dev:generation-worker`
   - real queued generation submit against:
     - `http://127.0.0.1:3000/api/fal/nano-banana-submit`
   - direct `app_error_events` read through Supabase admin runtime access
6. `results`
   - Code change:
     - `ensureAcceptedRunningGenerationAttempt(...)` now persists new attempts directly as `running` in one write on the hot path
     - existing attempts are updated directly to `running` in one write with merged metadata
     - the transient `submitted` write followed immediately by a `running` update was removed from the common accepted-running path
     - duplicate-insert collision handling still preserves a safe retry-to-running fallback
   - Test coverage:
     - added regression coverage proving fresh accepted-running inserts do not perform the follow-up update
     - added regression coverage proving existing attempts are updated directly to `running`
   - Prior comparison point:
     - generation id: `a2d69ea5-f313-442a-aadd-3a31ce4a64bc`
     - `queue_latency_ms = 2304`
     - `generationTransition = 620`
     - `queueDispatch.durationMs = 1926`
   - Post-change validation probe:
     - generation id: `2030b4dd-9930-476e-a2c8-91983b39d763`
     - `queue_latency_ms = 1364`
     - `dispatch_stage_timings_ms`:
       - `generationTransition = 451`
       - `providerSubmit = 240`
       - `capacityCheck = 208`
       - `projectionSync = 141`
       - `queueRemove = 101`
       - `reservationSubmit = 91`
     - worker cycle:
       - `queueDispatch.durationMs = 1538`
   - Interpretation:
     - collapsing accepted-running attempt persistence into one write removed a real control-plane round trip from the dominant dispatch substage
     - the fresh-path sample stayed in the fast band and materially improved `generationTransition`
     - remaining queue-dispatch budget is now more evenly split across `providerSubmit`, `capacityCheck`, and the still-nontrivial residual generation transition work
7. `failure_codes_asserted`
   - no intentional generation failure path required
   - this slice was driven by successful queued-submit telemetry and transition regression tests
8. `contract_parity_delta`
   - no authority change
   - no browser/runtime ownership change
   - accepted-running attempt state reaches the same durable `running` result with fewer writes on the common path
9. `rollback_note`
   - Revert:
     - `frontend/lib/server/api/generationAttempts.ts`
     - `frontend/lib/server/api/__tests__/generationAttempts.test.ts`
   - Expected rollback effect:
     - accepted-running transitions resume the extra `submitted -> running` attempt write
     - `generationTransition` should regress toward the slower pre-change band
10. `linked_pr`
   - None
11. `task_contract_checklist`
   - DoD:
     - `pass` accepted-running fresh inserts complete without an immediate follow-up update
     - `pass` existing attempts still update directly to `running`
     - `pass` duplicate safety fallback remains in place
     - `pass` targeted tests cover the collapsed write path and related transition surfaces
     - `pass` worker restarted on the updated code
     - `pass` a real queued generation produced improved transition timing on the updated code
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
     - `providerSubmit` and `capacityCheck` now represent a larger share of the remaining queue-dispatch budget than before
     - the accepted-running duplicate-insert path still uses a retry update and remains slower than the uncontended happy path, which is acceptable but worth remembering
   - `deferred`
     - inspect whether any residual generation-row update work can be reduced further without weakening dispatch durability
     - inspect provider-submit start latency once the internal DB path flattens out
13. `parity_check`
   - `pass`
   - Notes:
     - targeted tests and live telemetry agree that the accepted-running path now performs fewer writes
     - the live probe showed a real reduction in `generationTransition` and overall dispatch duration
14. `changelog_decision`
   - `deferred`
   - owner/date: `Codex / 2026-04-03`

## Phase 2A Decision
This slice is complete.

It is a strong Phase 2A win because it removes a redundant hot-path write without changing queue authority or recovery semantics.

## Next Step
Continue Phase 2A by reassessing the new top remaining internal contributors:
- provider-submit start time
- capacity-check overhead
- any residual generation-row transition work that can be reduced without weakening durability
