# ADR 0026: AI Studio Generation Admission Control (Server Hard Cap + 429)

## Status
Accepted

## Context
AI Studio generation submits can be triggered in bursts (multi-card reference workflows, repeated Generate clicks, and multi-tab usage).  
Fal already provides provider-side queueing, but without server-side admission control ShortPulse still pays submit/polling overhead and can amplify client instability under high local concurrency.

The near-term goal is overload protection with minimal regression risk while preserving:
- server-authoritative billing and generation lifecycle (`ADR 0020`),
- existing `/api/fal/*` route contracts and recovery flows,
- immediate rollback via runtime flags.

## Decision
1. Implement server-side admission control in `falSubmitProxy` immediately after reservation creation and before Fal submit.
2. Use hard rejection (`429` + `Retry-After`) in `enforce` mode; do not introduce a persistent FIFO queue in phase 1.
3. Support three rollout modes via runtime flags:
   - `off`: bypass admission checks.
   - `shadow`: compute/log would-block decisions only.
   - `enforce`: reject over-limit submits deterministically.
4. Enforce both:
   - per-user global concurrent cap, and
   - per-model-tier concurrent cap (`video_long`, `image_heavy`, `image_standard`).
5. Keep billing safe on deny:
   - release reservation immediately when denied,
   - return structured `GENERATION_ADMISSION_LIMIT` payload,
   - keep webhook/polling/reconciler contracts unchanged.
6. Defer persistent server FIFO queueing until telemetry proves hard-cap rejection is insufficient.

## Consequences
- Positive:
  - Immediate overload guard with minimal architecture surface area.
  - No new queue worker/state machine needed in phase 1.
  - No “charged but denied” behavior; reservation is released on admission rejection.
  - Fast rollback by setting `SHORTPULSE_FAL_ADMISSION_MODE=off`.
- Negative:
  - No “wait in line” UX yet; users must retry after `Retry-After`.
  - Admission counts are reservation-based; tuning may be needed per tier as traffic evolves.
  - Shadow telemetry volume must be monitored to avoid noisy operator channels.

## Follow-Up Hardening (2026-02-25)
1. Phase 1 shipped:
   - Enforce-mode fail-closed behavior when billing falls back to direct debit (`503 GENERATION_ADMISSION_UNAVAILABLE` + immediate refund + `Retry-After`).
   - Conservative stale reservation cleanup (`release_stale_generation_reservations`) integrated into the existing generation-recovery cron path.
   - Admission deny logs standardized to telemetry source (`telemetry.api.fal_submit.admission_limited`) to keep operator incident queues focused on true failures.
2. Phase 2 prepared behind flag:
   - Added atomic RPC `admit_and_reserve_generation_credits` for single-transaction admission+reservation.
   - App path can call atomic RPC via `SHORTPULSE_FAL_ADMISSION_ATOMIC_ENABLED` with legacy reservation RPC fallback.
3. Rollout posture:
   - Keep atomic path disabled by default until parity validation and stress verification are complete.

## Follow-Up Queue Phase (2026-02-26)
1. Introduced optional server-authoritative submit queue behind `SHORTPULSE_FAL_QUEUE_ENABLED`.
2. Over-cap submit behavior in enforce mode now admits as queued (`202`, `code=GENERATION_QUEUED`) instead of immediate `429`, while preserving reservation safety and rollback to hard-cap path when queue flag is off.
3. Added durable queue storage (`ai_generation_submit_queue`) with idempotent enqueue (`user_id + source_ref`) and lease-based dispatch claims (`FOR UPDATE SKIP LOCKED` + per-user dispatch uniqueness).
4. Added authenticated queue handoff endpoint (`GET /api/fal/queue-status`) for spinner-only client polling until provider request id is assigned.
5. Extended reconciler route (`/api/internal/generation-recovery/run`) to run queue dispatch batches and return queue metrics alongside recovery/cleanup metrics.

## Follow-Up Queue/Recovery Stabilization (2026-02-26)
1. Hardened recovery execution so provider-observed `running` generations that exhaust recovery attempts now settle as `fail` in the same pass, preventing indefinite capacity holds.
2. Added queue max-wait policy (`SHORTPULSE_FAL_QUEUE_MAX_WAIT_SECONDS`, default 1200s) so no-capacity requeues cannot persist forever; timed-out queue entries are exhausted, reservation-released, and terminalized.
3. Extended internal recovery route auth to accept bearer secret in addition to cron header, and standardized on external scheduler invocation (Supabase Cron primary) for minute-cadence queue dispatch + recovery processing.

## Follow-Up Capacity/Queue Hardening (2026-03-04)
1. Added a shared provider-attached active-capacity evaluator used by both submit admission (`falSubmitProxy`) and queue dispatch (`generationQueue/dispatch`) so both choke points apply the same stale/active classification semantics.
2. Capacity evaluation now ignores clearly stale provider-attached reserved rows for concurrency decisions while keeping recent unmatched rows fail-closed during a short grace window.
3. Queue status behavior was hardened so exhausted queue rows resolve as `failed` (instead of lingering as `queued`) without changing the public route contract.
4. Added migration `054_add_provider_attached_stale_reservation_cleanup.sql` and recovery-route integration for service-role stale provider-attached reservation cleanup behind runtime flags.

## Alternatives considered
- Server FIFO queue first:
  - Rejected for phase 1 due higher migration risk (queue persistence, workers, cancellation semantics, billing semantics for queued jobs).
- Client-only queue:
  - Rejected because it is non-authoritative across tabs/devices and cannot protect server/provider load reliably.
