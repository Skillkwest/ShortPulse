# AI Studio Generation Runtime Audit (2026-02-20)

Status: Completed snapshot  
Scope: generation submit/status/billing/persistence/recovery paths under AI Studio

## Summary
The repo had strong shared submit/status foundations, but lifecycle authority was still fragmented:
- settlement split across separate success/failure APIs,
- legacy schema fallbacks still active in runtime write paths,
- webhook and internal reconciler trigger routes documented but not implemented,
- rollout flags documented but not wired in code.

## Key findings
1. Billing settlement complexity:
   - Split APIs and legacy fallback paths increased branching in terminal handling.
2. Runtime fallback debt:
   - `generationSubmitPersistence` and admin recovery replay contained missing-column fallback logic.
3. Missing operational endpoints:
   - `/api/fal/webhook` and `/api/internal/generation-recovery/run` were absent.
4. Proxy/auth gap:
   - Fal webhook path was not in explicit webhook exceptions.
5. Config drift:
   - Fal runtime/reconciler/webhook flags were not centralized in code.

## Actions implemented in this pass
1. Added centralized flag reader:
   - `frontend/lib/server/api/falRuntimeFlags.ts`
2. Unified settlement contract:
   - `settleGenerationOutcome({ outcome: success|fail })`
   - Wired `falStatusProxy` to unified settlement path.
3. Locked reservation-first behavior:
   - direct-debit fallback now requires explicit emergency flag.
4. Removed schema-compat write fallbacks:
   - `generationSubmitPersistence` and admin replay update path now require converged schema.
5. Added webhook-first route:
   - `POST /api/fal/webhook` with signature verification and terminal settlement/state updates.
6. Added internal reconciler trigger route:
   - `POST /api/internal/generation-recovery/run` with `x-shortpulse-cron-secret` auth.
7. Added schema convergence migrations:
   - `020_generation_runtime_convergence.sql`
   - `021_generation_state_machine_constraints.sql`
   - `022_generation_persist_idempotency.sql`
   - `023_generation_reconciler_claims.sql`
8. Added/updated tests for:
   - proxy auth boundary updates,
   - webhook route behavior,
   - internal reconciler route behavior,
   - settlement API integration in status tests.
9. Added Fal webhook verification hardening and cutover controls:
   - dual-mode verify (`fal` JWKS/Ed25519 + temporary legacy HMAC),
   - new runtime flags for verify mode + JWKS URL + callback base URL.
10. Added durable webhook inbox + processing audit:
    - `024_fal_webhook_inbox.sql`
    - webhook route now records `event_id` before side effects.
11. Added shared recovery execution engine and wiring:
    - `frontend/lib/server/falIntegration/recoveryExecution.ts`
    - used by webhook, status proxy, internal reconciler, and admin replay.
12. Added lease-based reconciler claims + guarded transition support:
    - `025_generation_recovery_leases.sql`
    - `026_generation_recovery_transition_guards.sql`.
13. Removed remaining client lifecycle writes from orchestration hooks:
    - `useAiStudioTaskOrchestration`
    - `useAiStudioPersistenceActions`.

## Remaining high-value work
1. Complete profile-driven adapter migration for all model families.
2. Finalize Seedream shadow parity report and canary gate automation.
3. Deprecate legacy HMAC fallback and remove `SHORTPULSE_FAL_WEBHOOK_SECRET` after dual-mode cutover window.
