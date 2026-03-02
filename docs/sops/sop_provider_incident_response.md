# SOP: Provider Incident Response (Fal, OpenAI, Stripe)

Purpose: operational runbook for diagnosing and mitigating provider failures that impact generation, billing, or webhook processing.

## Scope
- In scope:
  - Fal submit/status failures (`/api/fal/*`).
  - OpenAI prompt/agent failures (`/api/ai/*`).
  - Stripe webhook and billing flow failures (`/api/billing/stripe/*`).
- Out of scope:
  - Frontend-only visual regressions without provider/API failures.
  - General deployment rollback procedures (see `docs/disaster-recovery.md`).

## Prerequisites
- Admin access to `/admin` for incident triage.
- Supabase SQL access for read diagnostics.
- Access to deployment logs for API routes.
- Current env verification: `FAL_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SHORTPULSE_OPENAI_RESPONSES_ENABLED`, `SHORTPULSE_OPENAI_CHAT_FALLBACK_ENABLED`.
- If Fal reliability rollout is enabled, also verify: `SHORTPULSE_FAL_INTEGRATION_MODE`, `SHORTPULSE_FAL_WEBHOOK_ENABLED`, `SHORTPULSE_FAL_WEBHOOK_VERIFY_MODE`, `SHORTPULSE_FAL_WEBHOOK_JWKS_URL`, `SHORTPULSE_FAL_WEBHOOK_SECRET` (dual-mode fallback only), `SHORTPULSE_FAL_WEBHOOK_CANARY_USER_ALLOWLIST`, `SHORTPULSE_FAL_WEBHOOK_CANARY_MODEL_ALLOWLIST`, `SHORTPULSE_FAL_RECONCILER_ENABLED`, `SHORTPULSE_FAL_RECONCILER_CRON_SECRET`, optional `CRON_SECRET` (manual/fallback), `SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS`, `SHORTPULSE_FAL_QUEUE_ENABLED`, `SHORTPULSE_FAL_QUEUE_DISPATCH_BATCH_SIZE`, `SHORTPULSE_FAL_QUEUE_MAX_ATTEMPTS`, `SHORTPULSE_FAL_QUEUE_MAX_WAIT_SECONDS`, `SHORTPULSE_FAL_TRUSTED_HOSTS`.

## Triage workflow (first 15 minutes)
1. Confirm incident scope in `/admin`:
   - Filter `source`, `severity`, `route`, and `endpoint` in the Errors panel.
   - Capture one representative incident fingerprint and request ID.
2. Classify incident:
   - Fal generation outage.
   - OpenAI text/agent outage.
   - Stripe checkout/portal/webhook outage.
3. Check blast radius:
   - Single route/model vs all requests.
   - One user vs multi-user recurrence (`occurrences_count`, `last_seen_at`).
4. Apply immediate mitigation:
   - Hide or disable affected UI action where possible.
   - Keep unaffected generation/billing paths available.

## Provider-specific diagnostics

### Fal generation failures
Primary signals:
- `source = api.exception` with routes under `/api/fal/*`.
- User-visible generation errors or stuck pending tasks.
- Recovery backlog growth (`terminal_success_no_media`, stale running, or failed persist).

Checks:
```sql
select id, source, route, endpoint, message, http_status, last_seen_at, occurrences_count
from app_error_logs
where endpoint like '/api/fal/%'
order by last_seen_at desc
limit 50;
```

```sql
select user_id, model_id, status, count(*) as reservations, min(created_at) as oldest, max(created_at) as newest
from ai_credit_reservations
group by user_id, model_id, status
order by newest desc
limit 100;
```

```sql
select status, count(*) as jobs, min(created_at) as oldest, max(created_at) as newest
from ai_generation_submit_queue
group by status
order by status;
```

Mitigation guidance:
1. Confirm submit path rejects are auto-refunded by checking reservation state transitions (`reserved` -> `released`).
2. Confirm completed runs capture (`reserved` -> `captured`) and create a ledger debit.
3. If one model endpoint is degraded, temporarily remove that model from UI selection until provider recovers.
4. When queue mode is enabled:
   - If `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=true`, confirm `/api/fal/queue-status` can move entries from `queued` to `dispatched`.
   - If `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=false` (read-only mode), rely on reconciler dispatch metrics and queue depth trends instead of route-side kick behavior.
5. If users receive `GENERATION_ADMISSION_UNAVAILABLE`, treat it as reservation-mode degradation during enforce admission and verify:
   - reservation RPC health (`reserve_generation_credits` / `admit_and_reserve_generation_credits`),
   - `SHORTPULSE_FAL_DIRECT_DEBIT_FALLBACK_ENABLED`,
   - `SHORTPULSE_FAL_ADMISSION_MODE` (`enforce` fail-closes without reservation mode by design).
