# Unified Phase 04: Video Runtime Hardening Residuals

Status: In Progress  
Owner: Engineering

## Objective
Harden Fal video runtime outbound trust boundaries so provider auth headers are sent only to trusted origins and untrusted probe/submit targets are fail-closed.

## In Scope
1. Add centralized trusted Fal provider URL policy for outbound submit/probe paths.
2. Enforce trusted-host checks on submit targets before outbound auth-bearing requests.
3. Enforce trusted-host checks on status/result/response probe paths.
4. Enforce trusted queue-base validation in Fal status route orchestration.
5. Add queue-status read-only rollout control with explicit rollback flag.
6. Add targeted trust-policy and queue-status mode tests with phase evidence updates.

## Out of Scope
1. Provider migration (Kie) trust policy.
2. Broad networking/infrastructure changes.

## Implementation Slices
1. Slice A: `providerTrustPolicy` module + integration in submit/probe runtime paths.
2. Slice B: targeted tests for trusted/untrusted URL behavior.
3. Slice C: docs/evidence/tracker updates and phase gate validation.
4. Slice D: `/api/fal/queue-status` read-only rollout flag + tests + docs/runbook updates.

## Validation Gates
1. `npm -C frontend run test -- statusProxyRuntime submitEngine providerTrustPolicy recoveryProviderProbe fal-status-proxy fal-status.auth-context fal-status.ownership`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run docs:check`
5. `npm -C frontend run build`

## Required Docs Updates
1. `docs/planning/shortpulse-unified-buildout-tracker.md`
2. `docs/planning/evidence/unified-buildout/phase-04/*`
3. `docs/sops/sop_provider_incident_response.md` (trust-policy diagnostics)
4. `docs/api/api-internal-routes.md` and `frontend/.env.example` (queue-status rollout control)
5. `docs/change_log.md`

## Exit Criteria
1. Outbound Fal auth-bearing requests reject untrusted targets.
2. Status/recovery response probing skips or blocks untrusted URLs by policy.
3. Fal status route fails closed when queue-base config is untrusted.
4. Queue-status route supports read-only mode (`SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=false`) without changing response contract.
5. Validation gates are green and phase evidence is committed.

## Rollback Plan
1. Revert the Phase 04 trust-policy slice commit.
2. Restore previous submit/probe behavior while retaining Phase 03 baseline.

## Canary Execution Checklist
1. Staging canary:
   - set `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=false`,
   - keep `SHORTPULSE_FAL_QUEUE_ENABLED=true` and reconciler enabled,
   - run latency probe for `/api/fal/queue-status` and `/api/media/resolve-previews` before and after rollout.
   - optional baseline helper:
     - `node scripts/capture_phase04_canary_baseline.mjs --base-url "$SHORTPULSE_STAGING_BASE_URL" --bootstrap-token-from-supabase --reconciler-secret "$SHORTPULSE_FAL_RECONCILER_CRON_SECRET"`
2. Validate runtime behavior:
   - no increase in queue stuck depth or recovery backlog p95 age beyond phase thresholds,
   - no sustained increase in `api.fal_status.*` error rates,
   - no regression in queued generation completion success.
3. Rollback trigger:
   - two consecutive failing windows on threshold metrics or clear queue-stall symptoms.
4. If rollback is needed:
   - set `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=true` immediately,
   - capture incident note under phase-04 evidence and `docs/change_log.md`.

## Canary Signoff Artifact
1. Use `docs/planning/evidence/unified-buildout/phase-04/2026-02-27-fal-queue-status-read-only-canary-execution-log-template.md` to record:
   - baseline values,
   - two observation windows,
   - threshold evaluation,
   - explicit promote/hold/rollback decision.
