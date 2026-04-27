# Generation Pipeline Hardening Evidence Packet: P4-01 Claim Collision Remediation

- `slice_id`: `P4-01`
- `date_utc`: `2026-03-17`
- `phase`: `P4`
- `surface`: `queue claim`

## commands_run
1. `npm -C frontend run test -- lib/server/api/__tests__/generationQueue.service.test.ts lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts tests/api/fal-submit-proxy.test.ts`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`

## results
1. Added SQL advisory-lock hardening in `sql/migrations/070_harden_queue_claim_collision_advisory_lock.sql`.
2. Added paired rollback in `sql/migrations/rollback/070_harden_queue_claim_collision_advisory_lock_rollback.sql`.
3. The claim RPC now takes a per-user advisory transaction lock during claim selection, preventing concurrent claimers from selecting different rows for the same user and colliding on `ux_ai_generation_submit_queue_dispatching_user`.
4. Added bounded app retry in `frontend/lib/server/api/generationQueue/service.ts`:
   - retries exactly once on `23505`/dispatching-user collision shape
   - uses small jittered backoff before the retry
   - preserves existing lease semantics and parsed claim payload behavior on success
5. Targeted service coverage now proves:
   - collision-shaped claim RPC errors retry once and can recover
   - persistent collision-shaped claim RPC errors still fail deterministically after the bounded retry
6. Migration inventory docs now include migration `070` and its rollback:
   - `docs/database-migrations.md`
   - `docs/sops/sop_sql_migration_operations.md`
7. Full gate bundle passed:
   - targeted tests: pass (`31` tests across queue service, dispatch integrity, and submit hardening suites)
   - `lint`: pass with baseline `2` warnings
   - `type-check`: pass
   - `build`: pass
   - `docs:check`: pass

## failure_codes_asserted
1. No new public failure code introduced in this slice.
2. Existing queue fail-closed codes remain unchanged:
   - `QUEUE_PAYLOAD_CONTRACT_VIOLATION`
   - `QUEUE_IDENTITY_MISMATCH`

## contract_parity_delta
1. Intentional runtime change: residual queue-claim collisions now get one bounded retry instead of failing immediately on the first `23505`-shape claim conflict.
2. Intentional SQL change: queue claim selection now uses per-user advisory claim locks to reduce duplicate dispatching-user collisions at the source.
3. Submit/dispatch payload and identity invariants remain unchanged from `P3-01` through `P3-03`.

## rollback_note
1. Revert the runtime retry wrapper and migration `070` together if `P4-01` needs to be reopened.
2. If SQL rollback is required, apply `sql/migrations/rollback/070_harden_queue_claim_collision_advisory_lock_rollback.sql` and revert the service/test/docs changes in the same release window.

## linked_pr
1. Pending.

## task_contract_checklist
1. Definition of done: pass
2. Required gates attached: pass
3. Docs/tracker/evidence parity complete: pass

## audit_findings
- `blocking`: none
- `non-blocking`:
  - claim collision reduction now depends on applying migration `070` in target environments; repo/runtime parity is correct but rollout still requires normal migration promotion discipline
- `deferred`:
  - `P5-01` still needs ADR and SOP closeout for the full Track P1 failure-code/operator contract

## parity_check
1. `pass`
2. Existing queue lease semantics and per-user dispatch invariants stayed intact while collision handling became more robust and deterministic.

## changelog_decision
1. `deferred`
2. Owner: `Engineering`
3. Target date: `2026-03-24`
4. Rationale: this is internal queue hardening and migration-governance work; operator-facing documentation is reserved for `P5-01` closeout.
