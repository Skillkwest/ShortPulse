# Phase 4 Evidence: CI Workflow Permissions Fix (Paths Filter)

Date: 2026-02-21  
Program: AI Studio Agent Hardening + Modularization  
Phase: 4 (Guardrails + Governance)

## Scope
Fix CI failures in `adaptive_media_gate` and `ai_studio_perf_gate` caused by GitHub token permission limits during `pull_request` path-filter evaluation.

## Findings
1. Run `22250581279` created and executed jobs (startup fix validated), but two jobs failed at change-detection steps.
2. Failure annotation on both jobs:
   - `Resource not accessible by integration`
3. Failing steps:
   - `Detect Adaptive Media V2-impacting changes`
   - `Detect AI Studio perf-impacting changes`

## Change Captured
1. Added explicit workflow permissions in `.github/workflows/ci.yml`:
   - `contents: read`
   - `pull-requests: read`

## Verification Commands
```bash
gh run view 22250581279
npm -C frontend run docs:check
```

## Result
Permission failure cause isolated. Next CI run on the branch is required to confirm both path-filter steps execute without integration-permission errors.
