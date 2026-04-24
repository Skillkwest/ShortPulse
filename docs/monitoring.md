# Monitoring And Incident Response

Purpose: define how runtime incidents are captured, triaged, and resolved.

## Signals in place
- Client runtime, API/network, and generation workflow failures are captured and sent to `/api/log/client-error`.
- Client route-transition failures (`client.route_change`, excluding cancelled navigations) are captured for incident triage.
- API/server-side incidents can be written through `frontend/lib/server/api/appErrorLogs.ts`.
- Operator review surface: `/admin` incident panels backed by `app_error_logs` (grouped) plus raw event stream from `app_error_events` (per occurrence) via `/api/admin/error-events`.
- Fal transient status fallback telemetry is emitted as `telemetry.fal.status.transient.*` when status transient mode is enabled.
- AI Studio generate-click telemetry is emitted as `telemetry.ai_studio.generate_clicked` whenever a signed-in user explicitly starts a generate/regenerate action in AI Studio.
- Legacy media upload adapter usage is emitted as:
  - `telemetry.media.upload_adapter.upload_image_used`
  - `telemetry.media.upload_adapter.upload_video_used`

## Telemetry pipeline topology
1. Ingestion entrypoints:
   - Browser/runtime: `POST /api/log/client-error`
   - Server/API handlers: `logApiRouteException` / `logGenerationFailure` in `frontend/lib/server/api/appErrorLogs.ts`
2. Normalization + storage:
   - Shared sanitizer/fingerprint flow in `writeAppErrorLog`
   - Per-occurrence events stored in `app_error_events` (append-only)
   - Deduplicated incidents stored in `app_error_logs` (open incident merge by fingerprint)
3. Telemetry-only source policy:
   - Sources under `telemetry.*` stay in `app_error_events` only (no grouped incident row)
   - Shared policy contract lives in `frontend/lib/server/api/errorTelemetryPolicy.ts`
4. Operator retrieval:
   - `/api/admin/error-events` = raw stream + enrichment + alert summaries
   - `/api/admin/errors` = grouped incidents for triage lifecycle
   - `/api/admin/stats/global` = admin stats workspace payload for overview/models/workflows/assets/projects

## AI Studio usage analytics
- Primary generate-click source: `telemetry.ai_studio.generate_clicked`
- Primary accepted-run source: `ai_generations`
- Primary workflow-context source: `generation_projection` (style/character/reference lineage)
- Primary asset-behavior source: `media_events`
- Primary project-attachment sources: `project_generation_items`, `project_media_items`, `project_prompt_items`
- Operator read surface:
  - `/admin/stats`
  - `/api/admin/stats/global`
- Current v1 usage contract:
  - `overview` covers explicit generate clicks, accepted runs, success/fail mix, saved generations, and project-attached generations.
  - `models` merges generate-click telemetry, accepted generation rows, and saved-generation counts on `model_id`.
  - `workflows` uses generate-click telemetry for tool/mode intent and `generation_projection` for style-applied, character-mode, and reference-assisted generation context.
  - `assets` uses `media_events` for save/upload/rename/move/delete/prompt-save behavior and `ai_generations.metadata.autosave_decision` for autosave rollups.
  - `projects` uses `projects`, `project_generation_items`, `project_media_items`, and `project_prompt_items` for serious-work attachment metrics.
- `telemetry.ai_studio.generate_clicked` metadata contract now includes:
  - `selected_tool`
  - `mode`
  - `project_id_present`
  - `is_character_mode`
  - `selected_character_id`
  - `has_style`
  - `style_id`
  - `reference_count`

## AI Studio Pulse runtime monitoring
- Pulse does not emit a separate `telemetry.pulse.*` event family. Pulse runtime quality is monitored through the existing studio-agent route telemetry plus authoritative `pulseWorkflowSession` state.
- Route-level studio-agent telemetry is emitted by `frontend/features/agent-runtime/studioAgentRouteOutcomes.ts` as `[studio-agent][telemetry]` and is the primary signal for Pulse request outcomes.
- Treat these telemetry fields as the Pulse runtime outcome contract:
  - routing: `flow`, `path`, `model`
  - outcome: `status`, `decision`, `outcome_class`, `reason_code`, `retryable`
  - resilience: `retry_used`, `retry_count`, `repair_used`, `repair_count`, `fallback_reason`
  - latency: `latency_ms_total`, `latency_ms_stage`
  - safety: `safety_outcome`, `safety_source`, `safety_fallback`, `policy_version`, `policy_schema_version`, `prompt_template_version`, `runtime_scope_key`, `profile_id`, `modality`, `category`, `decision_action`, `decision_source`, `provider_blocked`, `hard_floor_violation`, `rollback_triggered`
