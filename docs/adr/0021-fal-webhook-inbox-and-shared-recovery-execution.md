# ADR 0021: Fal Webhook Inbox, Verification Cutover, and Shared Recovery Execution

- Status: Accepted
- Date: 2026-02-20
- Owners: AI Studio Engineering
- Extends: `docs/adr/0020-ai-studio-server-authoritative-runtime-v2.md`

## Context
Runtime v2 required server-authoritative lifecycle control, but three gaps remained:
1. webhook verification path was not aligned to Fal's current signature model,
2. webhook ingestion lacked durable idempotency at the event layer,
3. recovery execution behavior diverged across webhook/status/reconciler/admin replay paths.

These gaps increased duplicate side-effect risk and made rollout gates harder to enforce.

## Decision
1. Adopt Fal webhook verification on the Fal JWKS/Ed25519 path:
   - `SHORTPULSE_FAL_WEBHOOK_JWKS_URL`
   - historical dual/HMAC cutover support is retired from the active runtime contract.
2. Add durable webhook inbox table (`fal_webhook_events`) keyed by provider `event_id`.
3. Register webhook callback at submit time using Fal queue `fal_webhook` parameter.
4. Use one shared recovery execution engine for terminal processing and recovery side effects:
   - webhook route,
   - status proxy terminal paths,
   - internal reconciler,
   - admin replay.
5. Add lease-based reconciler claim semantics and guarded status transition support for bounded `fail -> success` recovery completion.

## Consequences
Positive:
- Webhook ingestion is idempotent before side effects.
- Lifecycle persistence/settlement logic is centralized and reusable.
- Reconciler claims reduce concurrent duplicate processing risk.
- Recovery completion from `terminal_success_no_media` is explicitly guarded.

Tradeoffs:
- Additional schema/runtime migration requirements (`024`-`026`).
- Historical webhook rows may still retain pre-cutover verification metadata.

## Rollback/mitigation
- Keep polling fallback active.
- If runtime reliability gates regress, set `SHORTPULSE_FAL_INTEGRATION_MODE=legacy` while triaging.
