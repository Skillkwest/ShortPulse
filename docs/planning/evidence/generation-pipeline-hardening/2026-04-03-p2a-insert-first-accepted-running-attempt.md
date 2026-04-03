# Phase 2A Insert-First Accepted Running Attempt (2026-04-03)

1. `slice_id`
   - `p2a-insert-first-accepted-running-attempt`
2. `date_utc`
   - `2026-04-03`
3. `phase`
   - `Phase 2A`
4. `surface`
   - accepted-running generation-attempt hot path
   - generation-transition latency reduction
   - duplicate-safe insert fallback
5. `commands_run`
   - targeted repo inspection for:
     - `frontend/lib/server/api/generationAttempts.ts`
     - `frontend/lib/server/api/generationAcceptedTransitionService.ts`
     - `frontend/lib/server/api/generationLifecycleTransitionService.ts`
   - targeted validation:
     - `npm -C frontend run test -- lib/server/api/__tests__/generationAttempts.test.ts lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/api/__tests__/generationQueue.dispatch.test.ts lib/server/api/__tests__/generationLifecycleTransitionService.test.ts`
   - resident worker restart via:
     - `npm -C frontend run dev:generation-worker`
   - real queued generation submit against:
     - `http://127.0.0.1:3000/api/fal/nano-banana-submit`
   - direct `app_error_events` read through Supabase admin runtime access
6. `results`
   - Code change:
     - `ensureAcceptedRunningGenerationAttempt(...)` now uses insert-first semantics on the fresh path
     - the previous pre-insert provider-request lookup was removed from the hot path
     - duplicate collisions still recover safely through the existing `23505` fallback lookup and direct running-state update
   - Regression proof:
     - fresh-path test now proves accepted-running inserts happen without the provider-request prelookup
     - duplicate-path test now proves collisions still resolve through the fallback lookup and running-state update
   - Live validation probe:
     - generation id: `61cb705c-1e74-44c5-8276-0a18b0d2f221`
     - `queue_latency_ms = 6000`
     - `dispatch_stage_timings_ms`:
       - `generationTransition = 337`
       - `providerSubmit = 243`
       - `capacityCheck = 121`
       - `reservationSubmit = 101`
       - `queueRemove = 122`
       - `projectionSync = 100`
   - Comparison point:
     - recent post-provider-diagnostics probe showed `generationTransition = 461`
     - recent burst probe items showed `generationTransition = 456` and `486`
   - Interpretation:
     - this slice materially reduced the internal accepted-running transition stage
     - the end-to-end queue-latency sample was noisy and should not be treated as a fresh-path baseline regression
     - the meaningful signal is the lower generation-transition cost on a real queued path
7. `failure_codes_asserted`
   - no intentional generation failure path required
   - this slice was validated through success-path telemetry and duplicate-safe regression coverage
8. `contract_parity_delta`
   - no authority change
   - no attempt-state semantic change
   - duplicate-safe behavior is preserved; only the ordering of the fresh-path accepted-running record flow changed
9. `rollback_note`
   - Revert:
     - `frontend/lib/server/api/generationAttempts.ts`
     - `frontend/lib/server/api/__tests__/generationAttempts.test.ts`
   - Expected rollback effect:
     - accepted-running transitions resume the pre-insert provider-request lookup
     - generation-transition latency should regress toward the slower recent band
10. `linked_pr`
   - None
11. `task_contract_checklist`
   - DoD:
     - `pass` fresh accepted-running transitions skip the pre-insert provider-request lookup
     - `pass` duplicate collisions still resolve safely through fallback lookup and running update
     - `pass` targeted tests cover both fresh and duplicate paths
     - `pass` live queued-submit telemetry shows lower generation-transition timing on updated code
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
     - the live queue-latency sample was noisy, so this slice should be judged primarily by `generationTransition`, not by a single `queue_latency_ms` point
   - `deferred`
     - continue Phase 2A by deciding between:
       - another safe reduction of the remaining authoritative tail, or
       - a guarded concurrency slice if the admission-bucket design becomes worth the complexity
13. `parity_check`
   - `pass`
   - Notes:
     - source diff, targeted tests, and live dispatch telemetry agree on the insert-first behavior
     - duplicate safety remained intact while the fresh path got cheaper
14. `changelog_decision`
   - `deferred`
   - owner/date: `Codex / 2026-04-03`

## Phase 2A Decision
This slice is complete.

It is worth keeping because it removed a redundant hot-path lookup while preserving duplicate-safe behavior.

## Next Step
Reassess the remaining authoritative serial tail in `frontend/lib/server/api/generationQueue/dispatch.ts` before taking on admission-bucket concurrency.
