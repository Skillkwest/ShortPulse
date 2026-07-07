# Monitoring And Incident Response

Purpose: define how runtime incidents are captured, triaged, and resolved.

## Signals in place

- Client runtime, API/network, and generation workflow failures are captured and sent to `/api/log/client-error`.
- Client route-transition failures (`client.route_change`, excluding cancelled navigations) are captured for incident triage.
- API/server-side incidents can be written through `frontend/lib/server/api/appErrorLogs.ts`.
- Operator review surface: `/admin/errors` shows a simple grouped-error handoff queue backed by `app_error_logs`; raw event-stream inspection remains available through `/api/admin/error-events`. Provider-sensitive/refusal messages and expected retry/rate-limit outcomes are retained for forensics but hidden from the default admin queue.
- Browser session-health evidence is captured through `/api/log/browser-session` into `browser_crash_sessions`; Chrome Reporting API crash reports are advertised through `Reporting-Endpoints` and accepted at `/api/browser-crash-report` only when they correlate to an existing browser session row. `/admin/crashes` reviews account-linked freezes, stale heartbeats, abandoned previous sessions, pressure/stall snapshots, and browser-delivered crash reports without mixing them into grouped app incidents. Crash rows preserve high-water pressure evidence across later heartbeat/lifecycle updates, and keep separate evidence status and operator review status so reviewed or ignored rows can leave the active queue while remaining searchable in History and All Evidence.
- Fal transient status fallback telemetry is emitted as `telemetry.fal.status.transient.*` when status transient mode is enabled.
- AI Studio low-severity client telemetry under `telemetry.ai_studio.*` is currently suppressed in the browser reporter before `/api/log/client-error` ingest so incident-budget headroom is reserved for real failures; this includes visible UI mirrors such as `ui_error_banner`, `notice_banner`, `failure_stack`, and media-library panel/modal error banners.
- AI Studio stability telemetry under `telemetry.ai_studio.stability.*` is emitted at medium severity for crash-adjacent browser pressure signals and therefore reaches `app_error_events` while staying telemetry-only on the server.
- Project workspace degraded-save telemetry is emitted as `telemetry.ai_studio.project_workspace.repair_pending` when the durable workspace write succeeds but follow-up project association repair still needs another pass.
- Growth funnel telemetry is emitted through `/api/telemetry/growth` for:
  - `telemetry.marketing.page_view`
  - `telemetry.marketing.cta_clicked`
  - `telemetry.auth.signup_submitted`
  - `telemetry.auth.signup_completed`
  - `telemetry.billing.pricing_viewed`
  - `telemetry.billing.upgrade_clicked`
  - `telemetry.billing.checkout_started`
  - `telemetry.billing.checkout_completed`
- Legacy media upload adapter usage is emitted as:
  - `telemetry.media.upload_adapter.upload_image_used`
  - `telemetry.media.upload_adapter.upload_video_used`

## Telemetry pipeline topology

1. Ingestion entrypoints:
   - Browser/runtime: `POST /api/log/client-error`
   - Browser session health: `POST /api/log/browser-session`
   - Browser-delivered crash reports: `POST /api/browser-crash-report`
   - Browser/public growth telemetry: `POST /api/telemetry/growth`
   - Server/API handlers: `logApiRouteException` / `logGenerationFailure` in `frontend/lib/server/api/appErrorLogs.ts`
2. Normalization + storage:
   - Shared sanitizer/fingerprint flow in `writeAppErrorLog`
   - Per-occurrence raw events stored in `app_error_events` during the raw retention window
   - Daily telemetry aggregates stored in `app_error_event_telemetry_daily_rollups`
   - Deduplicated incidents stored in `app_error_logs` (open incident merge by fingerprint)
   - Browser crash-session rows stored in `browser_crash_sessions` with service-role-only table access; the authenticated browser-session API accepts only allowlisted metadata and trusted server request headers for browser/host attribution. The public Reporting API crash endpoint is body-limited, rate-limited, and may update only an existing row identified by `CrashReportContext`; it does not create anonymous rows. Heartbeat/lifecycle updates merge into existing session metadata so crash-adjacent pressure fields such as `max_pressure_level`, `max_heap_used_to_total_ratio`, `pressure_event_count`, and `last_pressure_snapshot_at` survive calmer later events.
