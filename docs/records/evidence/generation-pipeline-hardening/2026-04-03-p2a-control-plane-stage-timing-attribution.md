# Phase 2A Control-Plane Stage Timing Attribution (2026-04-03)

1. `slice_id`
   - `p2a-control-plane-stage-timing-attribution`
2. `date_utc`
   - `2026-04-03`
3. `phase`
   - `Phase 2A`
4. `surface`
   - control-plane cycle timing attribution
   - resident worker run ledger enrichment
   - internal recovery route operator diagnostics
5. `commands_run`
   - targeted repo inspection for:
     - `frontend/lib/server/generationControlPlane/runCycle.ts`
     - `frontend/lib/server/generationControlPlane/types.ts`
     - `frontend/lib/server/generationControlPlane/workerLoop.ts`
     - `frontend/pages/api/internal/generation-recovery/run.ts`
   - targeted validation:
     - `npm -C frontend run test -- lib/server/generationControlPlane/__tests__/runCycle.test.ts lib/server/generationControlPlane/__tests__/workerLoop.test.ts tests/api/internal-generation-recovery-run.test.ts`
     - `npm -C frontend run docs:check`
   - resident worker restart via:
     - `npm -C frontend run dev:generation-worker`
   - live worker log capture from the restarted resident worker
6. `results`
   - Code change:
     - added `stageTimings` to `GenerationControlPlaneCycleResult`
     - measured and returned per-stage durations for:
       - `queueDispatch`
       - `reservationCleanup`
       - `providerAttachedReservationCleanup`
       - `observationInboxProcessing`
       - `requestIdRepair`
       - `recoveryClaim`
       - `recoveryExecution`
     - worker success logs now emit serialized `stageTimings`
     - internal route docs and diagnostics docs now treat `stageTimings` as an operator-visible response field
   - Live worker sample after restart on the new code:
     - cycle 1:
       - total `duration_ms=1270`
       - `queueDispatch=130`
       - `reservationCleanup=200`
       - `providerAttachedReservationCleanup=132`
       - `observationInboxProcessing=124`
       - `requestIdRepair=0`
       - `recoveryClaim=145`
       - `recoveryExecution=0`
     - cycle 2:
       - total `duration_ms=1107`
       - `queueDispatch=109`
       - `reservationCleanup=138`
       - `providerAttachedReservationCleanup=105`
       - `observationInboxProcessing=122`
       - `requestIdRepair=0`
       - `recoveryClaim=134`
       - `recoveryExecution=0`
   - Attribution result:
     - empty cycles are spending roughly `608ms` to `731ms` in serial stage work before the fixed `1000ms` sleep
     - the remaining fresh-path latency floor is no longer explained primarily by the interval setting
     - the dominant current floor is in-cycle occupancy across cleanup, observation inbox processing, and recovery claim stages
7. `failure_codes_asserted`
   - no intentional generation failure path required
   - one targeted test rerun exposed an implicit rescue-mode expectation for legacy direct submit enablement; the test setup was corrected to state that dependency explicitly
8. `contract_parity_delta`
   - no architecture change
   - operator-visible response and worker-run metrics now include stage-level timing attribution
   - worker ownership, queue ownership, and rescue semantics remain unchanged
9. `rollback_note`
   - Revert:
     - `frontend/lib/server/generationControlPlane/types.ts`
     - `frontend/lib/server/generationControlPlane/runCycle.ts`
     - `frontend/lib/server/generationControlPlane/workerLoop.ts`
     - `frontend/lib/server/generationControlPlane/__tests__/runCycle.test.ts`
     - `frontend/lib/server/generationControlPlane/__tests__/workerLoop.test.ts`
     - `frontend/tests/api/internal-generation-recovery-run.test.ts`
     - `docs/api/api-internal-routes.md`
     - `docs/sops/sop_generation_recovery_diagnostics.md`
     - `docs/monitoring.md`
   - Expected rollback effect:
     - worker cycles revert to aggregate-only timing
     - route/operator diagnostics lose stage-level attribution, forcing later latency work back into guesswork
10. `linked_pr`
   - None
11. `task_contract_checklist`
   - DoD:
     - `pass` stage-level timing is returned in the control-plane cycle result
     - `pass` worker success logs expose stage timing in live output
     - `pass` route and operator docs reflect the new response surface
     - `pass` targeted tests cover the updated result contract
     - `pass` a live worker restart produced real stage timing output
   - Required gates:
     - `pass` no staging or production environment used
     - `pass` runtime secrets remained ephemeral and were not persisted in repo artifacts
     - `pass` unrelated frontend/UI dirty files were not touched
   - Docs/tracker/evidence parity:
     - `pass` evidence packet added to the governed evidence surface
12. `audit_findings`
   - `blocking`
     - none
   - `non-blocking`
     - queue dispatch itself now looks smaller than the combined maintenance and recovery-prep stages on empty cycles
     - no long recovery-execution sample was captured in this slice; the new timings should be reused on the next noisy cycle window
   - `deferred`
     - use the new timings against a real queued generation and a noisy long cycle before deciding whether the next ROI is dispatch internals or observation/recovery batching
13. `parity_check`
   - `pass`
   - Notes:
     - the route/test/docs surfaces agree on the new `stageTimings` contract
     - live worker output confirms the timing payload is emitted outside of unit tests
14. `changelog_decision`
   - `deferred`
   - owner/date: `Codex / 2026-04-03`

## Phase 2A Decision
This slice was necessary before any more hot-path tuning. The repo now tells us where cycle time is actually going.

The important conclusion is:
- the `1000ms` worker interval is no longer the dominant remaining floor by itself
- empty cycles already burn a large fraction of a second inside serial maintenance/recovery-prep stages
- the next optimization should be chosen from measured stage occupancy, not from dispatch adjacency

## Next Step
Use the new stage timings against a real queued submit and the next noisy long-cycle window:
- if `queueDispatch` dominates, continue inside `frontend/lib/server/api/generationQueue/dispatch.ts`
- if `observationInboxProcessing`, `recoveryClaim`, or cleanup dominates, move Phase 2A toward serial control-plane stage reduction instead
