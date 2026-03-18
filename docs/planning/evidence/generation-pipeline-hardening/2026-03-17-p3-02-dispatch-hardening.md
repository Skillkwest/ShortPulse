# Generation Pipeline Hardening Evidence Packet: P3-02 Dispatch Hardening

- `slice_id`: `P3-02`
- `date_utc`: `2026-03-17`
- `phase`: `P3`
- `surface`: `dispatch`

## commands_run
1. `npm -C frontend run test -- lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts lib/server/api/__tests__/falPayloadValidation.test.ts tests/api/fal-submit-proxy.test.ts`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`

## results
1. Added shared payload contract enforcement to queue dispatch in `frontend/lib/server/api/generationQueue/dispatch.ts`.
2. Queued payloads are now revalidated immediately before provider submit.
3. Dispatch now uses the shared projected payload for provider submission.
4. Invalid queued payloads now fail closed deterministically with:
   - queue row exhausted
   - reservation released
   - generation marked failed
   - telemetry/logging recorded
   - `lastErrorCode: "QUEUE_PAYLOAD_CONTRACT_VIOLATION"`
5. New integrity coverage proves:
   - contract-invalid queued payloads never call `dispatchProviderSubmit`
   - valid KIE queued payloads still dispatch successfully after the contract gate
6. Full gate bundle passed:
   - targeted tests: pass (`27` tests across dispatch integrity, shared contract, and submit hardening suites)
   - `lint`: pass with baseline `2` warnings
   - `type-check`: pass
   - `build`: pass
   - `docs:check`: pass

## failure_codes_asserted
1. `QUEUE_PAYLOAD_CONTRACT_VIOLATION`
2. Asserted in queue-dispatch fail-closed integrity coverage.

## contract_parity_delta
1. Intentional behavior change: queued payloads now revalidate against the same shared contract before provider dispatch.
2. Dispatch fail-closed settlement is now deterministic for contract-invalid queued payloads.
3. `P3-03` remains required for queue/generation/reservation identity mismatch fail-closed behavior.

## rollback_note
1. Revert the dispatch contract gate and the paired integrity-test updates together if `P3-02` needs to be reopened.
2. Do not keep the KIE fixture updates without the dispatch gate; those fixtures were normalized to reflect the actual model contract.

## linked_pr
1. Pending.

## task_contract_checklist
1. Definition of done: pass
2. Required gates attached: pass
3. Docs/tracker/evidence parity complete: pass

## audit_findings
- `blocking`: none
- `non-blocking`:
  - queue dispatch still relies on generation-row/provider reconciliation logic that is independent of the payload contract
- `deferred`:
  - `P3-03` identity invariants must still enforce deterministic fail-closed behavior for queue/generation/reservation mismatches
  - `P4-01` claim-collision remediation remains untouched in this slice

## parity_check
1. `pass`
2. Dispatch hardening is the intentional Track P1 behavior change in this slice; valid queued Fal and KIE dispatch paths remained green under the new gate.

## changelog_decision
1. `deferred`
2. Owner: `Engineering`
3. Target date: `2026-03-24`
4. Rationale: this is internal queue hardening and will be documented with operator runbooks during `P5-01`.
