# Phase 2A Queue Claim Generation Field Hoist (2026-04-02)

1. `slice_id`
   - `p2a-queue-claim-generation-field-hoist`
2. `date_utc`
   - `2026-04-03`
3. `phase`
   - `Phase 2A`
4. `surface`
   - queue-claim RPC contract
   - queue dispatch per-item database round trips
   - fresh-path queue latency validation after claim enrichment
5. `commands_run`
   - targeted repo inspection for:
     - `frontend/lib/server/api/generationQueue/service.ts`
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
     - `sql/migrations/070_harden_queue_claim_collision_advisory_lock.sql`
   - targeted validation:
     - `npm -C frontend run test -- lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/api/__tests__/generationQueue.dispatch.test.ts lib/server/generationControlPlane/__tests__/runCycle.test.ts`
   - migration apply in approved dev:
     - `psql -f sql/migrations/078_add_generation_fields_to_queue_claim.sql`
   - resident worker restart via:
     - `npm -C frontend run dev:generation-worker`
   - real queued generation submits against:
     - `http://127.0.0.1:3000/api/fal/nano-banana-submit`
   - direct `app_error_events` verification through read-only `psql`
   - canonical latency SQL:
     - `psql -f sql/check_generation_queue_dispatch_latency.sql`
6. `results`
   - Code change:
     - enriched `claim_generation_submit_queue_batch(...)` with:
       - `generation_provider`
       - `generation_request_id`
       - `generation_metadata`
     - updated `ClaimedGenerationQueueItem` and parser to consume those fields
     - removed the per-item `ai_generations` read from `processClaimedQueueItem(...)`
     - dispatch now uses claim-supplied generation fields for:
       - existing request-id reconciliation
       - provider resolution
       - metadata merge during accepted-running transition
       - queue latency calculation
   - Migration:
     - added `sql/migrations/078_add_generation_fields_to_queue_claim.sql`
     - added paired rollback:
       - `sql/migrations/rollback/078_add_generation_fields_to_queue_claim_rollback.sql`
     - first apply attempt failed because PostgreSQL does not allow `CREATE OR REPLACE` when the function return type changes
     - migration was corrected to `DROP FUNCTION ...` before recreation, then re-applied successfully in approved dev
   - Runtime validation:
     - first post-migration probe:
       - generation id: `eca9f748-4b25-42a8-9959-fbd6f386a7fa`
       - observed `queue_latency_ms = 2761`
       - worker logs around that window showed a noisy long cycle and a `queueClaimed=1 queueSubmitted=1` cycle with elevated duration
     - repeat post-migration probe:
       - generation id: `ff2a8b16-c595-4363-92a8-e230a3a9fccb`
       - observed `queue_latency_ms = 1132`
     - interpretation:
       - the migration-backed optimization removed a real per-item DB round trip
       - the first live sample was noisy and not reliable as the sole signal
       - the repeat sample returned to the fast band established by the earlier Phase 2A work
   - Canonical queue SQL after the slice:
     - `last_15m` rows:
       - `2761`
       - `1132`
       - `1079`
     - `last_15m` aggregate:
       - `avg_queue_latency_ms = 1657`
       - `p50_queue_latency_ms = 1132`
       - `p95_queue_latency_ms = 2598`
       - `max_queue_latency_ms = 2761`
7. `failure_codes_asserted`
   - no intentional generation failure path was required for this slice
   - migration apply correction was required:
     - PostgreSQL rejected return-type mutation without dropping the existing function first
8. `contract_parity_delta`
   - queue-claim authority is unchanged
   - the claim contract now carries the generation fields that dispatch already needed, removing the redundant follow-up read
   - this is a contract-expansion change between SQL and application code, not an architecture change
9. `rollback_note`
   - Revert:
     - `frontend/lib/server/api/generationQueue/service.ts`
     - `frontend/lib/server/api/generationQueue/dispatch.ts`
     - `frontend/lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`
     - `sql/migrations/078_add_generation_fields_to_queue_claim.sql`
     - `sql/migrations/rollback/078_add_generation_fields_to_queue_claim_rollback.sql`
   - Expected rollback effect:
     - queue dispatch resumes per-item `ai_generations` lookups
     - claim payload shrinks back to queue-table fields only
10. `linked_pr`
   - None
11. `task_contract_checklist`
   - DoD:
     - `pass` claim RPC expanded to include generation fields needed by dispatch
     - `pass` dispatch removed the redundant per-item generation lookup
     - `pass` migration applied successfully in approved dev
     - `pass` worker restarted on the updated code and contract
     - `pass` real post-migration queued generations were measured
   - Required gates:
     - `pass` no staging or production environment used
     - `pass` runtime secrets were used ephemerally only and not persisted in repo artifacts
     - `pass` temporary probe auth users were deleted after verification
   - Docs/tracker/evidence parity:
     - `pass` migration inventory docs updated
     - `pass` evidence packet added to the governed evidence surface
12. `audit_findings`
   - `blocking`
     - none
   - `non-blocking`
     - this slice reduces redundant work, but the live latency signal was mixed rather than cleanly better
     - the remaining latency budget still appears dominated by cycle timing and dispatch-path variability, not just the removed lookup
   - `deferred`
     - deeper dispatch hot-path work around per-item capacity evaluation and refill-pass strategy
     - optional stage-timing instrumentation if more precise latency attribution is needed
13. `parity_check`
   - `pass`
   - Notes:
     - the SQL and TypeScript contracts are aligned
     - the worker ran successfully on the new contract in approved dev
     - the repeat live sample showed the optimization did not regress the fast path, but it also did not prove another clear UX win on its own
14. `changelog_decision`
   - `deferred`
   - owner/date: `Codex / 2026-04-02`

## Phase 2A Decision
This slice is structurally sound and removes redundant per-item work, but its UX impact is weaker than the prior two Phase 2A slices.

The right interpretation is:
- keep the contract cleanup because it simplifies the hot path and passed live validation
- do not claim it as a clear latency breakthrough
- continue measuring against the remaining dispatch-path bottlenecks

## Next Step
Continue Phase 2A inside `frontend/lib/server/api/generationQueue/dispatch.ts`:
- inspect per-item capacity evaluation and refill-pass behavior
- prefer the next change that can produce a cleaner UX win than this slice did
