# Monitoring And Incident Response

Purpose: define how runtime incidents are captured, triaged, and resolved.

## Signals in place
- Client runtime, API/network, and generation workflow failures are captured and sent to `/api/log/client-error`.
- API/server-side incidents can be written through `frontend/lib/server/api/appErrorLogs.ts`.
- Operator review surface: `/admin` incident panels backed by `app_error_logs` (grouped) plus raw event stream from `app_error_events` (per occurrence) via `/api/admin/error-events`.

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

## Smoke-test trigger
- Operators can create a synthetic incident via `/api/admin/errors-test` (Admin auth required).
- Admin UI shortcut: Errors tab buttons `Trigger app test` / `Trigger generation test`.
- Synthetic incidents are tagged in metadata (`synthetic: true`) and should be resolved/ignored after verification.

Provider-specific runbook: `docs/sops/sop_provider_incident_response.md`.

## Character Manager compatibility drift monitor
- During the Character Sheet migration window, run `sql/check_character_sheet_alias_drift.sql` after each deploy that touches Character Manager persistence or schema.
- Expected result: every `mismatch_count` is `0`.
- If any non-zero count appears, treat as `medium` severity because cross-surface assignment behavior may diverge.
- Escalate using the troubleshooting runbook section `Character Manager alias drift (Character Sheet vs legacy Reference Pack fields)`.

## Release checklist tie-in
- Before release, verify incident ingestion is functioning.
- After release, spot-check new incidents and confirm no high-severity regressions.

## Auth Boundary Latency Benchmark (2026-02-14)
- Scope: synthetic benchmark of `requireApiUser` on protected API paths comparing middleware-authenticated context reuse vs token-only fallback verification.
- Method: `frontend/tests/api/auth-latency-benchmark.test.ts` runs `40` samples per path with a controlled `12ms` mocked Supabase `/auth/v1/user` delay for fallback.
- Result snapshot (recent sampled range across repeated runs):
  - Middleware context path: `p50=0.07–0.08ms`, `p95=0.25–0.72ms`
  - Fallback verification path: `p50=13.16–13.28ms`, `p95=13.30–14.61ms`
- Command: `cd frontend && npm run test -- auth-latency-benchmark`
