# SOP: Generation Recovery Diagnostics

Purpose: canonical operator runbook for queue dispatch, recovery execution, and settlement integrity when generation clients disconnect (browser close/crash), provider/webhook paths degrade, or stale blockers accumulate.

## Scope
- Fal/Kie queued-submit + recovery execution behavior.
- Reservation/ledger settlement integrity across success/fail/recovery convergence.
- Read-only diagnostics first; guarded remediation only after explicit stale confirmation.

## Prerequisites
- DB read access for:
  - `public.ai_generation_submit_queue`
  - `public.ai_generations`
  - `public.ai_credit_reservations`
  - `public.ai_credit_ledger`
- SQL diagnostics/scripts:
  - `sql/check_generation_queue_blockers.sql`
  - `sql/check_generation_settlement_integrity.sql`
  - `sql/check_control_plane_scheduler_health.sql`
  - `sql/check_pg_net_failure_taxonomy.sql`
  - `sql/check_control_plane_enforce_gate.sql`
  - `sql/check_runtime_sql_security_audit.sql`
- Runtime endpoints:
  - `/api/internal/generation-recovery/run`
  - `/api/internal/admin-user-health-fleet/run`
  - `/api/fal/queue-status`
  - `/api/fal/webhook` (if enabled)
  - `/api/admin/user-health` (operator diagnostics for per-user generation + drainage health posture)
  - `/api/admin/user-health-fleet` (operator diagnostics for active-user fleet triage and risk-ranked drill-down)

## What Happens If Browser Closes Or Crashes
| Client-visible state at disconnect | Server-side durable state | What continues without client | Expected final outcome |
| --- | --- | --- | --- |
| `queued` accepted (`202 GENERATION_QUEUED`) | `ai_generation_submit_queue` row exists; `ai_generations` pending row exists; reservation remains held | Scheduler/reconciler dispatch continues; queue claim/lease + submit retries continue | `dispatched` then provider terminal settlement, or queue timeout/exhausted fail with reservation release |
| `dispatched` (`request_id` attached) | reservation linked to provider request id; generation row running/recoverable | Webhook or reconciler probes provider result and executes settlement + transition | `success` (capture) or `fail` (release), independent of client polling |
| provider terminal success while client offline | provider payload reachable; generation may still be `running/recovering` briefly | recovery execution persists media (if allowed), updates generation status, captures reservation | generation converges to `success`; ledger contains one `generation_charge` for source ref |
| provider terminal fail while client offline | provider failure visible during probe/webhook | recovery execution marks fail + settlement release | generation converges to `fail`; reservation released (or already released) |
| webhook disabled | no async provider callback path | reconciler-only recovery path handles status probing and settlement | convergence still expected, driven by scheduler cadence |
| `media_autosave_enabled = false` | preference persisted in `user_preferences` | recovery still settles generation success/fail and credits correctly | success can converge with autosave skipped (no background media insert) |

## Server-Authoritative Guarantees
1. Queue and generation lifecycle are DB-durable (`ai_generation_submit_queue`, `ai_generations`) and do not depend on browser session continuity.
2. Client polling (`/api/fal/queue-status`) is UX convenience only; it is not the execution authority.
3. Recovery execution is server-authoritative and can be driven by:
   - scheduler/reconciler (`/api/internal/generation-recovery/run`)
   - webhook ingestion (`/api/fal/webhook`) when enabled.
4. Queue dispatch and recovery claim flows use lease-based claim semantics to prevent duplicate concurrent processing.
5. Once provider submit is accepted, queue dispatch must not retry provider submission. Post-accept linkage failures exhaust and compensate fail-closed instead of re-dispatching upstream work.

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

## Windows And Limits (Current Defaults)
| Control | Source | Current default |
| --- | --- | --- |
| Reconciler min age | `SHORTPULSE_FAL_RECONCILER_MIN_AGE_SECONDS` | `120s` |
| Reconciler lease | `SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS` | `120s` |
| Reservation cleanup min age | `SHORTPULSE_FAL_RESERVATION_CLEANUP_MIN_AGE_SECONDS` | `900s` |
| Provider-attached cleanup min age | `SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_CLEANUP_MIN_AGE_SECONDS` | `7200s` |
| Provider-attached orphan min age | `SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_ORPHAN_MIN_AGE_SECONDS` | `86400s` |
| Queue max wait before exhaust | `SHORTPULSE_FAL_QUEUE_MAX_WAIT_SECONDS` | `1200s` |
| Running recovery min age for attempt-budget exhaustion | `SHORTPULSE_FAL_RUNNING_EXHAUST_MIN_AGE_SECONDS` | `7200s` |
| Running hard-timeout failover | `SHORTPULSE_FAL_RUNNING_HARD_TIMEOUT_SECONDS` | `0s` (disabled) |
| Client queue polling max wait | `QUEUE_STATUS_MAX_WAIT_MS` | `1800000ms` (30m) |
| Guarded manual stale threshold | `sql/check_generation_queue_blockers.sql` | `>= 2h` |

## Operator Playbooks
### 1) Read-only diagnostics first
1. Run control-plane diagnostics:
   - `sql/check_control_plane_scheduler_health.sql`
   - `sql/check_pg_net_failure_taxonomy.sql`
