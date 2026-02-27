# Phase 04 Canary Execution Attempt: Blocked (Vercel Deployment Protection)

Date: 2026-02-27  
Owner: Engineering  
Status: Blocked

## Objective
Run automated baseline capture for Phase 04 canary signoff on staging.

## Attempt Summary
Attempted command:

```bash
node scripts/capture_phase04_canary_baseline.mjs \
  --env-file /tmp/vercel_staging_env_20260226_074247.txt \
  --base-url "https://shortpulse-git-staging-preview-kirk-artmans-projects.vercel.app" \
  --bootstrap-token-from-supabase \
  --output docs/planning/evidence/unified-buildout/phase-04/2026-02-27-phase-04-canary-baseline-capture.md
```

Observed result:

```text
[phase04-canary-baseline] error=Probe GET /api/fal/queue-status?sourceRef=phase04-baseline-probe produced zero successful responses. statuses=401:25 (possible Vercel deployment protection block; provide --vercel-bypass-token)
```

## Root Cause
1. Staging deployment is behind Vercel Authentication (deployment protection).
2. Baseline probe requests are rejected before reaching app auth/runtime routes unless a valid bypass token is provided.

## Remediation Added
1. `scripts/capture_phase04_canary_baseline.mjs` now supports:
   - `--vercel-bypass-token <token>`
   - env fallback: `SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN` or `VERCEL_AUTOMATION_BYPASS_TOKEN`
2. Baseline helper now probes queue-status with required query shape:
   - `GET /api/fal/queue-status?sourceRef=phase04-baseline-probe`
3. Error diagnostics now include explicit Vercel-protection hint on all-401 probe results.

## Next Action
1. Obtain Vercel bypass token for the protected staging deployment.
2. Re-run baseline capture with:
   - `--vercel-bypass-token "$SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN"`
3. Continue canary windows and complete signoff template.
