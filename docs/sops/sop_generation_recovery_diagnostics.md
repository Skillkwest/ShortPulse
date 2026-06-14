# SOP: Generation Recovery Diagnostics

Purpose: canonical operator runbook for accepted-job recovery, settlement integrity, and persisted-output visibility when generation clients disconnect (browser close/crash), provider/webhook paths degrade, or stale blockers accumulate.

## Scope

- Accepted Fal/Kie submit recovery execution behavior.
- Reservation/ledger settlement integrity across success/fail/recovery convergence.
- Read-only diagnostics first; guarded remediation only after explicit stale confirmation.
- Current staged control-plane ownership:
  - background stage orchestration: `frontend/lib/server/generationControlPlane/runCycle.ts`
  - recovery batch acquisition: `frontend/lib/server/generationControlPlane/recoveryBatchAcquisition.ts`
  - recovery batch execution: `frontend/lib/server/generationControlPlane/recoveryBatchExecution.ts`
  - shared recovery engine: `frontend/lib/server/falIntegration/recoveryExecution.ts`

## Prerequisites

- DB read access for:
  - `public.ai_generations`
  - `public.generation_attempts`
  - `public.ai_generation_outputs`
  - `public.fal_webhook_events`
  - `public.ai_credit_reservations`
  - `public.ai_credit_ledger`
- SQL diagnostics/scripts:
  - `sql/check_generation_admission_metrics.sql`
  - `sql/check_generation_recovery_media_visible_latency.sql`
  - `sql/check_generation_convergence_defect_classes.sql`
  - `sql/check_generation_settlement_integrity.sql`
  - `sql/check_control_plane_scheduler_health.sql`
  - `sql/check_pg_net_failure_taxonomy.sql`
  - `sql/check_control_plane_enforce_gate.sql`
  - `sql/check_runtime_sql_security_audit.sql`
- Runtime endpoints:
  - `/api/internal/generation-recovery/run`
  - `/api/internal/admin-user-health-fleet/run`
  - `/api/fal/webhook` (if enabled)
  - `npx tsx scripts/replay_generation_convergence_backlog.ts` (bounded operator replay for `outputs_without_publications` backlog rows)
  - `/api/admin/user-health` (operator diagnostics for per-user generation + drainage health posture)
  - `/api/admin/user-health-fleet` (operator diagnostics for active-user fleet triage and risk-ranked drill-down)

## What Happens If Browser Closes Or Crashes

| Client-visible state at disconnect             | Server-side durable state                                                        | What continues without client                                                                   | Expected final outcome                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `dispatched` (`request_id` attached)           | reservation linked to provider request id; generation row running/recoverable    | Webhook or reconciler probes provider result and executes settlement + transition               | `success` (capture) or `fail` (release), independent of client polling                    |
| provider terminal success while client offline | provider payload reachable; generation may still be `running/recovering` briefly | recovery execution persists media (if allowed), updates generation status, captures reservation | generation converges to `success`; ledger contains one `generation_charge` for source ref |
| provider terminal fail while client offline    | provider failure visible during probe/webhook                                    | recovery execution marks fail + settlement release                                              | generation converges to `fail`; reservation released (or already released)                |
| webhook disabled                               | no async provider callback path                                                  | reconciler-only recovery path handles status probing and settlement                             | convergence still expected, driven by scheduler cadence                                   |
| `media_autosave_enabled = false`               | preference persisted in `user_preferences`                                       | recovery still settles generation success/fail and credits correctly                            | success can converge with autosave skipped (no background media insert)                   |

## Server-Authoritative Guarantees

1. Generation lifecycle is DB-durable (`ai_generations`, `generation_attempts`, `ai_generation_outputs`) and does not depend on browser session continuity.
2. Client polling of provider status routes is UX convenience only; it is not the execution authority.
3. Recovery execution is server-authoritative and can be driven by:
   - scheduler/reconciler (`/api/internal/generation-recovery/run`)
   - webhook ingestion (`/api/fal/webhook`) when enabled, now via the explicit ingress boundary in `frontend/lib/server/falIntegration/falWebhookIngress.ts`.
   - hosted/default POSTs to `/api/internal/generation-recovery/run` execute the primary accepted-job recovery path; bounded recovery-only runs require explicit `{"runMode":"rescue"}`.
   - authenticated visible-output nudges (`/api/generation/reconcile`) when AI Studio reopens with running Reference Grid outputs; this route resolves caller-owned runtime identities or a caller-owned project id and delegates matching visible pending/running rows to the same recovery engine, but scheduler/webhook recovery remains authoritative.
