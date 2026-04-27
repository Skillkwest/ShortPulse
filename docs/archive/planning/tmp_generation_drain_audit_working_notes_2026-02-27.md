# Archive Note

Moved: 2026-04-26
Reason: temporary audit notes no longer belong in active planning; preserved as historical investigation context only.

# Temporary Working Notes: Generation Drain Audit (2026-02-27)

Status: Archived on 2026-04-26 (historical audit notes only)  
Owner: Codex + operator review

## Purpose
- Keep a running document of generation drain/recovery risks and candidate hardening actions before implementation.
- Focus on browser-close/session-refresh stall behavior, queue draining, and recovery reliability.

## Deferred Checkpoint Note (Phase 11)
- Shadow checkpoint is complete and recorded.
- Canary checkpoint decision runs are deferred by schedule:
  - Canary 1 decision run at/after `2026-03-02 18:46:07 UTC`.
  - Canary 2 decision run at/after `2026-03-03 18:46:07 UTC`.
- Any runs before those timestamps are non-decisioning and should not be used to promote/hold/rollback.
- Engineering implementation work continues in parallel under no-regression/Fal-preservation gates.

## Scope And Guardrails
- Read-only inspection only for runtime behavior.
- No schema or code mutations in this audit pass.
- This file is temporary planning collateral retained for historical reference only.

## Snapshot (UTC)
- Latest deep snapshot captured around `2026-02-27T18:36:01Z`.
- Additional runtime + billing integrity snapshot captured around `2026-02-27T18:42:34Z`.
- Runtime flags from local env indicate:
  - `SHORTPULSE_FAL_INTEGRATION_MODE=on`
  - `SHORTPULSE_FAL_RECONCILER_ENABLED=true`
  - `SHORTPULSE_FAL_QUEUE_ENABLED=true`
  - `SHORTPULSE_FAL_QUEUE_MAX_WAIT_SECONDS=1200`
  - `SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS=120`
  - `SHORTPULSE_FAL_QUEUE_LEASE_SECONDS=30`

## Current Operational State
- Active queue pressure is currently drained:
  - `ai_generation_submit_queue`: `24 exhausted`, `0 queued`, `0 dispatching`.
  - `ai_credit_reservations`: `0 reserved`.
  - Open recovery work rows (`queued/recovering` with non-terminal statuses): `0`.
- User-specific state:
  - `skillkwest@gmail.com`: no active queue/reservation/recovery rows.
  - `kirkartman00@gmail.com`: historical exhausted queue rows still present.

## Key Findings (Evidence-Based)

### 1) Webhook path is not actively contributing to completion
Severity: High
- Evidence:
  - `fal_webhook_events` has `0` rows.
  - Long-duration recovered generations consistently show `submit_webhook_registered=false`.
  - Queue/recovery therefore depend on status polling and reconciler, not webhook-first completion.
- Impact:
  - Browser/tab closure removes client polling and increases dependence on reconciler cadence.

### 2) Queue claim conflict incident occurred and materially impacted drain
Severity: High
- Evidence:
  - `app_error_events` (48h): `86` events for `telemetry.queue.dispatch.claim_failed`.
  - Repeated error detail: duplicate key on `ux_ai_generation_submit_queue_dispatching_user`.
  - Same period shows queue timeout exhaustions and prolonged queue ages.
- Impact:
  - Dispatch claim failures can strand queued items until later recovery windows.

### 3) Queue max-wait policy fails jobs under prolonged cap pressure
Severity: High
- Evidence:
  - Exhausted queue rows are marked with `last_error_code=QUEUE_WAIT_TIMEOUT`.
  - Multiple rows exceeded `queue_max_wait_seconds=1200` by large margins before terminal fail (examples observed in thousands of seconds).
  - Exhausted rows all show `attempts=0` (no retry-attempt signal for no-capacity loops).
- Impact:
  - During backlog/cap incidents, valid jobs fail due to elapsed queue budget instead of provider terminal outcome.

