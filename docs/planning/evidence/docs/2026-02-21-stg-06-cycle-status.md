# STG-06 Warn/Evaluate Cycle Status (2026-02-21)

Date: 2026-02-21  
Stage: STG-06  
Operator: @sleepyseamonster

## Scope
- Verify whether STG-06 completion criterion "two green release cycles" is satisfied.
- Record observable CI run evidence from GitHub Actions metadata.

## Evidence snapshot

### CI workflow (`ci.yml`) recent runs
- Branch `fal-modular-makeover` recent runs are failures:
  - `22244077894` (failure)
  - `22242984069` (failure)
  - `22242667509` (failure)
  - `22242513970` (failure)
  - `22242387568` (failure)
- Branch `main` recent runs are failures with one older success:
  - `22243687034` (failure)
  - `22243617781` (failure)
  - `22243548893` (failure)
  - `22243457800` (failure)
  - `22243362387` (failure)
  - `22243258422` (failure)
  - `22241972832` (failure)
  - `22030430395` (success, older)

Refresh note:
- Re-verified with `gh run list --workflow ci.yml --limit 10 --json databaseId,headBranch,conclusion,createdAt,updatedAt,event` on 2026-02-21.
- Result now includes two consecutive green cycles on `fal-modular-makeover`:
  - `22250627010` (success)
  - `22250698460` (success)

### Incremental remediation runs (2026-02-21)
- `22250505283` (failure): workflow-file startup issue (`This run likely failed because of a workflow file issue.`), zero jobs created.
- `22250581279` (failure): startup issue fixed (jobs created/executed), but `adaptive_media_gate` and `ai_studio_perf_gate` failed with `Resource not accessible by integration`.
- `22250627010` (success): permission fix applied (`pull-requests: read`), both path-filter detection steps pass, and all jobs completed green.
- `22250698460` (success): follow-up verification cycle remained green across all CI jobs.
- `22250715981` (success): additional follow-up cycle remained green across all CI jobs.

### Mode promotion (2026-02-21)
- Repository Actions variables promoted to enforce mode for docs/parity checks:
  - `DOCS_SEMANTIC_DRIFT_MODE=enforce`
  - `MIGRATION_PARITY_MODE=enforce`
- Command used:
  - `gh variable set DOCS_SEMANTIC_DRIFT_MODE --body enforce`
  - `gh variable set MIGRATION_PARITY_MODE --body enforce`

### Environment-gated SQL workflows (supporting signal)
- `conversation-state-hardening-gate.yml` recent runs are successful (`warn` + `enforce`) and documented under STG-02 evidence.
- `apply-conversation-state-migration-028.yml` recent production runs show successful `028/029/030` applies with earlier failed attempts before secret setup.

## Result
- STG-06 two-green-cycle criterion is **met** as of 2026-02-21 (`22250627010`, `22250698460`).
- STG-06 remains `In Progress`.

## Next action required
- Confirm sustained stability on subsequent cycles (newer than `22250715981`).
- Continue phased promotion decisions for remaining warn/evaluate checks.
- Keep enforce promotion blocked until this condition and branch-protection UI evidence are both complete.
