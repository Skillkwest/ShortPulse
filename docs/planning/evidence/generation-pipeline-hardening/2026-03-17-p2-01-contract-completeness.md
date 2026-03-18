# Generation Pipeline Hardening Evidence Packet: P2-01 Contract Completeness

- `slice_id`: `P2-01`
- `date_utc`: `2026-03-17`
- `phase`: `P2`
- `surface`: `model contract completeness`

## commands_run
1. `npm -C frontend run test -- lib/server/api/__tests__/falPayloadValidation.test.ts tests/api/fal-submit-proxy.test.ts`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`

## results
1. Completed allowlist completeness in the shared validator without changing production submit behavior.
2. The validator now resolves known top-level fields from each model's existing payload spec when an explicit allowlist is absent.
3. Added explicit contract options for:
   - `projectAllowedTopLevelFields`
   - `enforceAllowedTopLevelFields`
4. Current production submit handlers still use the default non-enforcing path.
5. Completeness coverage is now test-backed across all `26` payload-validated models:
   - representative per-model payloads pass under allowlist enforcement
   - injected unknown fields fail deterministically with `GENERATION_PAYLOAD_CONTRACT_VIOLATION`
6. Full gate bundle passed:
   - `lint`: pass with baseline `2` warnings
   - `type-check`: pass
   - `build`: pass
   - `docs:check`: pass

## failure_codes_asserted
1. `GENERATION_PAYLOAD_CONTRACT_VIOLATION`
2. Asserted for unknown top-level field injections under explicit allowlist enforcement in the shared validator tests.

## contract_parity_delta
1. Contract completeness is now proven at the validator layer before runtime submit/dispatch enforcement.
2. Submit proxy behavior remains unchanged because enforcement options are not yet enabled in production callers.
3. `P3-01` can now wire submit enforcement without guessing about current model-field coverage.

## rollback_note
1. Revert the allowlist-resolution/enforcement option additions and completeness tests together if `P2-01` needs to be reopened.
2. Do not partially revert only the tests; that would drop the coverage floor for later enforcement slices.

## linked_pr
1. Pending.

## task_contract_checklist
1. Definition of done: pass
2. Required gates attached: pass
3. Docs/tracker/evidence parity complete: pass

## audit_findings
- `blocking`: none
- `non-blocking`:
  - explicit `allowedTopLevelFields` arrays remain optional because the validator now derives a deterministic allowlist from the existing spec surface
- `deferred`:
  - `P3-01` must enable submit-path enforcement and projected-payload usage using the now-proven completeness surface

## parity_check
1. `pass`
2. Completeness is enforced only inside targeted tests in `P2-01`; no route behavior changed yet.

## changelog_decision
1. `deferred`
2. Owner: `Engineering`
3. Target date: `2026-03-24`
4. Rationale: `P2-01` is still internal contract hardening with no operator-facing behavior change.