### 4) Very long completion latency exists (hours to days) despite eventual success/failure
Severity: High
- Evidence:
  - Many generations completed with duration > 60 minutes; several > 1000 minutes.
  - Outliers observed for both users, including multi-day recoveries in historical window.
  - Recovery execution actor is commonly `reconciler`, indicating delayed server-side convergence.
- Impact:
  - User expectation (2-10 min typical) is violated when recovery/dispatch cadence degrades.

### 5) Runtime SQL security audit has coverage blind spots for queue/recovery RPCs
Severity: Medium
- Evidence:
  - `sql/check_runtime_sql_security_audit.sql` validates core billing/admin RPCs, but not:
    - `public.enqueue_generation_submit(...)`
    - `public.claim_generation_submit_queue_batch(...)`
    - `public.claim_generation_recovery_batch(...)`
  - `sql/migrations/040_harden_runtime_rpc_execute_grants.sql` similarly does not include those queue/recovery RPCs.
  - These functions are granted/hardened in their own migrations, but not enforced by the central audit/hardening checklist.
- Impact:
  - Security posture regressions on queue/recovery RPCs may go undetected by the current standard audit script.

### 6) Recovery-state normalization edge case exists
Severity: Medium
- Evidence:
  - Recovery engine can return `already_persisted` early for `status=success` rows with existing media.
  - This path can skip explicit normalization to `recovery_state='recovered'` when data is already persisted.
  - One stale historical row (`success + recovering`) has been observed previously.
- Impact:
  - Residual lifecycle drift can pollute backlog diagnostics and trigger unnecessary reclaims.

### 7) Billing integrity drift: released reservations later completed successfully without capture
Severity: High (operational controls)
- Evidence:
  - 14-day audit window (`since 2026-02-13T18:42:34Z`):
    - `released provider-attached reservations`: `66`
    - matching generations with `status='success'`: `34`
    - of those successful generations, `generation_charge` ledger rows by `source_ref`: `0`
  - User concentration:
    - `82004e53-a9bd-48c8-85ff-20dbeb658d21` (`kirkartman00@gmail.com`): `27` successful generations with released reservations and no charge.
    - `5da3ca86-b83e-4317-af4e-50f20a331ac6`: `7` successful generations with released reservations and no charge.
  - Example pattern:
    - reservation released first (`released_at` around `2026-02-25/26`)
    - generation later converges to `success + recovered` (often hours later)
    - reservation remains `released`; no capture row exists.
  - Attribution detail:
    - Affected reservation metadata is tagged with manual/local release reasons such as:
      - `Local reset: stale reserved backlog cleanup for admission enforce test.`
      - `Local reset: treat active runs as stuck to unblock enforce validation.`
    - `released_by` markers observed: `codex_local_reset`, `codex_local_stuck_release`.
- Impact:
  - This appears to be primarily operator-induced (manual release path), not confirmed as current automatic runtime behavior.
  - Even so, it is an integrity risk if manual/ops release playbooks do not include post-success settlement reconciliation.

### 8) Queue incident is currently dormant but left clear forensic trail
Severity: High
- Evidence:
  - Last `telemetry.queue.dispatch.claim_failed`: `2026-02-26T19:10:34Z`.
  - Last `telemetry.queue.dispatch.exhausted`: `2026-02-27T18:03:35Z`.
  - Current queue table contains only `24 exhausted` rows, all for user `82004e53-a9bd-48c8-85ff-20dbeb658d21`, all `last_error_code='QUEUE_WAIT_TIMEOUT'`.
  - No current `queued` or `dispatching` rows; no active `reserved` rows.
- Impact:
  - Immediate drain is healthy now, but residual exhausted artifacts indicate prior end-user impact and should remain in incident RCA.

### 9) Recovery timing budget may be too aggressive for long-tail provider latency
Severity: High
- Evidence:
  - Current defaults: `SHORTPULSE_FAL_RECONCILER_MAX_ATTEMPTS=5`, retry delays derived from `120s` base with max `900s`.
  - Effective terminalization window is short (tens of minutes) compared with observed real-world long tails (hours in historical data).
  - Recent fail reasons include `recovery_exhausted` (`19` in 72h snapshot).