- Pulse-specific interpretation:
  - `outcome_class=success_message` is the expected success class for guided `workflow_gpt` turns that ask the next question or return a final chat artifact.
  - `outcome_class=success_prompt` should be treated as a backward-compatibility artifact path, not the normal Pulse runtime contract.
  - `outcome_class=fallback_infra`, `upstream_error`, `route_error`, `refusal_model`, and `refusal_safety` are the primary failure/fallback classes to monitor for Pulse regressions.
- Activation, progression, and completion are tracked through authoritative `pulseWorkflowSession` state, not inferred from UI-only transcript parsing. The session object persists:
  - `presetId`
  - `status`
  - `currentStepIndex`
  - `currentStepLabel`
  - `currentStepPrompt`
  - `collectedInputs`
  - `lastArtifact`
  - `finalArtifactSource`
- Operationally, use Pulse runtime telemetry and workflow-session state together:
  - route telemetry tells you whether a Pulse turn succeeded, fell back, refused, or failed,
  - workflow session state tells you whether a workflow Pulse is active, awaiting input, still running, or completed with a reusable artifact.

## AI Studio Pulse eval posture
- Pulse closeout eval coverage is regression-based and lives in the runtime and persistence suites:
  - `frontend/tests/api/studio-agent.runtime.test.ts`
  - `frontend/features/agent-runtime/__tests__/studioAgentCoordinator.test.ts`
  - `frontend/features/agent-runtime/__tests__/studioAgentTurnResponse.test.ts`
  - `frontend/features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts`
  - `frontend/features/ai-studio/logic/__tests__/pulseWorkflowSession.test.ts`
  - `frontend/features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx`
- Those suites cover the Pulse-specific closeout expectations:
  - activation reaches a Pulse-aware runtime,
  - direct-bypass and orchestrated paths are both Pulse-aware,
  - `workflow_gpt` turns can succeed as `success_message`,
  - completed workflow sessions persist and hydrate with `lastArtifact` and `finalArtifactSource`,
  - Create surfaces render authoritative workflow session state rather than local transcript heuristics.
- Manual closeout expectation:
  - verify that a built-in `workflow_gpt` Pulse can activate, step forward, persist, restore, complete, and reuse its final artifact without falling back to prompt-append semantics.

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

### Fal drain cycle monitoring
- Use `scripts/run_generation_drain_cycle.mjs` to run controlled all-user drain loops via `/api/internal/generation-recovery/run`.
- Use `npx tsx scripts/replay_generation_convergence_backlog.ts --dry-run` to inspect `outputs_without_publications` backlog rows that are already `status='success'` and therefore outside normal reconciler claiming.
- Use `docs/sops/sop_generation_recovery_diagnostics.md` as the canonical drain/remediation sequence.
- Use `sql/check_generation_queue_dispatch_latency.sql` to measure queue-to-dispatch latency from `telemetry.queue.dispatch.submitted` events in `app_error_events`.
- Use `sql/check_generation_recovery_media_visible_latency.sql` to measure provider-terminal-to-media-visible latency from `telemetry.generation.recovery.media_visible` events in `app_error_events`.
- Background control-plane ownership is now explicitly split into:
  - stage orchestration: `frontend/lib/server/generationControlPlane/runCycle.ts`
  - recovery batch acquisition: `frontend/lib/server/generationControlPlane/recoveryBatchAcquisition.ts`
  - recovery batch execution: `frontend/lib/server/generationControlPlane/recoveryBatchExecution.ts`
- Treat these response fields as hard health signals during drain:
  - recovery: `claimed`, `processed`, `recovered`, `requeued`, `exhausted`, `errors`
  - cleanup: `reservationCleanupScanned`, `reservationCleanupReleased`, `reservationCleanupErrors`
  - stage timings: `stageTimings.queueDispatch.durationMs`, `stageTimings.reservationCleanup.durationMs`, `stageTimings.providerAttachedReservationCleanup.durationMs`, `stageTimings.observationInboxProcessing.durationMs`, `stageTimings.requestIdRepair.durationMs`, `stageTimings.recoveryClaim.durationMs`, `stageTimings.recoveryExecution.durationMs`
- Convergence target:
  - no sustained active workload (`claimed`, `requeued` no longer persistently elevated),
  - `errors = 0` across the configured convergence window.
- Queue-latency validation target:
  - `telemetry.queue.dispatch.submitted` events are present during the validation run,
  - `p95_queue_latency_ms` trends materially below the prior symptom window,
  - worst-case rows are explainable by real provider/admission pressure rather than idle queue starvation.
- Recovery-visibility validation target:
  - `telemetry.generation.recovery.media_visible` events are present during the validation run,
  - `p95_provider_terminal_to_media_visible_ms` trends materially below the prior symptom window,
  - worst-case rows identify whether lag clusters around a specific model, provider, or recovery actor.

### Admin fleet health monitoring
- Fleet scan trigger route: `/api/internal/admin-user-health-fleet/run`.
- Cadence state:
  - current runtime baseline: hourly,
  - rollback baseline: daily (`0 4 * * *`) if hourly health degrades.
