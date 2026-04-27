# Phase 2A Parallel Shared Capacity Snapshots (2026-04-03)

1. `slice_id`
   - `p2a-parallel-shared-capacity-snapshots`
2. `date_utc`
   - `2026-04-03`
3. `phase`
   - `Phase 2A`
4. `surface`
   - queue-dispatch capacity-check shared-provider path
   - fresh-path queue-dispatch latency remeasurement
5. `commands_run`
   - targeted repo inspection for:
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
     - `frontend/lib/server/api/generationQueue/activeProviderCapacity.ts`
     - `frontend/lib/server/api/__tests__/generationQueue.dispatch.test.ts`
   - targeted validation:
     - `npm -C frontend run test -- lib/server/api/__tests__/generationQueue.dispatch.test.ts lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/api/__tests__/activeProviderCapacity.test.ts`
   - resident worker restart via:
     - `npm -C frontend run dev:generation-worker`
   - real queued generation submit against:
     - `http://127.0.0.1:3000/api/fal/nano-banana-submit`
   - direct `app_error_events` read through Supabase admin runtime access
6. `results`
   - Code change:
     - when shared-provider admission is enabled, queue dispatch now starts the user-scoped and shared-scoped capacity snapshots together via `Promise.all(...)`
     - no admission semantics changed; only the independent read ordering changed
     - added regression coverage proving both snapshot reads start together in the shared-provider branch
   - Prior comparison point:
     - generation id: `2030b4dd-9930-476e-a2c8-91983b39d763`
     - `queue_latency_ms = 1364`
     - `capacityCheck = 208`
     - `queueDispatch.durationMs = 1538`
   - Post-change validation probe:
     - generation id: `e6103079-574c-44d8-9c6b-358fc683fecf`
     - `queue_latency_ms = 1429`
     - `dispatch_stage_timings_ms`:
       - `generationTransition = 471`
       - `providerSubmit = 236`
       - `capacityCheck = 128`
       - `queueRemove = 121`
       - `reservationSubmit = 112`
       - `projectionSync = 110`
     - worker cycle:
       - `queueDispatch.durationMs = 1541`
   - Interpretation:
     - the direct `capacityCheck` reduction was real and material: `208ms -> 128ms`
     - overall queue latency stayed in the same fast band, so this is a valid local improvement but not a full end-to-end step-change
     - with capacity-check overhead reduced again, `providerSubmit` is now the clearest remaining fresh-path contributor under repo-local dispatch control
7. `failure_codes_asserted`
   - no intentional generation failure path required
   - this slice was driven by successful queued-submit telemetry and shared-provider branch regression coverage
8. `contract_parity_delta`
   - no authority change
   - no browser/runtime ownership change
   - queue-dispatch capacity evaluation now performs the shared-provider read branch in parallel rather than serially
9. `rollback_note`
   - Revert:
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
     - `frontend/lib/server/api/__tests__/generationQueue.dispatch.test.ts`
   - Expected rollback effect:
     - shared-provider capacity evaluation resumes serial snapshot reads
     - `capacityCheck` should regress toward the slower shared-branch band
10. `linked_pr`
   - None
11. `task_contract_checklist`
   - DoD:
     - `pass` shared-provider capacity reads start together
     - `pass` admission semantics remain unchanged
     - `pass` targeted tests cover the new shared-provider branch behavior
     - `pass` worker restarted on the updated code
     - `pass` a real queued generation produced lower `capacityCheck` timing on the updated code
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
     - overall queue latency did not move materially because `providerSubmit` and `generationTransition` still dominate the post-capacity path
     - this improvement matters most when shared-provider admission is active; non-shared lanes are unchanged
   - `deferred`
     - take the next Phase 2A slice on `providerSubmit`
     - if provider-start improvement is not cleanly available, revisit broader Phase 2B-style admission batching/caching
13. `parity_check`
   - `pass`
   - Notes:
     - targeted tests and live telemetry agree that the shared-provider capacity branch is shorter
     - the live probe preserved the same dispatch correctness and fast-band queue behavior
14. `changelog_decision`
   - `deferred`
   - owner/date: `Codex / 2026-04-03`

## Phase 2A Decision
This slice is complete.

It is worth keeping because it delivers a measured `capacityCheck` reduction without changing admission semantics or expanding architecture.

## Next Step
Continue Phase 2A on `providerSubmit` as the clearest remaining fresh-path contributor under dispatch control.