- Impact:
  - Long-running but eventually successful provider jobs can be marked failed/exhausted too early, increasing manual replay burden and user confusion.

### 10) Recovery provider probe has no explicit fetch timeout guard
Severity: Medium
- Evidence:
  - `frontend/lib/server/falIntegration/recoveryProviderProbe.ts` performs multiple `fetch` calls without `AbortController` timeout.
  - Claim lease is finite (`SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS=120`), so long-hanging probes can consume lease budget and widen overlap/race windows.
- Impact:
  - Under upstream slowness/network stalls, reconciler efficiency and predictability can degrade.

## Code Path Notes (for later change planning)
- Client queue timeout budget: `20m`.
  - `frontend/features/ai-studio/hooks/taskSubmission/queueStatusPolling.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts`
- Server queue wait timeout source:
  - `frontend/lib/server/api/falRuntimeFlags.ts`
  - `frontend/lib/server/api/generationQueue/dispatch.ts`
- Reconciler + queue dispatcher route:
  - `frontend/pages/api/internal/generation-recovery/run.ts`
- Queue status dispatch/recovery kick:
  - `frontend/pages/api/fal/queue-status.ts`
- Webhook gated by flag:
  - `frontend/pages/api/fal/webhook.ts`

## Candidate Tightening Plan (No Changes Applied Yet)
1. Stabilize dispatch claim path under per-user uniqueness pressure.
2. Revisit queue timeout policy (`queueMaxWaitSeconds`) relative to real runtime tail (2-10 min expected, larger tails observed under incident).
3. Enable/validate webhook-first completion path and monitor ingestion health (`fal_webhook_events` non-zero, processed status mix healthy).
4. Add queue/recovery RPCs to central runtime SQL security audit and grant-hardening migration contract.
5. Normalize lifecycle state on `already_persisted` recovery path to avoid `success + recovering` drift.
6. Add explicit ops metrics capture for reconciler runs (claimed/recovered/exhausted/dispatch-errors) to reduce reliance on ad hoc error-event analysis.
7. Define retention/pruning policy for `ai_generation_submit_queue` exhausted rows to keep diagnostics clean and table size bounded.
8. Add a settlement guardrail for `released -> eventual success` so recovered success attempts can deterministically recapture (or explicitly flag/account for uncompensated success as an incident state).
9. Add an audit query/monitor for `reservation.status='released'` + matching generation `status='success'` + missing `generation_charge` ledger row.
10. Add test coverage for `settleGenerationOutcome(outcome='success')` when reservation is already released (current behavior appears to allow success convergence without charge).
11. Recalibrate reconciler retry budget (`maxAttempts` + delay curve) against observed provider tail latency percentiles.
12. Add explicit per-request timeout/abort budget in recovery provider probe calls to match lease and function runtime budgets.

## Open Questions
- Is production DB definitely on migration `038` function body for queue claim, or did incident happen before rollout and/or under a remaining race?
- Is Supabase cron scheduler for `/api/internal/generation-recovery/run` running continuously at 1-minute cadence during incident windows?
- Is webhook intentionally disabled in this environment, or unintentionally inactive?
- For successful generations that currently map to released reservations, what is the intended billing policy?
  - Strict recapture on eventual success?
  - or accept released-first/no-charge outcomes as policy?
  - Current implementation behaves as the latter in observed data.

## Next Audit Steps
- Validate scheduler run-history in Supabase (`cron.job`, `cron.job_run_details`) against incident timestamps.
- Verify deployed function text/signature state for queue/recovery claim RPCs in production.
- Build a concise before/after acceptance checklist for the eventual hardening implementation pass.
- Add a one-time quantified reconciliation report (affected generations + estimated missed credits) for operator review before any remediation rollout.

## Decision Gate (2026-02-27)
- Context sufficiency to begin implementation: **Yes**.
- External research need before first fix pass: **No** (current repo + runtime evidence are sufficient).
- Remaining pre-implementation items are execution choices, not discovery blockers:
  - recovery retry/lease budget calibration targets,
  - webhook operating mode intent in this environment,
  - policy for handling manual reservation releases that later converge to success.
