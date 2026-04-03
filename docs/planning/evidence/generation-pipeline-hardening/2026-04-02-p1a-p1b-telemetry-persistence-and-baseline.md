# Phase 1 Telemetry Persistence And Baseline (2026-04-02)

1. `slice_id`
   - `p1a-p1b-telemetry-persistence-and-baseline`
2. `date_utc`
   - `2026-04-03`
3. `phase`
   - `Phase 1A`
   - `Phase 1B`
4. `surface`
   - Generation pipeline telemetry emit/persistence
   - Canonical queue/recovery latency SQL diagnostics
   - Real queued-generation validation in approved dev
5. `commands_run`
   - targeted repo inspection for:
     - `frontend/lib/server/api/falSubmitProxy.ts`
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
     - `frontend/lib/server/api/appErrorLogs.ts`
     - `frontend/lib/server/falIntegration/recoveryExecution.ts`
     - `frontend/pages/api/fal/queue-status.ts`
     - `frontend/pages/api/admin/generation-trace.ts`
   - real queued generation submit against `http://127.0.0.1:3000/api/fal/nano-banana-submit`
   - runtime trace checks against:
     - `http://127.0.0.1:3000/api/admin/generation-trace`
     - `http://127.0.0.1:3000/api/admin/error-events`
     - `http://127.0.0.1:3000/api/fal/queue-status`
   - direct `app_error_events` read-only verification through Supabase admin runtime access
   - `psql -f sql/check_generation_queue_dispatch_latency.sql`
   - `psql -f sql/check_generation_recovery_media_visible_latency.sql`
   - targeted validation:
     - `npm -C frontend run test -- tests/lib/app-error-logs.skip.test.ts tests/lib/app-error-logs.telemetry-event-only.integration.test.ts`
     - `npm -C frontend run test -- lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/falIntegration/__tests__/recoveryExecution.test.ts`
6. `results`
   - Pre-fix real queued generation validated the intended path:
     - submit returned `202 GENERATION_QUEUED`
     - source ref: `phase1-1775191155024_879178`
     - generation id: `dcfc9f95-c826-4af2-bbbb-0f28e7b5abcc`
     - provider request id: `019d51a3-764a-73e3-8890-7efb17bdd043`
   - Pre-fix runtime trace proved:
     - generation succeeded
     - `queue_enqueued_at=2026-04-03T04:39:16.853499+00:00`
     - `queue_dispatched_at=2026-04-03T04:39:20.411Z`
     - `telemetry.generation.recovery.media_visible` persisted
     - `telemetry.queue.dispatch.submitted` did not persist
   - Pre-fix canonical SQL results:
     - `sql/check_generation_queue_dispatch_latency.sql` returned `0 rows`
     - `sql/check_generation_recovery_media_visible_latency.sql` returned one `last_15m` row
     - observed recovery metric:
       - `provider_terminal_to_media_visible_ms = 21491`
   - Root cause identified in repo code:
     - `frontend/lib/server/api/generationQueue/dispatch.ts` writes `telemetry.queue.dispatch.submitted` through `logGenerationFailure(...)` with `statusCode: 200`
     - `frontend/lib/server/api/appErrorLogs.ts` skipped generation-scope writes when `statusCode < 400`
     - `frontend/lib/server/falIntegration/recoveryExecution.ts` wrote `telemetry.generation.recovery.media_visible` through `writeAppErrorLog(...)` without a `statusCode`, so it was not skipped
   - Fix applied:
     - telemetry-only generation events are no longer skipped solely because their status code is non-error
   - Post-fix live verification against restarted worker:
     - source ref: `phase1-dispatch-1775191968870_406066`
     - generation id: `23b0e7dc-547b-4d41-a695-c83325f7e6c3`
     - provider request id: `019d51af-e1cc-7b81-97a9-7873e9c0e17d`
     - runtime trace showed:
       - `telemetry.queue.dispatch.submitted`
       - `telemetry.api.fal_submit.queued`
     - trace metadata showed:
       - `queue_enqueued_at=2026-04-03T04:52:50.717106+00:00`
       - `queue_dispatched_at=2026-04-03T04:52:54.367Z`
       - `queue_latency_ms=3650`
   - Post-fix canonical queue SQL results:
     - `sql/check_generation_queue_dispatch_latency.sql` returned one `last_15m` row
     - observed queue metric:
       - `queue_latency_ms = 3650`
7. `failure_codes_asserted`
   - No intentional generation failure code was required for the telemetry proof run
   - Confirmed pre-fix diagnostic failure mode:
     - queue-latency SQL empty because the dispatch event family was missing, not because queue dispatch failed
8. `contract_parity_delta`
   - Phase 1 closed a real contract bug:
     - telemetry-only generation events were meant to feed `app_error_events` and repo-standard SQL diagnostics
     - low-status generation telemetry emitted through `logGenerationFailure(...)` was being dropped by skip policy
   - The telemetry contract is now aligned with the repo’s monitoring plan:
     - queue dispatch telemetry persists
     - recovery visibility telemetry persists
     - both canonical SQL diagnostics are usable
9. `rollback_note`
   - Revert:
     - `frontend/lib/server/api/appErrorLogs.ts`
     - `frontend/tests/lib/app-error-logs.skip.test.ts`
   - Expected rollback effect:
     - low-status generation telemetry emitted via `logGenerationFailure(...)` will stop persisting again
     - queue latency SQL will likely return empty results for otherwise successful dispatches
10. `linked_pr`
   - None
11. `task_contract_checklist`
   - DoD:
     - `pass` real queued generation executed in approved dev
     - `pass` `telemetry.generation.recovery.media_visible` proven in runtime and canonical SQL
     - `pass` `telemetry.queue.dispatch.submitted` root cause identified and fixed
     - `pass` queue latency SQL restored with a real row
   - Required gates:
     - `pass` no staging or production environment used
     - `pass` secrets were used ephemerally only and not persisted in repo artifacts
     - `pass` worker was restarted so the live verification exercised patched code
   - Docs/tracker/evidence parity:
     - `pass` Phase 1 evidence packet added in governed planning evidence surface
12. `audit_findings`
   - `blocking`
     - none
   - `non-blocking`
     - `frontend/pages/api/admin/generation-trace.ts` still reports legacy-schema warnings for:
       - `generation_attempts.attempt_index`
       - `ai_generation_outputs.storage_path`
     - these warnings did not block Phase 1 telemetry verification
   - `deferred`
     - full post-fix recovery-latency resample on the second patched run was not required because the Phase 1 code change only affected dispatch telemetry persistence, not recovery telemetry emission
13. `parity_check`
   - `pass`
   - Notes:
     - pre-fix evidence matched the missing-dispatch-event hypothesis
     - post-fix evidence matched the intended telemetry contract
     - canonical SQL surfaces now match the live runtime
14. `changelog_decision`
   - `deferred`
   - owner/date: `Codex / 2026-04-02`

## Phase 1 Decision
Phase 1 is complete.

The telemetry contract is now trustworthy for the approved dev runtime:
- queue dispatch telemetry is live
- recovery media-visible telemetry is live
- canonical queue/recovery latency SQL now returns real rows for validation traffic

## Next Step
Start Phase 2A:
- use the restored telemetry packet as the baseline
- target fresh-path idle latency in:
  - `frontend/lib/server/generationControlPlane/workerLoop.ts`
  - `frontend/lib/server/generationControlPlane/runCycle.ts`
  - `frontend/lib/server/api/generationQueue/dispatch.ts`
