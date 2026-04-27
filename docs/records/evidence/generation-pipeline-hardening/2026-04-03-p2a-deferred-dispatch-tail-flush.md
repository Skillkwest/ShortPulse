# Phase 2A Deferred Dispatch Tail Flush (2026-04-03)

1. `slice_id`
   - `p2a-deferred-dispatch-tail-flush`
2. `date_utc`
   - `2026-04-03`
3. `phase`
   - `Phase 2A`
4. `surface`
   - queued dispatch post-accept tail handling
   - claimed-batch throughput overlap
   - queue-dispatch regression coverage for pending projection tail work
5. `commands_run`
   - targeted repo inspection for:
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
     - `frontend/lib/server/api/__tests__/generationQueue.dispatch.test.ts`
     - `frontend/lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`
   - targeted validation:
     - `npm -C frontend run test -- lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/api/__tests__/generationQueue.dispatch.test.ts`
   - resident worker restart via:
     - `npm -C frontend run dev:generation-worker`
   - real queued generation probes against:
     - `http://127.0.0.1:3000/api/fal/nano-banana-submit`
   - direct `app_error_events` reads through Supabase admin runtime access
   - worker console inspection for same-pass claimed batch behavior
6. `results`
   - Code change:
     - queue-dispatch authority-critical steps remain serialized per claimed item:
       - `capacityCheck`
       - `providerSubmit`
       - `reservationSubmit`
       - `generationTransition`
       - `queueRemove`
     - non-authoritative post-accept tail work now runs as deferred per-item work inside the batch:
       - `projectionSync`
       - `telemetry.queue.dispatch.submitted`
     - deferred tails are still flushed before the pass completes via `Promise.allSettled(...)`, so the cycle remains internally coherent without blocking the next claimed item on compatibility tail work
   - Regression proof:
     - new integrity test blocks the first item's projection sync tail and proves the second claimed item still reaches `providerSubmit`
     - this locks the intended overlap behavior without relaxing queue/admission invariants
   - Live single-item probe:
     - generation id: `536af871-4e0a-4387-965c-44d231a7473c`
     - `queue_latency_ms = 4496`
     - interpretation:
       - this slice is not a reliable fresh-path single-item latency reducer
       - single-item variance remained noisy and is not the main validation signal for this change
   - Live two-item burst probe:
     - generation ids:
       - `0c13e4a6-12e1-4681-a562-1f9e5702ce5e`
       - `9f4682e9-e02d-4491-8515-cd320aac8709`
     - dispatch telemetry:
       - item 1:
         - `queue_latency_ms = 1929`
         - `generationTransition = 456`
         - `providerSubmit = 206`
         - `projectionSync = 106`
       - item 2:
         - `queue_latency_ms = 1437`
         - `generationTransition = 486`
         - `providerSubmit = 72`
         - `projectionSync = 128`
     - worker cycle:
       - `queueClaimed = 2`
       - `queueSubmitted = 2`
       - `queueDispatch.durationMs = 2765`
   - Interpretation:
     - the main value of this slice is safe same-pass overlap, not single-item speed
     - the unit regression proves the second claimed item can advance while the first item's compatibility tail is still pending
     - the live worker cycle confirms two claimed items were processed successfully in one pass on the updated code
7. `failure_codes_asserted`
   - no intentional generation failure path required
   - this slice was validated through success-path dispatch behavior and the new blocked-tail regression test
8. `contract_parity_delta`
   - no authority change
   - no queue claim semantic change
   - no admission/capacity policy change
   - no browser/runtime ownership change
   - only the placement of non-authoritative queue-dispatch tail work changed
9. `rollback_note`
   - Revert:
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
     - `frontend/lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`
   - Expected rollback effect:
     - each claimed item resumes waiting for projection sync and submitted telemetry before the next claimed item can start
     - same-pass overlap between claimed items is lost
10. `linked_pr`
   - None
11. `task_contract_checklist`
   - DoD:
     - `pass` queue-dispatch authority-critical section remains serialized
     - `pass` projection sync and submitted telemetry move out of the per-item hot path
     - `pass` deferred tails are still flushed before pass completion
     - `pass` regression coverage proves later claimed items advance while earlier projection tail work is pending
     - `pass` live worker cycle processed a two-item claimed batch successfully on the updated code
   - Required gates:
     - `pass` no staging or production environment used
     - `pass` runtime secrets remained ephemeral and were not persisted in repo artifacts
     - `pass` disposable probe auth users removed after verification
     - `pass` unrelated frontend/UI dirty files remained untouched
   - Docs/tracker/evidence parity:
     - `pass` evidence packet added to the governed evidence surface
12. `audit_findings`
   - `blocking`
     - none
   - `non-blocking`
     - this slice did not prove a clean fresh-path single-item latency reduction
     - the strongest evidence is unit-locked overlap behavior plus successful live two-item same-pass processing, not a headline latency number
   - `deferred`
     - continue with either:
       - a more explicit bounded claimed-batch concurrency model, or
       - another safe reduction of the remaining authoritative post-accept tail
13. `parity_check`
   - `pass`
   - Notes:
     - targeted tests, source diff, and live same-pass worker behavior all agree on the new overlap contract
     - this slice should be interpreted as a safe throughput/occupancy improvement, not as a fresh-path latency re-baseline
14. `changelog_decision`
   - `deferred`
   - owner/date: `Codex / 2026-04-03`

## Phase 2A Decision
This slice is complete.

It is worth keeping because it reduces unnecessary per-item blocking without weakening queue authority, claim semantics, or admission correctness.

## Next Step
Reassess whether the next higher-ROI move is:
- bounded claimed-batch concurrency with admission-bucket guards, or
- another reduction of the remaining authoritative serial tail in `dispatch.ts`