4. Recovery claim flows use lease-based claim semantics to prevent duplicate concurrent processing.
5. Reference Grid restore for accepted generated outputs is `generation_projection`-backed:
   project routes bind through `generation_projection.project_id` and
   `project_generation_items`; plain AI Studio sessions bind through
   `generation_projection.workspace_runtime_key` (for example `session:<sid>`).
   Plain sessions must not fall back to user-global generated-output startup
   hydration when the workspace runtime key is absent.
6. Projection repair must also converge terminal `ai_generations` rows that have
   persisted outputs but missing/nonterminal `generation_projection` rows. When
   generation metadata carries project context, repair preserves autosave
   semantics while best-effort associating the generation to
   `project_generation_items` and verified saved media to `project_media_items`.

## Lifecycle Versus Visibility Contract

Authority reference: `docs/adr/0091-generation-provider-lifecycle-vs-reference-visibility.md`.

1. Provider-accepted jobs remain recoverable until provider terminal success, provider terminal failure, or confirmed provider cancellation.
2. Browser navigation, refresh, project switch, page close, and session cleanup must not mark active provider-backed jobs failed, exhausted, or abandoned.
3. `/api/generation/abandon` is a compatibility route for explicit Reference Grid visibility suppression only. It must not set `ai_generations.status='fail'`, `failure_reason_code='user_abandoned'`, `recovery_state='exhausted'`, or `generation_attempts.status='abandoned'`.
4. `generation_abandonments` and old `user_abandoned` metadata are legacy local evidence. They are not provider-cancel proof.
5. Provider terminal success may recover legacy `fail/user_abandoned` rows through the shared recovery engine when provider media is present and no real provider failure/cancel marker exists.
6. Provider terminal failure must converge to a project-visible error reference unless that output has explicit Reference Grid suppression metadata.
7. Project reopen reconcile should include project-bound recoverable rows from `project_generation_items`, `generation_projection.project_id`, and generation metadata project context, including hidden legacy rows.

## Credit Settlement Invariants

1. Reserve before submit:
   - reservation row created/confirmed before provider submit.
2. Mark submitted:
   - reservation is attached to provider request id after accepted submit.
3. Settle terminal outcome:
   - success => capture reservation (`generation_charge` ledger debit)
   - fail => release reservation (no charge).
4. Released-success recapture semantics:
   - released reservations can recapture on converged success unless `release_finality = waived`.
5. Integrity invariant:
   - non-waived released->success convergence must end with exactly one `generation_charge` for the same `source_ref`.

## Behavior-Preserving Cleanup Guardrails

Treat these as protected runtime invariants during cleanup or refactor work:

1. Poll with canonical media uses direct terminal settlement, while poll with terminal-no-media uses shared recovery.
2. Webhook ingress attempts immediate convergence first, then falls back to observation inbox persistence plus a best-effort control-plane wake when convergence is still pending.
3. `/api/internal/generation-recovery/run` remains the operator-facing control-plane surface for accepted-job recovery, reservation cleanup, observation replay, projection repair, and audio companion art follow-up. Audio companion art uses the shared Flux Klein image helper and stores visibility on `generation_projection`.
4. `requestGenerationControlPlaneWake(...)` is an optimization hint only; scheduler/worker execution remains authoritative if wake delivery fails or is unavailable.
5. Terminal convergence must preserve billing settlement, publication/projection visibility rules, abandonment handling, autosave-skipped success behavior, and motion-reference lease cleanup.

## Windows And Limits (Current Defaults)