6. If queue depth is pinned near `SHORTPULSE_FAL_QUEUE_MAX_PER_USER`, run controlled backlog drain:
   - ensure reconciler route scheduler is active,
   - trigger `/api/internal/generation-recovery/run` repeatedly (1-minute cadence) until old provider-attached reservations clear,
   - verify queue depth drops before resuming stress submits.
   - use `sql/check_generation_queue_blockers.sql` for read-only blocker triage and guarded cleanup template if backlog remains stuck.

Scheduler health checks (Supabase Cron standard):
```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'shortpulse_generation_recovery_every_minute';
```

```sql
select jobid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid = (
  select jobid
  from cron.job
  where jobname = 'shortpulse_generation_recovery_every_minute'
)
order by start_time desc
limit 20;
```

Correlate scheduler health with queue/recovery pressure:
- `queueDispatchErrors` from `/api/internal/generation-recovery/run` responses should stay low.
- `ai_generation_submit_queue` depth should trend downward after incident recovery.
- stale `reserved` holds with `provider_request_id` should decline after repeated passes.

Fal reliability rollout controls (when enabled):
1. Confirm mode and model gating:
   - `SHORTPULSE_FAL_INTEGRATION_MODE=legacy|shadow|on`
   - `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST`
2. If incident severity requires immediate containment, set mode to `legacy` (global kill switch).
3. If recovery lag is accumulating, run one protected reconciler pass via `/api/internal/generation-recovery/run` and inspect replay outcomes.
   - Validate cleanup metrics in response: `reservationCleanupScanned`, `reservationCleanupReleased`, `reservationCleanupErrors`.
4. For exhausted/edge cases, use admin replay (`/api/admin/generation-recovery/replay`).
5. If webhook ingestion is unhealthy, keep polling fallback active and verify `/api/fal/webhook` signature errors before disabling webhook mode.
6. For controlled webhook canary:
   - keep `SHORTPULSE_FAL_WEBHOOK_ENABLED=true`,
   - scope callback registration with `SHORTPULSE_FAL_WEBHOOK_CANARY_USER_ALLOWLIST` and/or `SHORTPULSE_FAL_WEBHOOK_CANARY_MODEL_ALLOWLIST`,
   - keep allowlists empty for full cohort only after canary windows are green.

### Queue backlog triage and guarded cleanup
When queue dispatch is healthy but users still hit repeated `429` due stale provider-attached holds:
1. Run `sql/check_generation_queue_blockers.sql`.
2. Confirm diagnostics first:
   - provider-attached `reserved` holds by age bucket,
   - queue depth by `queued/dispatching/exhausted`,
   - stale `fal%` generations in `queued/recovering`.
3. Execute at least 3-5 reconciler passes (`/api/internal/generation-recovery/run`) and re-check counts.
4. Only if blockers remain stale after repeated passes, use the guarded remediation block in the SQL file:
   - strict age filter (default `>2h`),
   - explicit states only (`pending/submitted/running` + `queued/recovering`),
   - no blanket unfiltered updates.
5. Re-run diagnostics to verify queue depth and provider-attached holds are dropping.

Failure-code action map (Fal reliability rollout):
| `failure_reason_code` | Primary action |
| --- | --- |
| `status_alias_retryable` / `result_alias_retryable` | Keep polling/retrieval retries active; verify alias sweep behavior for the model profile. |
| `terminal_success_no_media` | Queue for reconciler retry; replay manually if age exceeds SLA. |
| `status_poll_error` / `provider_error` | Check provider health and route exceptions; consider temporary model disable. |
| `SUBMIT_NOT_STARTED` | Inspect submit routing/handler invariants; verify route handled model and `request_id` was returned; treat as fail-fast client-side start failure. |
| `PREFLIGHT_TIMEOUT` | Inspect pre-submit media prep/signing latency and storage auth path; treat as client preflight timeout before provider submit. |
| `persist_upload_error` / `persist_insert_error` | Validate storage + DB availability; replay persistence after correction. |
| `payload_drift_detected` | Compare payload against fixtures and update adapter/profile parsing safely. |
| `circuit_breaker_open` | Keep model paused until failure ratio drops below threshold and smoke tests pass. |
| `recovery_exhausted` | Use admin replay path and escalate to engineering incident review. |

Queue transition guard diagnostics:
1. Queue transition failures now emit deterministic error codes from guarded steps (`QUEUE_*`, `GENERATION_MARK_RUNNING_*`, `RESERVATION_SUBMIT_*`).
2. During queue incident triage, filter app errors by:
   - `source in ('telemetry.queue.dispatch.retry','telemetry.queue.dispatch.exhausted')`
   - metadata keys: `queue_id`, `generation_id`, `error_code`, `model_id`.
3. If `GENERATION_MARK_RUNNING_*` appears after provider acceptance:
   - treat as high-risk duplicate-submit guard activation,
   - keep queue item exhausted (do not manual requeue blindly),
   - use admin replay/reconciler path after confirming generation row + reservation state.
