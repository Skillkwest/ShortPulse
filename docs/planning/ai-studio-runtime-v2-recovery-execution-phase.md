# AI Studio Runtime V2: Recovery Execution Phase

Status: active  
Owner: AI Studio Engineering  
Last updated: 2026-02-20

## Objective
Finish runtime-v2 convergence by making webhook/status/reconciler/admin replay execute the same idempotent server recovery pipeline.

Pipeline:
`retrieve/probe -> normalize -> persist (idempotent) -> settle -> transition -> schedule`

## Scope
In scope:
- Fal webhook verification hardening (JWKS/Ed25519 + dual-mode cutover).
- Durable webhook inbox (`fal_webhook_events`) for event idempotency.
- Shared recovery execution module used by all runtime entry points.
- Lease-based reconciler claims and guarded recovery transition support.
- Client lifecycle write retirement from AI Studio orchestration hooks.

Out of scope:
- External queue/worker infrastructure.
- Public API contract changes for `/api/fal/*`.

## Deliverables
- [x] `frontend/lib/server/falIntegration/recoveryExecution.ts` added and wired to:
  - `/api/fal/webhook`
  - `/api/internal/generation-recovery/run`
  - `/api/admin/generation-recovery/replay`
  - `falStatusProxy` terminal paths
- [x] Fal webhook verification cutover controls:
  - `SHORTPULSE_FAL_WEBHOOK_VERIFY_MODE`
  - `SHORTPULSE_FAL_WEBHOOK_JWKS_URL`
  - `SHORTPULSE_FAL_WEBHOOK_SECRET` (legacy fallback only)
- [x] Submit-time webhook registration (`fal_webhook`) in shared submit proxy.
- [x] Migrations + rollbacks added:
  - `024_fal_webhook_inbox`
  - `025_generation_recovery_leases`
  - `026_generation_recovery_transition_guards`
- [x] Client orchestration lifecycle writes removed.

## Runtime flags
- `SHORTPULSE_FAL_WEBHOOK_VERIFY_MODE=dual|fal_only|hmac_only`
- `SHORTPULSE_FAL_WEBHOOK_JWKS_URL`
- `SHORTPULSE_PUBLIC_API_BASE_URL` (fallback `APP_BASE_URL`)
- `SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS`

## Validation checklist
- [x] `npm run type-check`
- [x] `npm run lint`
- [x] Targeted tests:
  - `tests/api/fal-webhook-signature.test.ts`
  - `tests/api/fal-webhook-route.test.ts`
  - `tests/api/internal-generation-recovery-run.test.ts`
  - `tests/api/fal-status-proxy.test.ts`
  - `tests/api/fal-submit-proxy.test.ts`
  - `features/ai-studio/hooks/__tests__/useAiStudioTaskOrchestration.test.ts`

## Follow-up gates
1. Publish Seedream shadow parity report.
2. Hold canary for 72h with zero duplicate settlement/persistence regressions.
3. Remove legacy HMAC fallback after cutover window.