| Control                                                | Source                                                                 | Current default |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | --------------- |
| Reconciler min age                                     | `SHORTPULSE_FAL_RECONCILER_MIN_AGE_SECONDS`                            | `120s`          |
| Reconciler lease                                       | `SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS`                              | `120s`          |
| Reservation cleanup min age                            | `SHORTPULSE_FAL_RESERVATION_CLEANUP_MIN_AGE_SECONDS`                   | `900s`          |
| Provider-attached cleanup min age                      | `SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_CLEANUP_MIN_AGE_SECONDS` | `7200s`         |
| Provider-attached orphan min age                       | `SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_ORPHAN_MIN_AGE_SECONDS`  | `86400s`        |
| Running recovery min age for attempt-budget exhaustion | `SHORTPULSE_FAL_RUNNING_EXHAUST_MIN_AGE_SECONDS`                       | `7200s`         |
| Running hard-timeout failover                          | `SHORTPULSE_FAL_RUNNING_HARD_TIMEOUT_SECONDS`                          | `0s` (disabled) |

## Operator Playbooks

### 1) Read-only diagnostics first

1. Run control-plane diagnostics:
   - `sql/check_control_plane_scheduler_health.sql`
   - `sql/check_pg_net_failure_taxonomy.sql`
2. Run `sql/check_generation_admission_metrics.sql`.
3. Run `sql/check_generation_recovery_media_visible_latency.sql`.
4. Run `sql/check_generation_convergence_defect_classes.sql`.
5. Capture:
   - admission-limited events by scope (`per_user` vs `shared_provider`) from `sql/check_generation_admission_metrics.sql`
   - any `telemetry.api.fal_submit.recovery_backpressure_applied` events with `backpressure_level`, `requested_global_max`, and `effective_global_max`
   - provider-terminal-to-media-visible latency (`avg`, `p50`, `p95`, `max`) and worst-case rows from `sql/check_generation_recovery_media_visible_latency.sql`
   - convergence defect-class counts and worst-case rows from `sql/check_generation_convergence_defect_classes.sql`
   - provider-attached reserved holds by age bucket
   - recovery backlog by `recovery_state/status`
   - stale candidates (`>= 2h`) with request id + recovery state filters.

### 1A) Hosted diagnostics path (GitHub Actions)

Use this path when local `SUPABASE_DB_URL` is unavailable.

1. Dispatch workflow:
   ```bash
   gh workflow run reliability-control-plane-diagnostics.yml \
     -f target_environment=staging \
     -f mode=warn
   ```
2. Track run:
   ```bash
   gh run list --workflow reliability-control-plane-diagnostics.yml --limit 5
   ```
3. Download artifacts:
   ```bash
   gh run download <run-id> --name reliability-control-plane-diagnostics-<run-id> --dir /tmp/reliability-diagnostics
   ```
4. Attach:
   - run URL
   - combined log
   - per-SQL logs
     to the active reliability evidence packet.

### 2) Scheduler/recovery drain loop

1. Trigger `/api/internal/generation-recovery/run` repeatedly on normal cadence (recommended 1m).
   - Default/hosted invocation is primary mode for accepted-job recovery.
   - Use explicit `{"runMode":"rescue"}` only for bounded/manual recovery-only passes.
2. Monitor response metrics per pass:
   - observation inbox: `observationClaimed`, `observationProcessed`, `observationIgnored`, `observationFailed`, `observationErrors`
   - recovery: `claimed`, `processed`, `recovered`, `requeued`, `exhausted`, `errors`
   - cleanup: `reservationCleanupScanned`, `reservationCleanupReleased`, `reservationCleanupErrors`.
   - audio companion art: `audioCompanionArtClaimed`, `audioCompanionArtProcessed`, `audioCompanionArtReady`, `audioCompanionArtFailed`, `audioCompanionArtSkipped`, `audioCompanionArtErrors`
   - projection repair counts: `projectionRepairScanned`, `projectionRepairRepaired`, `projectionRepairSkipped`.
   - stage timings: `stageTimings.reservationCleanup.durationMs`, `stageTimings.providerAttachedReservationCleanup.durationMs`, `stageTimings.observationInboxProcessing.durationMs`, `stageTimings.recoveryClaim.durationMs`, `stageTimings.recoveryExecution.durationMs`, `stageTimings.projectionRepair.durationMs`, `stageTimings.audioCompanionArtProcessing.durationMs`.
