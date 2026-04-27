# Generation Pipeline Hardening Evidence Packet: P1-01 Shared Contract Gate

- `slice_id`: `P1-01`
- `date_utc`: `2026-03-17`
- `phase`: `P1`
- `surface`: `shared contract utility`

## commands_run
1. `npm -C frontend run test -- tests/api/fal-submit-proxy.test.ts lib/server/api/__tests__/falPayloadValidation.test.ts`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`

## results
1. Added shared `valid | violation` payload contract result in `frontend/lib/server/api/falPayloadValidation.ts`.
2. Extended `ModelPayloadValidationSpec` with `allowedTopLevelFields?: string[]` in `frontend/lib/model-runtime/modelCatalog.ts`.
3. `createFalSubmitHandler` now accepts projected payload output from the contract gate while remaining backward-compatible with legacy `error | null` validators.
4. No enforce-mode behavior drift was introduced:
   - current models do not yet declare `allowedTopLevelFields`
   - projected payload therefore defaults to a shallow clone of the current payload
5. New targeted tests passed:
   - contract projection + deterministic violation coverage
   - submit proxy uses projected payload when available
   - submit proxy still fails `400` on reported contract violations
6. Full gate bundle passed:
   - `lint`: pass with baseline `2` warnings
   - `type-check`: pass
   - `build`: pass
   - `docs:check`: pass

## failure_codes_asserted
1. `GENERATION_PAYLOAD_CONTRACT_VIOLATION`
2. Asserted as the deterministic shared contract violation code in the new utility tests only; not yet emitted by submit/dispatch routes.

## contract_parity_delta
1. Shared projected-payload path is now available to submit/dispatch consumers.
2. Unknown-field rejection remains deferred until `P2-01` allowlist completeness is complete.
3. Legacy custom validators remain compatible because `createFalSubmitHandler` still accepts existing `error | null` validators.

## rollback_note
1. Revert the contract utility, submit-proxy compatibility layer, and targeted tests together if `P1-01` needs to be reopened.
2. Do not partially revert only the proxy wiring; that would strand the new contract type without a consumer.

## linked_pr
1. Pending.

## task_contract_checklist
1. Definition of done: pass
2. Required gates attached: pass
3. Docs/tracker/evidence parity complete: pass

## audit_findings
- `blocking`: none
- `non-blocking`:
  - route-specific validators still mix shared contract validators and legacy custom validators; convergence is intentionally deferred to later Track P1 slices
- `deferred`:
  - `P2-01` must populate `allowedTopLevelFields` coverage before any unknown-field enforcement can be enabled

## parity_check
1. `pass`
2. The projected-payload path is available, but current runtime behavior is unchanged because allowlist enforcement is still deferred.

## changelog_decision
1. `deferred`
2. Owner: `Engineering`
3. Target date: `2026-03-24`
4. Rationale: `P1-01` is an internal hardening seam with no end-user-visible behavior change yet.
