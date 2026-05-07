# Seedream Shadow Staging Preflight Env Check

Date: 2026-05-06  
Owner: AI Studio Engineering  
Program: 1 (Runtime And Money)  
Status: active blocker note

## Purpose
Record the first staging-execution preflight check for the Seedream Runtime V2 shadow lane and make the current blocker explicit.

## What Was Checked
Repo-backed staging requirements were taken from:
- `docs/planning/ai-studio-runtime-v2-staging-execution-checklist.md`

Environment inventory source:
- linked Vercel project metadata from `.vercel/project.json`
- `vercel env ls preview`

## Linked Project
- project name: `shortpulse`
- project id: `prj_LyBCIYaHPY25CHGfrSiQBl0HCnBJ`

## Preview Env Names Confirmed Visible
Visible in `vercel env ls preview` during this preflight:
- `SHORTPULSE_FAL_RECONCILER_CRON_SECRET`
- `SHORTPULSE_FAL_RECONCILER_ENABLED`
- `SHORTPULSE_PUBLIC_API_BASE_URL`
- `APP_BASE_URL`

## Required Runtime V2 Seedream Shadow Env Set
The active staging checklist expects:
- `SHORTPULSE_FAL_INTEGRATION_MODE=shadow`
- `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST=fal-ai/bytedance/seedream/*`
- `SHORTPULSE_FAL_WEBHOOK_ENABLED=true`
- `SHORTPULSE_FAL_WEBHOOK_JWKS_URL=https://rest.alpha.fal.ai/.well-known/jwks.json`
- `SHORTPULSE_PUBLIC_API_BASE_URL=<staging-origin>`
- `SHORTPULSE_FAL_RECONCILER_ENABLED=true`
- `SHORTPULSE_FAL_RECONCILER_CRON_SECRET=<secret>`
- `SHORTPULSE_FAL_RECONCILER_BATCH_SIZE=25`
- `SHORTPULSE_FAL_RECONCILER_MAX_ATTEMPTS=5`
- `SHORTPULSE_FAL_RECONCILER_MIN_AGE_SECONDS=120`
- `SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS=120`

## Current Gap
The current preview env inventory check did not show these checklist-required names:
- `SHORTPULSE_FAL_INTEGRATION_MODE`
- `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST`
- `SHORTPULSE_FAL_WEBHOOK_ENABLED`
- `SHORTPULSE_FAL_WEBHOOK_JWKS_URL`
- `SHORTPULSE_FAL_RECONCILER_BATCH_SIZE`
- `SHORTPULSE_FAL_RECONCILER_MAX_ATTEMPTS`
- `SHORTPULSE_FAL_RECONCILER_MIN_AGE_SECONDS`
- `SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS`

This does not prove the runtime is misconfigured in production behavior terms, but it does mean the Seedream shadow checklist cannot be considered fully preflighted from repo-side evidence yet.

## Interpretation
Current state is:
- repo readiness: green
- local Fal regression gate: green
- docs/runbook parity: green
- staging env inventory for Seedream Runtime V2 shadow: incomplete from the currently visible preview env list

## Decision
Decision: `HOLD_BEFORE_LIVE_SHADOW_RUN`

Reason:
The next step is no longer repo cleanup. The blocker is operational confirmation of the missing Runtime V2 preview env set before running the live Seedream shadow window.

Branch-local constraint:
- live staging execution is also intentionally deferred while work stays on the current branch only

## Required Next Step
Confirm or add the missing Preview / `staging-preview` env names for the Seedream Runtime V2 shadow checklist, then execute:
1. one staging Seedream webhook-first smoke run
2. one reconciler route smoke run
3. the Step 8 shadow SQL capture window

Operator handoff shortcut:
- `docs/planning/evidence/runtime-v2/2026-05-06-seedream-shadow-operator-handoff-checklist.md`