3. Telemetry-only source policy:
   - Sources under `telemetry.*` stay in `app_error_events` only (no grouped incident row)
   - Low-severity browser `telemetry.ai_studio.*` reports are currently dropped before ingest and therefore do not reach `app_error_events`.
   - Medium-severity `telemetry.ai_studio.stability.*` reports are intentionally ingestible for browser-crash forensics and still do not create grouped incidents.
   - Routine telemetry sources such as growth attribution and `telemetry.ai_studio.stability.*` remain inspectable in raw/source-filtered views, but are excluded from the default Actionable event queue.
   - The Admin Event Stream excludes all `telemetry.*` rows by default; use an explicit source or signal filter when telemetry inspection is intentional.
   - Actionable AI Studio failures, such as generation submit/status failures and media-library save failures, stay on non-telemetry sources so they can create operator incidents.
   - Shared policy contract lives in `frontend/lib/server/api/errorTelemetryPolicy.ts`
4. Operator retrieval:
   - `/api/admin/error-events` = raw stream + enrichment + alert summaries
   - `/api/admin/errors` = grouped incidents for the Codex handoff queue, excluding provider-sensitive safety-success rows and expected retry/rate-limit outcomes
   - `/api/admin/crashes` and `/admin/crashes` = browser session-health rows with derived stale-session status for likely freezes or ungraceful exits; the default Needs Review queue includes probable/confirmed crash rows, browser-delivered confirmed crashes, and open active rows whose heartbeat is stale; `/api/admin/crashes-status` updates open/resolved/ignored review state and optional review notes
   - `/api/admin/stats/global` = admin stats workspace payload for product + growth lenses

## AI Studio usage analytics

- Primary generate-click source: temporarily unavailable in `app_error_events` while low-severity browser `telemetry.ai_studio.*` ingest is suppressed to protect incident budget.
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
- Historical `telemetry.ai_studio.generate_clicked` metadata contract includes:
  - `selected_tool`
  - `mode`
  - `project_id_present`
  - `is_character_mode`
  - `selected_character_id`
  - `has_style`
  - `style_id`
  - `reference_count`

## Growth analytics

- Attribution identity storage: `growth_attribution_identities`
- Signup authority: `billing_profiles.created_at`
- Activation authority: derived from first `media_events.event_type='generation_saved'` or first `project_generation_items.created_at` within 7 days of signup
- Paid conversion authority: first Stripe-backed paid `billing_subscription_contracts` row (`contract_source='stripe'`)
- `/admin/stats` now has:
  - `Product` for usage/value analytics
  - `Marketing` for signups, activation, time-to-value, retention, and source/campaign attribution
  - `Sales` for pricing intent, checkout, paid conversion, and PQL/high-intent users
- `growth_attribution_identities` stores first-touch and last-touch source/campaign/landing data plus anonymous-to-user stitching state.
- Growth telemetry remains telemetry-only in `app_error_events`; it does not create grouped incidents in `app_error_logs`.
- Project workspace `repair_pending` telemetry also remains telemetry-only in `app_error_events`; operators should use the Admin Event Stream signal filter instead of looking for grouped incidents.

## AI Studio Pulse runtime monitoring

- Pulse runtime quality is monitored through Pulse-owned studio-agent route telemetry plus authoritative `pulseWorkflowSession` state. Standard and Pulse use separate route/runtime labels; do not aggregate custom Pulse state into Standard telemetry.
- Route-level studio-agent telemetry is emitted by `frontend/features/agent-runtime/studioAgentRouteOutcomes.ts` as `[studio-agent][telemetry]` and is the primary signal for Pulse request outcomes.
- Mode-owned route labels are part of the monitoring contract:
  - Standard Create: `/api/ai/studio-agent-standard`, `runtime_scope_key` rooted in `studio-agent-standard`.
  - Pulse Create: `/api/ai/studio-agent-pulse`, `runtime_scope_key` rooted in `route:studio-agent-pulse`.
- Treat these as high-signal boundary regressions:
  - Pulse telemetry or `workflowSession` fields appearing on Standard route responses,
  - Standard traffic carrying `context.pulse`,
  - Pulse traffic missing a Pulse session namespace,
  - Pulse traffic rejected because the namespace preset segment differs from `context.pulse.presetId`.