3. Treat the control-plane stage ownership as:
   - `runCycle.ts` decides stage order,
   - `recoveryBatchAcquisition.ts` owns RPC claim semantics,
   - `recoveryBatchExecution.ts` owns claimed-row iteration, allowlist deferral, and error requeue,
   - `executeGenerationRecovery(...)` owns shared recovery business logic.
4. Re-run recovery, settlement, and admission diagnostics after each pass until counts stabilize and trend down.
5. Treat control-plane enforce diagnostics as the contract check for hosted scheduler drift:
   - `check_control_plane_enforce_gate.sql` now fails when the live scheduler functions are missing either the Vault read for `shortpulse_vercel_protection_bypass_token` or the `x-vercel-protection-bypass` header send.
   - `check_control_plane_enforce_gate.sql` also fails when the live recovery/admin-fleet/media-derivative scheduler functions omit `timeout_milliseconds := 60000`.
   - This specifically catches stale hosted `invoke_generation_recovery_scheduler()` bodies that can leave `pg_cron` green while `pg_net` still returns Vercel `401 Authentication Required`.
6. Treat `telemetry.generation.recovery.media_visible` as the recovery-visibility authority:
   - expect events to appear for recovered-success validation runs,
   - inspect `p95_provider_terminal_to_media_visible_ms` before changing recovery internals again,
   - use the bucketed rows to identify whether lag is clustering by `model_id`, `provider`, or `recovery_actor`.
7. Treat `telemetry.api.fal_submit.recovery_backpressure_applied` as the admission-side lag signal:
   - `backpressure_level = 1` means shared-provider headroom was reduced by `1`
   - `backpressure_level = 2` means shared-provider headroom was reduced by `2`
   - the signal is expected only for Fal/Kie shared-provider lanes
   - if it persists while stale counts and latency are improving, re-check threshold inputs before changing admission caps.

### 2A) Bounded convergence backlog replay

Use this path when `sql/check_generation_convergence_defect_classes.sql` shows `outputs_without_publications > 0` on rows that are already `status='success'` and therefore invisible to normal reconciler claiming.

1. Dry-run candidate selection first:
   ```bash
   npx tsx scripts/replay_generation_convergence_backlog.ts \
     --limit 10 \
     --scan-limit 500
   ```
2. Execute only against the approved development project and require an explicit project-ref check:
   ```bash
   npx tsx scripts/replay_generation_convergence_backlog.ts \
     --execute \
     --expected-project-ref <dev-project-ref> \
     --limit 10 \
     --scan-limit 500
   ```
3. For surgical replay, pass explicit ids instead of broad scanning:
   ```bash
   npx tsx scripts/replay_generation_convergence_backlog.ts \
     --execute \
     --expected-project-ref <dev-project-ref> \
     --generation-id <uuid-1> \
     --generation-id <uuid-2>
   ```
4. Re-run `sql/check_generation_convergence_defect_classes.sql` immediately after the batch and confirm `outputs_without_publications` drops by the replay count you expect.
5. Do not use this helper against staging or production. It is a dev-lane operator tool and defaults to dry-run.

### 3) Guarded manual remediation (only for confirmed stale blockers)

1. Use `/admin/generation-trace` to collect generation, attempt, reservation, output, ledger, and error evidence for each candidate.
2. Keep strict filters unchanged:
   - provider-family scope (`fal%`/`kie%`)
   - request id or attempt provider request id required
   - status + recovery-state constraints
   - age threshold from current recovery policy.
3. Execute targeted remediation only after generation and ledger state agree.
4. If needed, run reservation release helper only for confirmed stale candidates.

### 4) Post-remediation integrity + security checks

1. Re-run `sql/check_control_plane_scheduler_health.sql`.
2. Re-run `sql/check_pg_net_failure_taxonomy.sql`.
3. Run `sql/check_generation_settlement_integrity.sql`.
4. Run `sql/check_runtime_sql_security_audit.sql`.
5. Require:
   - no missing/duplicate settlement keys
   - security audit summary `failing_checks = 0`.

