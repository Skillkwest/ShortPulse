# Monitoring And Incident Response

Purpose: define how runtime incidents are captured, triaged, and resolved.

## Signals in place
- Client runtime and network failures are captured and sent to `/api/log/client-error`.
- API/server-side incidents can be written through `frontend/pages/api/_utils/appErrorLogs.ts`.
- Operator review surface: `/admin` incident panels backed by `app_error_logs`.

## Severity model
- `low`: recoverable UI issues with clear user fallback.
- `medium`: workflow failures that block a feature but have workaround paths.
- `high`: auth, billing, data-loss, or widespread generation failures.

## Operational workflow
1. Detect incident in `/admin`.
2. Classify severity and affected route/API.
3. Reproduce using request ID, route, and metadata.
4. Mitigate (rollback, hotfix, or config toggle).
5. Record outcome in `docs/change_log.md` and, if unresolved, `docs/known-issues.md`.

Provider-specific runbook: `docs/sops/sop_provider_incident_response.md`.

## Release checklist tie-in
- Before release, verify incident ingestion is functioning.
- After release, spot-check new incidents and confirm no high-severity regressions.
