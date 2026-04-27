# AI Studio Generation Queue Hardening Plan (2026-03-04)

> Archived on 2026-04-27 because this hardening plan is implementation-complete and retained as historical execution context. The queue/runtime truth now lives in the active runtime docs, SOPs, and code.

## Purpose
Stabilize AI Studio generation start and queued dispatch reliability without architecture churn.

## Problem Statement
Observed runtime behavior showed submit requests reaching `/api/fal/*-submit` and returning `202 queued`, then stalling because stale provider-attached reservations were counted as active concurrency. Queue rows then aged into `QUEUE_WAIT_TIMEOUT` and were exhausted.

## Locked Decisions
1. Keep queue-authoritative behavior; do not add direct-submit bypass in this pass.
2. Keep public API response contracts unchanged.
3. Apply two-layer hardening:
   - app-side active-capacity classification,
   - DB-side stale provider-attached reservation cleanup.
4. Keep Character Mode hard-block semantics unchanged.

## Scope
1. Shared capacity evaluation in submit admission and queue dispatch.
2. Deterministic queue-status resolution for exhausted queue rows.
3. Recovery-route cleanup pass for stale provider-attached reservations.
4. Runtime flags, migration, tests, and runbook updates.

## Out of Scope
1. Queue architecture redesign.
2. New public API endpoints or response contracts.
3. Pricing/catalog changes.

## Design

### 1) Shared active-capacity evaluator
- New server helper: `frontend/lib/server/api/generationQueue/activeProviderCapacity.ts`.
- Input:
  - `userId`, `modelId`, `staleIgnoreMinAgeSeconds`, `orphanGraceSeconds`.
- Output:
  - `tier`, `globalActive`, `tierActive`, `staleIgnoredGlobal`, `staleIgnoredTier`.
- Classification rules:
  - Active generation states: `pending|submitted|running`.
  - Stale-ignore for capacity: generation terminal (`fail|success|cancelled`) or `recovery_state='exhausted'`.
  - Missing generation rows:
    - active during short orphan grace,
    - stale-ignore after configured stale age threshold.

### 2) Shared evaluator wiring
- `frontend/lib/server/api/falSubmitProxy.ts`
  - Uses shared snapshot for admission decision; no duplicate reservation counting logic.
- `frontend/lib/server/api/generationQueue/dispatch.ts`
  - Uses shared snapshot for dispatch no-capacity decision.
- Both paths emit telemetry when stale rows are ignored for capacity:
  - `telemetry.api.fal_submit.capacity_stale_ignored`
  - `telemetry.queue.dispatch.capacity_stale_ignored`

### 3) Deterministic exhausted status behavior
- `frontend/lib/server/api/generationQueue/service.ts`
  - If queue row status is `exhausted`, return `failed` status with queue/generation error message.
  - Prevents exhausted rows from appearing as indefinitely queued.

### 4) Recovery cleanup automation
- Migration: `sql/migrations/054_add_provider_attached_stale_reservation_cleanup.sql`
  - Adds RPC: `release_stale_provider_attached_generation_reservations(p_limit, p_min_age_seconds, p_orphan_min_age_seconds)`.
  - Releases only clearly stale rows with conservative predicates:
    - provider-attached + old enough,
    - no active queue row for same `source_ref`,
    - generation terminal/exhausted OR orphan beyond stricter threshold.
- Recovery route integration:
  - `frontend/pages/api/internal/generation-recovery/run.ts`
  - Calls new RPC behind flags and aggregates cleanup metrics.

### 5) Runtime flags
- `SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_CLEANUP_ENABLED`
- `SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_CLEANUP_MIN_AGE_SECONDS` (default `7200`)
- `SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_ORPHAN_MIN_AGE_SECONDS` (default `86400`)

## Validation Matrix

### Automated
1. `generationQueue.dispatch.test.ts`
2. `generationQueue.dispatch.integrity.test.ts`
3. `fal-submit-proxy.test.ts`
4. `fal-queue-status.test.ts`
5. `internal-generation-recovery-run.test.ts`
6. `falRuntimeFlags.test.ts`
7. `runtime-sql-security-audit-script.test.ts`

### Manual
1. Generate request reaches `/api/fal/*-submit` and queues/dispatched path is visible.
2. Queue entry dispatches under available capacity.
3. Exhausted queue rows resolve as failed in client polling.
4. Recovery route pass reduces stale provider-attached reservations without manual SQL.

## Rollout
1. Deploy app-side evaluator + exhausted queue-status semantics.
2. Apply migration `054`.
3. Enable provider-attached cleanup flags in dev/staging.
4. Monitor:
   - queue exhausted rate,
   - stale-ignored capacity telemetry,
   - cleanup release counts,
   - queue depth trend.

## Rollback
1. Disable provider-attached cleanup flag.
2. Keep app-side stale-ignore evaluator unless regression evidence indicates rollback is required.
3. Preserve queue-authoritative flow and API contracts.