2. Run `sql/check_generation_queue_blockers.sql`.
3. Capture:
   - provider-attached reserved holds by age bucket
   - queue depth by status (`queued`, `dispatching`, `exhausted`)
   - queue hotspots by user/model/status
   - recovery backlog by `recovery_state/status`
   - stale candidates (`>= 2h`) with request id + recovery state filters.

### 1A) Hosted diagnostics fallback (GitHub Actions)
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
2. Monitor response metrics per pass:
   - recovery: `claimed`, `processed`, `recovered`, `requeued`, `exhausted`, `errors`
   - queue dispatch: `queueClaimed`, `queueSubmitted`, `queueRetried`, `queueExhausted`, `queueDispatchErrors`
   - cleanup (aggregated pre-submit + provider-attached): `reservationCleanupScanned`, `reservationCleanupReleased`, `reservationCleanupErrors`.
3. Re-run blocker diagnostics after each pass until counts stabilize and trend down.
4. Treat control-plane enforce diagnostics as the contract check for hosted scheduler drift:
   - `check_control_plane_enforce_gate.sql` now fails when the live scheduler functions are missing either the Vault read for `shortpulse_vercel_protection_bypass_token` or the `x-vercel-protection-bypass` header send.
   - This specifically catches stale hosted `invoke_generation_recovery_scheduler()` bodies that can leave `pg_cron` green while `pg_net` still returns Vercel `401 Authentication Required`.

### 3) Guarded manual remediation (only for confirmed stale blockers)
1. Use the commented remediation transaction in `sql/check_generation_queue_blockers.sql`.
2. Keep strict filters unchanged:
   - provider-family scope (`fal%`/`kie%`)
   - request id required
   - status + recovery-state constraints
   - age threshold (`>= 2h`).
3. Execute inside transaction; inspect `RETURNING` rows before commit.
4. If needed, run reservation release helper only for confirmed stale candidates.

### 4) Post-remediation integrity + security checks
1. Re-run `sql/check_control_plane_scheduler_health.sql`.
2. Re-run `sql/check_pg_net_failure_taxonomy.sql`.
3. Run `sql/check_generation_settlement_integrity.sql`.
4. Run `sql/check_runtime_sql_security_audit.sql`.
3. Require:
   - no missing/duplicate settlement keys
   - security audit summary `failing_checks = 0`.

## Failure Mode Map
| Signal / state | Primary interpretation | Required action |
| --- | --- | --- |
| queue status `exhausted` growth | queue dispatch retries/waits are hitting terminal limits | inspect queue error codes, verify provider health, confirm reservation release on exhausted rows |
| queue-status reports `dispatching` for long periods | queue claim/lease succeeded but provider handoff is not converging | inspect queue lease age, dispatch retries, and provider submit telemetry before widening capacity or replaying jobs |
| queue-status remains `queued` with no `request_id` while queue row is exhausted | stale client perception caused by nondeterministic queue-status resolution | verify queue-status path returns `failed` for exhausted rows and inspect `last_error` / `last_error_code` |
| `terminal_success_no_media` or `no_media` retry loops | provider terminal payload missing media URLs | continue bounded recovery retries; replay residual outliers; verify provider payload adapters |
| provider `running` beyond age windows | long-running or stranded provider job | enforce age/attempt policy, then exhaust + release when thresholds are reached |
| queue transition guard errors (`QUEUE_*`, `GENERATION_MARK_RUNNING_*`, `RESERVATION_SUBMIT_*`) | transition safety check prevented unsafe mutation | treat as high risk for duplicate/partial transitions; replay with evidence, do not manual bulk requeue |
| `GENERATION_PAYLOAD_CONTRACT_VIOLATION` on submit | emitted request body drifted outside the shared payload contract before queue/provider side effects | verify route/model payload shaping and allowlist ownership before replaying or re-enabling traffic |
| `QUEUE_PAYLOAD_CONTRACT_VIOLATION` on dispatch | queued payload no longer satisfies the shared submit/dispatch contract | inspect queued payload, model allowlist, and route shaping; do not blind requeue until payload drift is corrected |
| `QUEUE_IDENTITY_MISMATCH` | queue row, generation metadata, and reservation submission no longer agree on `source_ref` ownership | treat as fail-closed integrity event; inspect queue row, generation metadata, reservation row, and replay only after source identity is corrected |
| settlement drift (`missing_charge` / duplicate charge keys) | reservation/ledger convergence invariant broken | stop manual cleanup, escalate to billing/runtime owners, preserve evidence for reconciliation |

## Test Matrix (Crash/Recovery Validation)
1. SQL precedence regression:
   - run blocker diagnostics before/after SQL predicate hardening; confirm stale candidate set is not over-inclusive.
2. Crash after queued submit:
   - submit returns `202`; close browser immediately; verify queue->dispatch->settlement converges server-side.
3. Crash after dispatch:
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
- Supabase Queues overview: https://supabase.com/docs/guides/queues
- Supabase Queues quickstart (PGMQ): https://supabase.com/docs/guides/queues/quickstart
- Supabase queue consumption with Edge Functions: https://supabase.com/docs/guides/queues/consuming-messages-with-edge-functions
- Supabase Database Webhooks: https://supabase.com/docs/guides/database/webhooks
- PostgreSQL `FOR UPDATE SKIP LOCKED`: https://www.postgresql.org/docs/current/sql-select.html
- Supabase Realtime channel cleanup: https://supabase.com/docs/reference/javascript/removechannel