4. If `RESERVATION_SUBMIT_FAILED` repeats with existing `request_id`:
   - treat as billing-state reconciliation issue,
   - verify reservation RPC health before changing queue limits.

Trusted outbound URL guard diagnostics:
1. Status route fail-closed guard emits `source='api.fal_status.untrusted_base_url'` when no trusted `queueBaseUrl` remains after filtering.
2. Submit/recovery guard failures include `Untrusted Fal provider URL blocked` in route exception metadata.
3. First verify configured status/submit base URLs still target Fal-owned hosts and use `https`.
4. Then verify `SHORTPULSE_FAL_TRUSTED_HOSTS` (if set) includes required Fal domains and no stale/overly narrow host list.
5. Do not disable trust guards to recover traffic. Instead, correct host configuration and re-run one generation smoke + one status poll smoke.

Admission-control action map:
| Signal | Primary action |
| --- | --- |
| `429 GENERATION_ADMISSION_LIMIT` | Expected limiter behavior under load; monitor tier distribution and user retry friction. |
| `503 GENERATION_ADMISSION_UNAVAILABLE` | Admission safeguard tripped due reservation-mode unavailability in enforce mode; investigate reservation RPC and fallback settings before changing admission mode. |

### OpenAI prompt/agent failures
Primary signals:
- Errors from `/api/ai/generate-prompt`, `/api/ai/describe-image`, `/api/ai/studio-agent`.
- Large spike in failed prompt refine/describe interactions.

Checks:
```sql
select id, endpoint, message, http_status, metadata, last_seen_at, occurrences_count
from app_error_logs
where endpoint like '/api/ai/%'
order by last_seen_at desc
limit 50;
```

Mitigation guidance:
1. Verify `OPENAI_API_KEY` and model env vars are present and unchanged.
2. Fallback to manual prompt entry when agent endpoints degrade.
3. If only one endpoint fails (`describe-image` vs `studio-agent`), keep unaffected AI paths enabled.

### Stripe webhook or billing failures
Primary signals:
- Checkout/portal route failures.
- Missing credit grants after successful payments.
- Webhook failures or signature errors.

Checks:
```sql
select id, event_type, received_at
from stripe_event_log
order by received_at desc
limit 100;
```

```sql
select id, endpoint, message, http_status, metadata, last_seen_at, occurrences_count
from app_error_logs
where endpoint like '/api/billing/stripe/%'
order by last_seen_at desc
limit 50;
```

Mitigation guidance:
1. If webhook signature validation fails, verify `STRIPE_WEBHOOK_SECRET` matches the active endpoint in Stripe.
2. If duplicate grant concerns appear, confirm event IDs are recorded in `stripe_event_log` and skipped on replay.
3. If checkout/portal creation fails, verify `STRIPE_SECRET_KEY` and customer linkage in `billing_profiles`.

## Recovery validation checklist
1. Submit one generation and verify:
   - reservation created,
   - provider request id attached,
   - reservation captured or released correctly.
2. Run one prompt refine and one image describe call.
3. Trigger one billing action (checkout or portal).
4. Verify no new high-severity incidents are opening for the affected endpoints.

## Reconciler and replay runbook (Fal reliability rollout)
1. Candidate classes:
   - `terminal_success_no_media`
   - stale `running` beyond model wall-time budget
   - `failed_persist` eligible for retry
2. Reconciler invocation:
   - Route: `POST` or `GET` `/api/internal/generation-recovery/run`
   - Auth: `x-shortpulse-cron-secret` or `Authorization: Bearer <secret>` (`SHORTPULSE_FAL_RECONCILER_CRON_SECRET`, optional `CRON_SECRET` manual/fallback).
   - Note: reconciler claims are lease-based; validate `SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS` to avoid duplicate concurrent execution.
   - Queue dispatch also runs in this route; inspect `queueClaimed`, `queueSubmitted`, `queueRetried`, `queueExhausted`, and `queueDispatchErrors`.
   - Optional reservation cleanup controls:
     - `SHORTPULSE_FAL_RESERVATION_CLEANUP_ENABLED`
     - `SHORTPULSE_FAL_RESERVATION_CLEANUP_MIN_AGE_SECONDS`
     - `SHORTPULSE_FAL_RESERVATION_CLEANUP_BATCH_SIZE`
3. Replay invocation:
   - Route: `POST /api/admin/generation-recovery/replay`
   - Inputs: `generationId` or `requestId`
4. Success criteria:
   - Recovery success rate for no-media terminal states stays above 99%.
   - Unresolved `terminal_success_no_media` older than 30 minutes remains below 0.1%.
   - Billing reservation/capture/refund invariants remain unchanged.

## Post-incident requirements
1. Record incident summary and fix in `docs/change_log.md`.
2. Add unresolved issues and temporary mitigations to `docs/known-issues.md`.
3. If the fix changes architecture or control boundaries, add/update an ADR in `docs/adr/`.
4. If any schema/migration action was required, update `docs/database-migrations.md` and `docs/data-dictionary.md`.