- Treat these telemetry fields as the Pulse runtime outcome contract:
  - routing: `flow`, `path`, `model`
  - outcome: `status`, `decision`, `outcome_class`, `reason_code`, `retryable`
  - resilience: `retry_used`, `retry_count`, `repair_used`, `repair_count`, `fallback_reason`
  - latency: `latency_ms_total`, `latency_ms_stage`
  - safety: `safety_outcome`, `safety_source`, `safety_fallback`, `policy_version`, `policy_schema_version`, `prompt_template_version`, `runtime_scope_key`, `profile_id`, `modality`, `category`, `decision_action`, `decision_source`, `provider_blocked`, `hard_floor_violation`, `rollback_triggered`
- Guided Pulse model/runtime knobs are separate from generic agent turns:
  - `STUDIO_AGENT_PULSE_MODEL` inherits `OPENAI_MODEL` when unset.
  - `STUDIO_AGENT_PULSE_TURN_TIMEOUT_MS` inherits `STUDIO_AGENT_TURN_TIMEOUT_MS` when unset.
- Pulse-specific interpretation:
  - `outcome_class=success_message` is the expected success class for custom Pulse turns and for guided `workflow_gpt` turns that ask the next question or return a final chat artifact.
  - `outcome_class=success_prompt` should be treated as a backward-compatibility artifact path, not the default custom Pulse runtime contract.
  - `outcome_class=upstream_error`, `route_error`, `refusal_model`, and `refusal_safety` are the primary failure classes to monitor for Pulse regressions.
- Standard-specific interpretation:
  - `outcome_class=success_prompt` is the expected success class for generation-ready Standard turns because the route emits a reusable prompt artifact for drag/reuse flows.
  - `outcome_class=refusal_safety` should remain the visible refusal contract for Standard provider-output refusals.
  - A sudden shift of Standard success traffic from `success_prompt` back to `success_message` is a high-signal regression for Create prompt reuse.
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
  - route telemetry tells you whether a Pulse turn succeeded, refused, or failed,
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
  - `workflow_gpt` built-in turns can succeed as `success_message`,
  - completed workflow sessions persist and hydrate with `lastArtifact` and `finalArtifactSource`
    in the session/runtime lanes that still carry conversational state,
  - Create surfaces render authoritative workflow session state rather than local transcript heuristics.
- Manual closeout expectation:
  - verify that a built-in `workflow_gpt` Pulse can activate, step forward, complete, and reuse its final artifact without falling back to prompt-append semantics.
  - on project routes, verify only workspace-owned Pulse context persists across reload (`expertCreateMode` and the active preset selection). Do not expect project workspace restore to hydrate `pulseWorkflowSession`, chat history, draft chat input, or `chatModeEnabled`; ADR 0070 explicitly excludes conversational runtime from project restore.

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
- Terminal projection repair/backfill runs only in primary cycles and is wall-clock cadence-gated by `SHORTPULSE_FAL_PROJECTION_REPAIR_INTERVAL_SECONDS` (default `300`, `0` to run every primary cycle), with an in-process duplicate guard for repeated calls inside the same eligible bucket. This keeps active and rescue recovery frequent while preventing every control-plane cycle from repeating heavy generation projection metadata scans before new rows are likely to cross the stale-repair age.
- Background control-plane ownership is now explicitly split into:
  - stage orchestration: `frontend/lib/server/generationControlPlane/runCycle.ts`
  - recovery batch acquisition: `frontend/lib/server/generationControlPlane/recoveryBatchAcquisition.ts`
  - recovery batch execution: `frontend/lib/server/generationControlPlane/recoveryBatchExecution.ts`
