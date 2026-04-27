# Generation Pipeline Hardening Evidence Packet: P3-03 Identity Invariant Lock

- `slice_id`: `P3-03`
- `date_utc`: `2026-03-17`
- `phase`: `P3`
- `surface`: `queue identity invariants`

## commands_run
1. `npm -C frontend run test -- lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/api/__tests__/falPayloadValidation.test.ts tests/api/fal-submit-proxy.test.ts`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`

## results
1. Added queue/generation/reservation identity invariant enforcement in `frontend/lib/server/api/generationQueue/transitionGuard.ts`.
2. Queue dispatch now validates that queued `sourceRef` matches:
   - generation metadata `source_ref` before provider submit
   - reservation RPC `sourceRef` after provider acceptance
3. Identity mismatches now fail closed deterministically with:
   - queue row exhausted
   - reservation released
   - generation marked failed
   - `lastErrorCode: "QUEUE_IDENTITY_MISMATCH"`
4. Integrity coverage now proves:
   - generation metadata mismatches stop dispatch before provider submit
   - reservation result mismatches fail closed after provider acceptance without retry requeue
5. Full gate bundle passed:
   - targeted tests: pass (`29` tests across dispatch integrity, shared contract, and submit hardening suites)
   - `lint`: pass with baseline `2` warnings
   - `type-check`: pass
   - `build`: pass
   - `docs:check`: pass

## failure_codes_asserted
1. `QUEUE_IDENTITY_MISMATCH`
2. Asserted in queue-dispatch integrity coverage for:
   - generation metadata `source_ref` mismatch
   - reservation submission `sourceRef` mismatch

## contract_parity_delta
1. Intentional behavior change: queue dispatch now refuses to continue when queue, generation, and reservation identity surfaces disagree.
2. Identity mismatches no longer fall through generic retry/error handling; they settle fail closed deterministically.
3. `P4-01` remains required for claim-collision remediation on the queue-claim path.

## rollback_note
1. Revert the identity invariant gate and the paired integrity-test updates together if `P3-03` needs to be reopened.
2. Do not keep the new mismatch tests without the fail-closed invariant enforcement; they codify the new hardening boundary.

## linked_pr
1. Pending.

## task_contract_checklist
1. Definition of done: pass
2. Required gates attached: pass
3. Docs/tracker/evidence parity complete: pass

## audit_findings
- `blocking`: none
- `non-blocking`:
  - queue dispatch still depends on claim RPC correctness before identity hardening can fully eliminate collision-style misrouting
- `deferred`:
  - `P4-01` must harden claim-collision behavior in the queue claim RPC path
  - `P5-01` still needs ADR/SOP/operator closeout for the new failure codes

## parity_check
1. `pass`
2. Identity hardening is the intentional Track P1 behavior change in this slice; valid queued dispatch paths remained green under the new invariant checks.

## changelog_decision
1. `deferred`
2. Owner: `Engineering`
3. Target date: `2026-03-24`
4. Rationale: this is internal queue hardening and will be documented with operator runbooks during `P5-01`.
