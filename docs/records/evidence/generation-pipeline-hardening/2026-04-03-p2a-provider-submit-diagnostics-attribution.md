# Phase 2A Provider Submit Diagnostics Attribution (2026-04-03)

1. `slice_id`
   - `p2a-provider-submit-diagnostics-attribution`
2. `date_utc`
   - `2026-04-03`
3. `phase`
   - `Phase 2A`
4. `surface`
   - provider-submit diagnostics attribution
   - queue-dispatch submitted telemetry enrichment
   - fresh-path queued-generation remeasurement
5. `commands_run`
   - targeted repo inspection for:
     - `frontend/lib/server/falIntegration/submitEngine.ts`
     - `frontend/lib/server/providerIntegration/submitProviderDispatcher.ts`
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
   - targeted validation:
     - `npm -C frontend run test -- lib/server/falIntegration/__tests__/submitEngine.test.ts lib/server/providerIntegration/__tests__/submitProviderDispatcher.test.ts lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/api/__tests__/generationQueue.dispatch.test.ts`
   - local runtime restart:
     - `npm -C frontend run dev`
     - `npm -C frontend run dev:generation-worker`
   - real queued generation submit against:
     - `http://127.0.0.1:3000/api/fal/nano-banana-submit`
   - direct `app_error_events` and `ai_generations` reads through Supabase admin runtime access
6. `results`
   - Code change:
     - Fal submit-engine results now carry diagnostics for:
       - `attemptsTried`
       - `fallbackCount`
       - `targetCount`
       - `totalDurationMs`
     - Kie submit dispatch now emits the same generic submit diagnostics alongside any provider-specific diagnostics
     - `telemetry.queue.dispatch.submitted` now persists `provider_submit_diagnostics`
   - Runtime finding:
     - the first live probe after code edits persisted `provider_submit_diagnostics = null`
     - root cause was stale local Next dev compilation; the compiled server chunk still reflected the pre-merge `providerDiagnostics` contract
     - after restarting local app and worker, the real queued probe persisted the new diagnostics correctly
   - Post-restart validation probe:
     - generation id: `02fa0d62-e96e-443c-86c9-f7505815f746`
     - `queue_latency_ms = 1965`
     - `dispatch_stage_timings_ms`:
       - `generationTransition = 461`
       - `providerSubmit = 269`
       - `capacityCheck = 117`
       - `reservationSubmit = 116`
       - `projectionSync = 113`
       - `queueRemove = 94`
     - `provider_submit_diagnostics`:
       - `attemptsTried = 1`
       - `fallbackCount = 0`
       - `targetCount = 1`
       - `totalDurationMs = 269`
   - Interpretation:
     - provider-submit telemetry is now trustworthy on the real Fal path
     - this probe showed no fallback churn and no retry overhead; `providerSubmit` was only `269ms`
     - the remaining higher-ROI optimization surface is no longer inside provider helper attribution, but in the serial claimed-item batch loop and the per-item post-accept mutation tail
7. `failure_codes_asserted`
   - no intentional generation failure path required
   - this slice was driven by successful queued-submit telemetry and provider-submit diagnostics parity
8. `contract_parity_delta`
   - no authority change
   - no browser/runtime ownership change
   - successful queue-dispatch telemetry now carries provider-submit diagnostics for real queued dispatches
9. `rollback_note`
   - Revert:
     - `frontend/lib/server/falIntegration/submitEngine.ts`
     - `frontend/lib/server/providerIntegration/submitProviderDispatcher.ts`
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
     - `frontend/lib/server/falIntegration/__tests__/submitEngine.test.ts`
     - `frontend/lib/server/providerIntegration/__tests__/submitProviderDispatcher.test.ts`
     - `frontend/lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`
   - Expected rollback effect:
     - queue-dispatch submitted telemetry loses provider-submit diagnostics
     - Fal and Kie submit paths stop emitting generic submit-attribution detail
10. `linked_pr`
   - None
11. `task_contract_checklist`
   - DoD:
     - `pass` Fal submit results expose generic submit diagnostics
     - `pass` Kie submit results expose the same generic diagnostics alongside provider-specific detail
     - `pass` successful queue-dispatch telemetry persists `provider_submit_diagnostics`
     - `pass` targeted tests cover the enriched dispatcher and telemetry contract
     - `pass` live queued-submit telemetry shows the real diagnostics on the Fal path
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
     - local dev runtime needed an explicit restart before the compiled route reflected the new diagnostics contract
     - single-sample queue latency variance remains real, so this slice should be interpreted primarily as attribution restoration, not as a fresh-path latency win
   - `deferred`
     - continue the next Phase 2A slice on batch-level queue-item serialization in `dispatchGenerationSubmitQueueBatch(...)`
     - if bounded concurrency is not yet safe, collapse more of the post-accept mutation tail before revisiting provider-submit internals
13. `parity_check`
   - `pass`
   - Notes:
     - targeted tests, source diff, and live queued-submit telemetry agree on the new diagnostics contract
     - the live post-restart probe shows `providerSubmit` is no longer the best remaining repo-local latency lever
14. `changelog_decision`
   - `deferred`
   - owner/date: `Codex / 2026-04-03`

## Phase 2A Decision
This slice is complete.

It was worth doing because it resolved an important ambiguity: whether `providerSubmit` still hid meaningful repo-local overhead. The answer from the real queued path is now clear enough to pivot.

## Next Step
Take the next Phase 2A slice on claimed-batch serialization in `frontend/lib/server/api/generationQueue/dispatch.ts`, not on deeper provider-submit helper tuning.
