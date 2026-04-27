# Phase 5 Evidence: Vercel Preview Throttle Control

Date: 2026-02-21  
Program: AI Studio Agent Hardening + Modularization  
Phase: 5 (Progressive Rollout support control)

## Scope
Reduce preview deployment churn during rollout evidence/documentation updates so operational checks are not blocked by avoidable Vercel rate limits.

## Change
1. Added Vercel ignore command config:
   - `frontend/vercel.json`
2. Added skip script:
   - `frontend/scripts/vercel-ignore-build.sh`
3. Documented control and verification:
   - `docs/deployment.md`

## Behavior
1. Production deployments are never skipped.
2. Preview deployments are skipped when no files changed under `frontend/`.
3. Fail-open behavior is used when git metadata is unavailable (build proceeds to avoid accidental false skips).

## Rollout Alignment
1. Supports Phase 5 by reducing deployment-noise pressure while staging soak evidence is collected.
2. Does not alter runtime agent behavior or API contracts.
