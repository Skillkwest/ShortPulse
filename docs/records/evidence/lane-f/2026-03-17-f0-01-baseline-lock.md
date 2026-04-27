# Lane F Evidence Packet: F0-01 Baseline Lock

- `slice_id`: `F0-01`
- `date_utc`: `2026-03-17`
- `scope`:
  - `docs/archive/planning/lane-f-execution-plan-2026-03-16.md`
  - `docs/archive/planning/lane-f-master-plan-2026-03-16.md`
  - `docs/records/evidence/lane-f/README.md`
  - `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
  - `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`
  - `docs/planning/README.md`
  - `docs/README.md`

## commands_run
1. `node` inventory script over `.github/workflows/ci.yml` for job count, action `uses:` count, full-SHA pin count, and mode-variable inventory
2. `rg -n "agent_rollback_verification|AGENT_ROLLBACK_VERIFICATION_MODE" .github/workflows/ci.yml docs/planning/ci-policy-checks.md`
3. `npm -C frontend run docs:check`

## results
1. Published the missing Lane F execution plan.
2. Wired Lane F execution-plan references into active planning/root roadmap surfaces.
3. Moved Lane F from `Not Started` to `In Progress` in the foundation tracker.
4. Locked the current baseline metrics:
   - CI job inventory count: `17`
   - action `uses:` count in `.github/workflows/ci.yml`: `3`
   - full-SHA pinned action references: `0`
   - `agent_rollback_verification` drift: present in workflow, absent from `docs/planning/ci-policy-checks.md`

## ci_inventory_before_after
1. Baseline only in `F0-01`; no workflow inventory remediation attempted.
2. Current CI job IDs:
   - `deadcode`
   - `frontend`
   - `phase11_fal_regression`
   - `type_check`
   - `docs_semantic_drift`
   - `migration_parity`
   - `archive_manifest_check`
   - `sql_lint`
   - `architecture_boundary`
   - `size_budget`
   - `agent_contract_tests`
   - `agent_disable_continuity`
   - `agent_rollback_verification`
   - `adaptive_media_gate`
   - `ai_studio_perf_gate`
   - `secret_scan`
   - `security`

## required_check_delta
1. None in `F0-01`; this baseline confirms `F1-01` is the next required-check parity seam.

## owner_identity_delta
1. None in `F0-01`; owner-identity normalization remains downstream Lane F work.

## environment_policy_delta
1. None in `F0-01`; environment naming/protection posture remains downstream Lane F work.

## plan_tier_enforcement_state
1. Private-repo branch/ruleset API access remains plan-limited by baseline policy and existing waiver artifacts.

## rollback_note
1. Revert the execution-plan/index/tracker updates together if Lane F bootstrap needs to be reopened.
2. Baseline metrics should be treated as historical evidence once downstream slices begin.

## linked_pr
1. Pending.
