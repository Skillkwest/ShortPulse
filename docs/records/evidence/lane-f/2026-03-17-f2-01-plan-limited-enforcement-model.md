# Lane F Evidence Packet: F2-01 Plan-Limited Enforcement Model

- `slice_id`: `F2-01`
- `date_utc`: `2026-03-17`
- `scope`:
  - `docs/planning/evidence/docs/2026-02-20-branch-protection-required-check-mapping.md`
  - `docs/planning/evidence/docs/2026-02-21-stg-06-prototype-waiver.md`
  - `docs/planning/ci-policy-checks.md`
  - `docs/archive/planning/lane-f-execution-plan-2026-03-16.md`
  - `docs/archive/planning/lane-f-master-plan-2026-03-16.md`
  - `docs/records/evidence/lane-f/README.md`
  - `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`

## commands_run
1. `sed` review of current branch-protection evidence and prototype waiver docs
2. `rg -n "sleepyseamonster|worldbuilder|prototype-mode waiver|production-readiness|plan tier|enforceable" ...`
3. `npm -C frontend run docs:check`

## results
1. Refreshed the active branch-protection mapping evidence to current Lane F state.
2. Added `agent_rollback_verification` to the documented target required-check inventory in the branch-protection evidence artifact.
3. Refreshed operator/owner identity on the active waiver/evidence surfaces to the current single-owner baseline (`worldbuilder`).
4. Made the prototype-mode waiver explicitly current and review-triggered instead of leaving it as stale inherited STG-06 text.
5. Added explicit production-readiness blocker language to the CI manual-evidence policy surface.

## ci_inventory_before_after
1. No CI workflow edits in `F2-01`.
2. Compensating-control evidence now matches the current CI required-check target inventory, including `agent_rollback_verification`.

## required_check_delta
1. No workflow-side required-check changes.
2. Manual branch-protection evidence now reflects the current intended required-check target set.

## owner_identity_delta
1. Active waiver/evidence owner/operator fields moved from legacy `@sleepyseamonster` references to the current single-owner operating model (`worldbuilder`) for these active control artifacts.

## environment_policy_delta
1. None in `F2-01`.

## plan_tier_enforcement_state
1. Still `plan-limited`.
2. Current posture:
   - manual evidence is the active compensating control,
   - prototype-mode waiver remains active,
   - production-readiness remains blocked until enforceable repository-plan support exists and the waiver is retired.

## rollback_note
1. Revert the compensating-control refresh docs together if the plan-limited enforcement model is redefined.
2. Do not silently remove the blocker language unless repository-plan capability or equivalent enforceability materially changes.

## linked_pr
1. Pending.
