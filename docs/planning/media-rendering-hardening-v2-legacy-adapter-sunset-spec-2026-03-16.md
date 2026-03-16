# Media Rendering Hardening v2 Legacy Adapter Sunset Spec (2026-03-16)

Last updated: 2026-03-16  
Status: Active

## Scope
Temporary compatibility adapters:
1. `/api/upload-image`
2. `/api/upload-video`

Canonical target:
1. `/api/media/upload`

## Adapter Contract
1. Adapters must preserve compatibility response shape during sunset window.
2. Adapters must emit telemetry that supports usage and parity tracking.
3. Adapters must not diverge from canonical validation rules beyond temporary compatibility needs.

## Sunset Gates
All gates must pass before decommission:
1. Two clean release windows with zero P0/P1 regressions in media ingest/read paths.
2. Adapter parity tests pass in staging and limited rollout ring.
3. No unresolved high-severity incidents tied to canonical upload.
4. Adapter usage below agreed threshold for sustained observation window.
5. Rollback route re-enable procedure validated.

## Decommission Checklist
1. Remove adapter route implementations.
2. Remove adapter consumers and direct callers.
3. Remove adapter docs and route inventory rows.
4. Update protected API path registry and SOP references.
5. Publish final adapter retirement evidence packet.

## Rollback Triggers
1. Any ingestion outage linked to canonical path migration.
2. Any confirmed consumer incompatibility after adapter retirement.
3. Elevated error-rate or failed upload parity in rollout ring.
