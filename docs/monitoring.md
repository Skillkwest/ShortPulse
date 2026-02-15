# Monitoring And Incident Response

Purpose: define how runtime incidents are captured, triaged, and resolved.

## Signals in place
- Client runtime, API/network, and generation workflow failures are captured and sent to `/api/log/client-error`.
- Client route-transition failures (`client.route_change`, excluding cancelled navigations) are captured for incident triage.
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

## Alert thresholds
- `/api/admin/error-events` computes 15-minute spike indicators and breach flags for:
  - total event volume,
  - high-severity event volume,
  - generation-scope event volume.
- If `app_error_events` is missing (schema drift), `/api/admin/error-events` now returns a degraded payload (`health.degraded = true`) instead of failing hard. The Admin Event Stream shows a drift warning so operators can apply migration `015` and restore per-occurrence visibility.
- Alert metrics are computed against real failure traffic only (synthetic admin test events and `telemetry.*` sources excluded) and are not altered by UI filter state.
- Threshold env vars (server-side): `SHORTPULSE_ADMIN_ALERT_TOTAL_15M`, `SHORTPULSE_ADMIN_ALERT_HIGH_15M`, `SHORTPULSE_ADMIN_ALERT_GENERATION_15M`.
- Defaults if unset: `40`, `8`, `20`.

Provider-specific runbook: `docs/sops/sop_provider_incident_response.md`.

## Character Manager compatibility drift monitor
- During the Character Sheet migration window, run `sql/check_character_sheet_alias_drift.sql` after each deploy that touches Character Manager persistence or schema.
- Expected result: every `mismatch_count` is `0`.
- If any non-zero count appears, treat as `medium` severity because cross-surface assignment behavior may diverge.
- Escalate using the troubleshooting runbook section `Character Manager alias drift (Character Sheet vs legacy Reference Pack fields)`.

## Media storage scope drift monitor
- After any deploy that changes media upload/sign/move behavior or storage-path constraints, run `sql/check_media_storage_scope_drift.sql`.
- Expected result: every `mismatch_count` is `0`.
- If any non-zero count appears, treat as `high` severity because cross-user object reference risk can reappear.
- Keep `sql/migrations/016_harden_media_storage_path_scope.sql` and `sql/migrations/017_harden_media_storage_path_shape.sql` applied in every environment before declaring this monitor healthy.
- Use `docs/sops/sop_sql_migration_operations.md` for the canonical remediation loop.
- Escalate using troubleshooting runbook section `Media storage path scope drift`.

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

## Protected-Route Staging Latency Capture (2026-02-14)
- Goal: collect one real staging p50/p95 sample on a protected API route before external tester rollout.
- Preferred route: `/api/billing/credit-packages` (auth-protected read path, no mutation side effects).
- Script: `scripts/capture_protected_route_latency.mjs`.
- Shortcut command: `cd frontend && npm run latency:protected-route -- --path /api/billing/credit-packages --samples 30 --warmup 5`.
- Required inputs:
  - Base URL: `SHORTPULSE_STAGING_BASE_URL` (or `APP_BASE_URL`) (for example, `https://staging.shortpulse.app`)
  - Auth token, one of:
    - `SHORTPULSE_STAGING_BEARER_TOKEN` (real authenticated non-admin token), or
    - `--bootstrap-token-from-supabase` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to create/sign-in/delete a short-lived test user automatically.
- Example command:
  - `SHORTPULSE_STAGING_BASE_URL=https://staging.example.com SHORTPULSE_STAGING_BEARER_TOKEN=*** node scripts/capture_protected_route_latency.mjs --path /api/billing/credit-packages --samples 30 --warmup 5`
- Example with auto token bootstrap:
  - `SHORTPULSE_STAGING_BASE_URL=https://staging.example.com node scripts/capture_protected_route_latency.mjs --path /api/billing/credit-packages --samples 30 --warmup 5 --bootstrap-token-from-supabase`
- Same via npm shortcut:
  - `cd frontend && SHORTPULSE_STAGING_BASE_URL=https://staging.example.com npm run latency:protected-route -- --path /api/billing/credit-packages --samples 30 --warmup 5 --bootstrap-token-from-supabase`
- Optional multi-route sample:
  - `node scripts/capture_protected_route_latency.mjs --path /api/billing/credit-packages --path /api/media/resolve-previews --samples 25 --bootstrap-token-from-supabase`
- Output format:
  - `[auth-staging-latency] route=<path> p50=<ms> p95=<ms> min=<ms> max=<ms> success_rate=<pct>% statuses=<code:count,...>`
- Recording requirement:
  - Copy one successful sample into `docs/planning/mvp-pretester-full-audit-remediation-plan.md` and `docs/change_log.md` with capture date/time and route list.

Latest captured sample (credentialed runtime probe on 2026-02-14):
- Environment: local running app (`http://127.0.0.1:3000`) with real Supabase-authenticated bearer token from a short-lived test user.
- Route: `/api/billing/credit-packages` (`30` measured samples, `5` warmup).
- Result: `p50=222.99ms`, `p95=291.78ms`, `min=204.88ms`, `max=294.34ms`, `success_rate=100.0%`, `statuses=200:30`.
- Bootstrap-mode validation run (same date): `--bootstrap-token-from-supabase` (`8` measured samples, `2` warmup) returned `p50=246.50ms`, `p95=274.55ms`, `success_rate=100.0%`, `statuses=200:8`, with confirmed cleanup log `supabase_bootstrap_user_deleted=true`.
- Npm-shortcut validation run (same date): `cd frontend && npm run latency:protected-route -- --base-url http://127.0.0.1:3000 --path /api/billing/credit-packages --samples 5 --warmup 1 --bootstrap-token-from-supabase` returned `p50=228.38ms`, `p95=248.98ms`, `success_rate=100.0%`, `statuses=200:5`, with confirmed cleanup log `supabase_bootstrap_user_deleted=true`.
- Note: staging-host capture remains pending because no resolvable staging app base URL is currently configured in this workspace.