- Treat these response fields as hard health signals during drain:
  - recovery: `claimed`, `processed`, `recovered`, `requeued`, `exhausted`, `errors`
  - observation inbox: `observationClaimed`, `observationProcessed`, `observationIgnored`, `observationFailed`, `observationErrors`
  - cleanup totals: `reservationCleanupScanned`, `reservationCleanupReleased`, `reservationCleanupErrors`
  - cleanup split: `preProviderReservationCleanupScanned`, `preProviderReservationCleanupReleased`, `preProviderReservationCleanupErrors`, `providerAttachedReservationCleanupScanned`, `providerAttachedReservationCleanupReleased`, `providerAttachedReservationCleanupErrors`
  - audio companion art: `audioCompanionArtClaimed`, `audioCompanionArtProcessed`, `audioCompanionArtReady`, `audioCompanionArtFailed`, `audioCompanionArtSkipped`, `audioCompanionArtErrors`
  - projection repair cadence/counts: `projectionRepairRan`, `projectionRepairScanned`, `projectionRepairRepaired`, `projectionRepairSkipped`
  - stage timings: `stageTimings.reservationCleanup.durationMs`, `stageTimings.providerAttachedReservationCleanup.durationMs`, `stageTimings.observationInboxProcessing.durationMs`, `stageTimings.recoveryClaim.durationMs`, `stageTimings.recoveryExecution.durationMs`, `stageTimings.projectionRepair.durationMs`, `stageTimings.audioCompanionArtProcessing.durationMs`
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
- Shared-provider backpressure interpretation:
  - `telemetry.api.fal_submit.recovery_backpressure_applied` means the live runtime reduced shared-provider admission headroom because recovery lag crossed threshold inputs.
  - Treat it as a recovery/admission coupling signal, not a standalone outage signal.
  - Correlate it with stale provider-attached reserved rows, queued/recovering age buckets, `QUEUE_WAIT_TIMEOUT`, and `p95_provider_terminal_to_media_visible_ms`.

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

- `app_error_events` raw rows are retention-managed telemetry. Do not manually delete rows during troubleshooting; preserve forensic history through the approved retention/rollup path.
- `app_error_event_telemetry_daily_rollups` preserves aggregate telemetry counts after low/medium raw telemetry rows leave the raw retention window.
- `browser_crash_sessions` rows are crash-session evidence, not grouped incidents. Browser process death cannot reliably send a final authenticated event, so classify likely freezes by stale authenticated heartbeats and `previous_session_abandoned` reports on the next authenticated page load; when Chrome can deliver a Reporting API `crash` report, `/api/browser-crash-report` promotes the existing row to `confirmed_crash`. Needs Review must include stale active rows even when their stored status is still `active`. Do not manually delete rows during review; use `review_status` (`open` -> `resolved`/`ignored`, with `open` for reopen) plus `review_note` to clear handled rows from Needs Review while preserving searchable forensic history.
- Use incident status transitions (`open` -> `resolved`/`ignored`, with `reopen` when needed) to represent triage state.
- Admin UI focuses on copying grouped incident triage packets into Codex and resolving completed rows. Copying a row marks it in progress locally; each listed row has a `Resolve` action that updates `/api/admin/errors-status` and clears it from the default open queue. Bulk status transitions remain available through `/api/admin/errors-status-bulk` for API/tooling use.
- Provider-sensitive/refusal generation messages and expected retry/rate-limit outcomes are retained in incident storage but excluded from `/admin/errors`; treat them as successful safety or admission handling unless a separate user-impacting failure signature appears.
- Unlinked routine telemetry events are raw evidence and must not be promoted to grouped incidents through `/api/admin/errors-status`; inspect them through the Event Stream source/signal filters instead.
- Default Event Stream lists hide `telemetry.*` rows. Telemetry remains available through explicit source or signal filters and in aggregate summary modules.
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

- Before applying `122_retire_character_sheet_alias_compat.sql`, run `sql/check_character_sheet_alias_drift.sql` after each deploy that touches Character Manager persistence or schema.
- Expected result: every `mismatch_count` is `0`.
- If any non-zero count appears, treat as `medium` severity because cross-surface assignment behavior may diverge.
- Escalate using the troubleshooting runbook section `Character Manager alias drift (historical compatibility window)`.

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

- Scope: synthetic benchmark of `requireApiUser` on protected API paths verifying bearer-token dedupe while legacy proxy headers remain non-authoritative.
- Method: `frontend/tests/api/auth-latency-benchmark.test.ts` runs repeated protected-route auth resolution with a mocked Supabase `/auth/v1/user` lookup and confirms repeated bearer checks are deduped even when legacy proxy headers are present.
- Result snapshot (recent sampled range across repeated runs):
  - Current invariant: one Supabase auth lookup is shared across repeated matching bearer-token checks.
  - Legacy proxy headers are test inputs only; they must not become identity or authorization authority.
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
