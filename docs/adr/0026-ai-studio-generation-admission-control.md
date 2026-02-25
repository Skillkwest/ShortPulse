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

## Alternatives considered
- Server FIFO queue first:
  - Rejected for phase 1 due higher migration risk (queue persistence, workers, cancellation semantics, billing semantics for queued jobs).
- Client-only queue:
  - Rejected because it is non-authoritative across tabs/devices and cannot protect server/provider load reliably.
