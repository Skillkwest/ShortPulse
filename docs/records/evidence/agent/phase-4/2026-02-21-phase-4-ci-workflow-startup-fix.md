# Phase 4 Evidence: CI Workflow Startup Fix (Perf Gate Secret Conditionals)

Date: 2026-02-21  
Program: AI Studio Agent Hardening + Modularization  
Phase: 4 (Guardrails + Governance)

## Scope
Resolve `ci.yml` startup failure mode where runs completed with zero jobs due workflow-file validation issues.

## Findings
1. Latest run on commit `94d7a936` failed immediately with no jobs:
   - `gh run view 22250505283` reported workflow-file issue.
   - `gh api repos/sleepyseamonster/ShortPulse/actions/runs/22250505283/jobs` returned `total_count: 0`.
2. `ci.yml` used `secrets.*` in job-level `if:` conditionals for perf-gate jobs, which can break workflow evaluation before job graph creation.

## Changes Captured
1. Updated `.github/workflows/ci.yml`:
   - Removed job-level secret conditionals for `ai_studio_perf_gate` and removed companion notice job.
   - Added env-backed secret presence checks in `should_run` step.
   - Added explicit skip-reason output and in-job summary messages.
2. Updated docs to reflect single-job perf-gate skip behavior:
   - `docs/planning/ci-policy-checks.md`
   - `docs/records/evidence/docs/2026-02-20-branch-protection-required-check-mapping.md`
   - `docs/planning/master-rollout-proposal.md`
   - `docs/sops/sop_media_performance_operations.md`
   - `docs/adr/0016-ai-studio-reference-grid-adaptive-delivery-and-watchdog.md`

## Verification Commands
```bash
gh run view 22250505283
gh api repos/sleepyseamonster/ShortPulse/actions/runs/22250505283/jobs
npm -C frontend run docs:check
```

## Result
1. Workflow startup failure cause isolated and remediated in workflow logic.
2. Documentation parity checks passed after updates.
3. Next CI cycle is required to confirm jobs are created and execution proceeds normally.
