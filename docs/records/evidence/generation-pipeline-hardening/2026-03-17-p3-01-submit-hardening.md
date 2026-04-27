# Generation Pipeline Hardening Evidence Packet: P3-01 Submit Hardening

- `slice_id`: `P3-01`
- `date_utc`: `2026-03-17`
- `phase`: `P3`
- `surface`: `submit`

## commands_run
1. `npm -C frontend run test -- tests/api/fal-submit-proxy.test.ts lib/server/api/__tests__/falPayloadValidation.test.ts`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`

## results
1. Moved the shared payload contract gate into `createFalSubmitHandler`.
2. The shared gate now runs after prompt rewrite and before billing, queueing, or provider submit.
3. Submit requests now fail closed with deterministic `400` responses when the shared contract is violated.
4. Submit requests now return the deterministic code `GENERATION_PAYLOAD_CONTRACT_VIOLATION` for:
   - shared contract violations
   - legacy route-specific validation failures routed through the common submit handler
5. Projected payload output from the shared gate is now the canonical downstream submit payload for:
   - billing
   - queue admission/queue persistence
   - provider submission
   - submit persistence
6. Targeted tests passed:
   - shared unknown-field rejection before billing
   - custom validator failure still returns deterministic contract code
   - existing submit target fallback/retry/request-id alias paths remain green with contract-valid bodies
7. Full gate bundle passed:
   - `lint`: pass with baseline `2` warnings
   - `type-check`: pass
   - `build`: pass
   - `docs:check`: pass

## failure_codes_asserted
1. `GENERATION_PAYLOAD_CONTRACT_VIOLATION`
2. Asserted on shared contract violation and common submit-handler validation responses.

## contract_parity_delta
1. Intentional behavior change: submit now rejects unknown top-level fields and other shared contract violations before any billing or provider side effects.
2. Existing custom validators remain in place as a second validation layer for route-specific semantics.
3. Dispatch path is not yet hardened in this slice; `P3-02` remains required for queue revalidation.

## rollback_note
1. Revert the submit-handler contract enforcement and the targeted test updates together if `P3-01` must be reopened.
2. Do not keep the test-body updates without the enforcement change; those payloads were only normalized to reflect the new contract boundary.

## linked_pr
1. Pending.

## task_contract_checklist
1. Definition of done: pass
2. Required gates attached: pass
3. Docs/tracker/evidence parity complete: pass

## audit_findings
- `blocking`: none
- `non-blocking`:
  - route files using `validateFalPayloadForModel(...)` still duplicate shared validation logic; cleanup is deferred because behavior is correct and the current seam stayed narrow
- `deferred`:
  - `P3-02` must enforce the same contract on queued payloads before provider dispatch
  - `P3-03` must add explicit queue/generation/reservation identity fail-closed handling

## parity_check
1. `pass`
2. Submit hardening is the intentional Track P1 behavior change in this slice; fallback/retry/admission flows remained green after the new contract gate was inserted.

## changelog_decision
1. `deferred`
2. Owner: `Engineering`
3. Target date: `2026-03-24`
4. Rationale: this is an internal API hardening change without user-facing release notes yet; operator/SOP closeout is reserved for `P5-01`.
