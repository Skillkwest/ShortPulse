# Lane F Evidence Packet: F1-01 CI Inventory And Required-Check Contract

- `slice_id`: `F1-01`
- `date_utc`: `2026-03-17`
- `scope`:
  - `docs/planning/ci-policy-checks.md`
  - `docs/release-checklist.md`
  - `docs/archive/planning/lane-f-execution-plan-2026-03-16.md`
  - `docs/archive/planning/lane-f-master-plan-2026-03-16.md`
  - `docs/records/evidence/lane-f/README.md`
  - `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`

## commands_run
1. `rg -n "agent_rollback_verification|AGENT_ROLLBACK_VERIFICATION_MODE" .github/workflows/ci.yml docs/planning/ci-policy-checks.md`
2. `npm -C frontend run docs:check`

## results
1. Added missing CI job inventory coverage for `agent_rollback_verification`.
2. Added missing policy-as-code artifact coverage for `scripts/check_agent_rollback_verification.js`.
3. Added explicit mode-variable policy for `AGENT_ROLLBACK_VERIFICATION_MODE`.
4. Added `npm -C frontend run docs:check` to the engineering checks in `docs/release-checklist.md` so release-policy surfaces reflect the canonical docs gate.

## ci_inventory_before_after
1. Targeted inventory drift for rollback verification coverage:
   - before: workflow present, CI policy missing
   - after: workflow present, CI policy present

## required_check_delta
1. Target required-check catalog now includes `agent_rollback_verification` for the active policy contract.

## owner_identity_delta
1. None.

## environment_policy_delta
1. None.

## plan_tier_enforcement_state
1. Branch/ruleset enforcement remains plan-limited; `F1-01` only repairs CI policy parity.

## rollback_note
1. Revert the CI policy and release-checklist changes together if the rollback verification job is removed or renamed.

## linked_pr
1. Pending.