- Primary fleet read surface: `/api/admin/user-health-fleet` and `/admin/user-health-fleet`.
- Treat these response/run fields as health signals:
  - execution: `status`, `targeted`, `processed`, `failed`, `partial`, `durationMs`
  - exposure: summary totals (`criticalCount`, `highRiskCount`, `totalCostWithoutSuccessCents`, `totalStuckGenerations`, `totalExhaustedQueueRows`)
  - degradation: `health.degraded` and `health.reason` in the read API.
- Report-only escalation source:
  - `ops.user_health_fleet` events in `app_error_events`/`app_error_logs` (no auto-remediation or auto-refund mutations).
- Baseline expectations:
  - current baseline: at least one completed run per hour,
  - no sustained run-lock condition (`status='running'` without progress),
  - partial runs and degraded reads should include actionable reason text and operator follow-up.

### Single-account health snapshot
- Use `npx tsx scripts/account_health_snapshot.ts --lookup <email-or-user-id>` for a read-only one-account snapshot.
- Add `--json` when you want a machine-readable capture for diffing or handoff.
- Add `--strict` after cleanup or reconciliation to fail closed on critical findings or compatibility warnings.
- Treat `compatibility.warnings` as a schema/contract signal, not as normal account-health noise.
- Use `/api/admin/user-health` and `/admin/generation-trace` alongside the snapshot when you need deeper operator context.

### Control-Plane Diagnostics Bundle
- Scheduler/cron diagnostics: `sql/check_control_plane_scheduler_health.sql`.
- `pg_net` diagnostics taxonomy: `sql/check_pg_net_failure_taxonomy.sql`.
- Use these scripts as the canonical R1 control-plane checks before and during incident escalation.
- Fal webhook ingress is now explicitly thin-route + ingress-service:
  - route verification/parsing: `frontend/pages/api/fal/webhook.ts`
  - durable inbox / duplicate / ignore / recovery handoff: `frontend/lib/server/falIntegration/falWebhookIngress.ts`

## Admin triage controls
- `app_error_events` is append-only telemetry. Do not delete rows during troubleshooting; preserve forensic history.
- Use incident status transitions (`open` -> `resolved`/`ignored`, with `reopen` when needed) to represent triage state.
- Admin UI supports single-item and listed-page bulk status transitions for incidents (resolve/ignore) via `/api/admin/errors-status` and `/api/admin/errors-status-bulk`.
- Use `Copy triage` in the Incidents/Event Stream tables for handoff packets. These payloads are versioned and intentionally compact (key identifiers + normalized triage metadata) to keep troubleshooting reproducible without pasting full raw metadata blobs.
- Event Stream display controls are operator-local:
  - Incident-state display filter (`Actionable`, `Open`, `Resolved`, `Ignored`, `Unlinked`) trims visible rows for active work.
  - `Hide` removes a row from the current session view only; `Show hidden` restores hidden rows.

### Triage packet contract
- Incident packets use `shortpulseIncidentVersion` (current: `3`) plus `packetType: "triage"` and an `incident` object.
- Event packets use `shortpulseEventVersion` (current: `2`) plus `packetType: "triage"` and an `event` object.
- Compatibility rule for tooling/scripts:
  - branch on packet version,
  - ignore unknown fields,
  - treat missing optional fields as `null`/absent (not parse failures).
- Payloads are intentionally compact:
  - full raw `metadata` is not copied into triage packets,
  - very large text fields (for example stacks or breadcrumb data) can be truncated.
- When deep forensics requires unsummarized metadata, copy it from Event Detail in `/admin` as a second step.

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
- If non-core summary or enrichment queries fail (for example, transient count-query failures), `/api/admin/error-events` and `/api/admin/errors` now fail soft with `health.degraded = true` and keep the primary list payload available.
- Alert metrics are computed against real failure traffic only (synthetic admin test events and `telemetry.*` sources excluded) and are not altered by UI filter state.
- Threshold env vars (server-side): `SHORTPULSE_ADMIN_ALERT_TOTAL_15M`, `SHORTPULSE_ADMIN_ALERT_HIGH_15M`, `SHORTPULSE_ADMIN_ALERT_GENERATION_15M`, `SHORTPULSE_ADMIN_ALERT_PROVIDER_RUNNING_TIMEOUT_15M`.
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
- For media-rendering `P9` closeout, review adapter usage counts in `/api/admin/error-events` or the Admin Event Stream using:
  - `source=telemetry.media.upload_adapter.upload_image_used`
  - `source=telemetry.media.upload_adapter.upload_video_used`

## Canary window for cleanup PRs
- Deploy dead-code/refactor PRs separately from feature launches.
- During the first post-deploy window, monitor:
  - `/api/admin/error-events` for event spikes,
  - `/api/admin/errors` for new/open incidents,
  - route/API status changes (404/500) on recently touched surfaces.
- If a regression appears, revert the cleanup PR first, then re-open analysis with a narrowed delete set.

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