## Failure Mode Map

| Signal / state                                                                                                 | Primary interpretation                                                                        | Required action                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `telemetry.api.fal_submit.recovery_backpressure_applied` repeats while `shared_provider` admission denies rise | recovery-lag safeguard is intentionally squeezing shared-provider intake                      | inspect stale provider-attached holds, queued/recovering age buckets, `QUEUE_WAIT_TIMEOUT`, and recovery-visibility latency before raising admission limits |
| `telemetry.generation.recovery.media_visible` p95 stays high while recovery metrics are healthy                | provider-terminal recovery/media persistence is still slow after upstream completion          | inspect bucketed latency rows for model/provider/actor concentration before touching recovery or admission controls                                         |
| `terminal_success_no_media` or `no_media` retry loops                                                          | provider terminal payload missing media URLs                                                  | continue bounded recovery retries; replay residual outliers; verify provider payload adapters                                                               |
| provider `running` beyond age windows                                                                          | long-running or stranded provider job                                                         | enforce age/attempt policy, then exhaust + release when thresholds are reached                                                                              |
| generation transition guard errors (`GENERATION_MARK_RUNNING_*`, `RESERVATION_SUBMIT_*`)                       | transition safety check prevented unsafe mutation                                             | treat as high risk for duplicate/partial transitions; replay with evidence, do not manual bulk requeue                                                      |
| `GENERATION_PAYLOAD_CONTRACT_VIOLATION` on submit                                                              | emitted request body drifted outside the shared payload contract before provider side effects | verify route/model payload shaping and allowlist ownership before replaying or re-enabling traffic                                                          |
| settlement drift (`missing_charge` / duplicate charge keys)                                                    | reservation/ledger convergence invariant broken                                               | stop manual cleanup, escalate to billing/runtime owners, preserve evidence for reconciliation                                                               |

## Test Matrix (Crash/Recovery Validation)

1. SQL precedence regression:
   - run recovery and settlement diagnostics before/after SQL predicate hardening; confirm stale candidate set is not over-inclusive.
2. Crash after accepted submit:
   - submit returns accepted provider identity; close browser immediately; verify provider status/recovery/settlement converges server-side.
3. Crash after provider request attaches:
   - generation has `request_id`; close browser; verify webhook/reconciler completes status + settlement.
4. Webhook-off resilience:
   - with webhook disabled and reconciler enabled, verify scheduled recovery converges with correct capture/release behavior.
5. Autosave-off behavior:
   - with `media_autosave_enabled=false`, verify success settlement occurs while background media persistence is skipped.
6. Guarded remediation safety:
   - confirm no write path runs without explicit transaction execution and strict filters.
7. Post-action integrity/security:
   - rerun settlement + runtime SQL security audits after remediation tests.

## Evidence Capture Requirements

- Timestamped outputs for all diagnostics runs.
- Per-pass recovery endpoint metric snapshots.
- Candidate counts before/after drain loop and after each manual batch.
- Any manual remediation `RETURNING` rows and release-helper outputs.
- Final integrity/security outputs showing clean posture.

## Decision Rules

- Default to read-only diagnostics and runtime recovery execution first.
- Do not widen age/state filters under incident pressure.
- Never bulk-fail generations without captured evidence.
- Re-run diagnostics after each remediation batch and stop when metrics normalize.

## Escalation

- If settlement anomalies or recovery blockers persist after repeated drain passes:
  - pause further manual mutation,
  - escalate to billing/runtime owners,
  - preserve evidence for postmortem + ledger reconciliation.

## External Best-Practice Anchors

- Supabase Cron: https://supabase.com/docs/guides/cron
- Supabase `pg_net`: https://supabase.com/docs/guides/database/extensions/pg_net
- Supabase Database Webhooks: https://supabase.com/docs/guides/database/webhooks
- PostgreSQL `FOR UPDATE SKIP LOCKED`: https://www.postgresql.org/docs/current/sql-select.html
- Supabase Realtime channel cleanup: https://supabase.com/docs/reference/javascript/removechannel
