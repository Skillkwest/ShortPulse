# Branch Protection Required-Check Mapping (2026-02-20, refreshed 2026-02-21)

Date: 2026-02-20  
Operator: @sleepyseamonster  
Context: STG-06 manual evidence requirement

## Why manual evidence

Repository rules/protection API access is restricted in this repo context (`403`), so required-check mapping evidence is captured from GitHub UI.

API verification attempt (recorded):
- Command: `gh api repos/sleepyseamonster/ShortPulse/branches/main/protection -H 'Accept: application/vnd.github+json'`
- Result: `403` with message: `Upgrade to GitHub Pro or make this repository public to enable this feature.`
- Date: 2026-02-21

UI verification attempt (recorded):
- Source: repository Settings -> Rules -> Rulesets -> New branch ruleset
- Result:
  - `Your rulesets won't be enforced on this private repository until you move to GitHub Team organization account.`
  - Enforcement status shown as `Disabled`.
  - Branch targeting not configured (`Branch targeting has not been configured`).
- Evidence timestamp (from capture): 2026-02-20 17:12 local
- Date recorded: 2026-02-21

UI verification attempt (updated capture):
- Source: repository Settings -> Rules -> Rulesets -> `Production`
- Result:
  - Ruleset created (`Ruleset created` toast shown).
  - Ruleset status set to `Active`.
  - Target branch criteria set to `Default` and applies to `main`.
  - Required status checks configured: `frontend`, `security`, `deadcode`.
  - Additional rules enabled: PR required, 1 approval, dismiss stale approvals, require conversation resolution, require branches up to date, block force pushes, restrict deletions, require linear history.
  - Banner still present: `Your rulesets won't be enforced on this private repository until you move to GitHub Team organization account.`
- Evidence timestamp (from capture): 2026-02-20 17:21 local
- Date recorded: 2026-02-21

## Refresh snapshot (2026-02-21)

Workflow job-name/source-of-truth check (from `.github/workflows/ci.yml`):
- `deadcode`
- `frontend`
- `docs_semantic_drift`
- `migration_parity`
- `archive_manifest_check`
- `sql_lint`
- `architecture_boundary`
- `size_budget`
- `agent_contract_tests`
- `agent_disable_continuity`
- `adaptive_media_gate`
- `ai_studio_perf_gate`
- `security`

CI cycle verification command (recorded):
- Command: `gh run list --workflow ci.yml --limit 10 --json databaseId,headBranch,conclusion,createdAt,updatedAt,event`
- Result: recent runs remain failures; no two consecutive green cycles observed.
- Date: 2026-02-21

## Required check names (documented target)

- `frontend`
- `security`
- `deadcode`

Planned required checks after warn/evaluate stabilization:
- `docs_semantic_drift`
- `migration_parity`
- `sql_lint`
- `archive_manifest_check`
- `architecture_boundary`
- `size_budget`
- `agent_contract_tests`
- `agent_disable_continuity`

## Manual capture checklist

- [x] Capture repository settings screenshot/export showing ruleset availability constraints.
- [x] Capture repository settings screenshot/export showing required checks.
- [x] Confirm exact check names match `docs/planning/ci-policy-checks.md`.
- [x] Record operator/date in this file.
- [ ] Record reviewer/date in this file after UI verification.

## Status

Configured and documented, but not enforceable on current repository plan; pending GitHub Team/org upgrade (or equivalent) for enforcement.
Prototype-mode waiver applies; this remains non-blocking for MVP feature iteration and blocking only for production-readiness completion.
Branch-protection mapping evidence was refreshed on 2026-02-21 and remains aligned with current workflow check names.
