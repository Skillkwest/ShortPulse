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

## Remaining high-value work
1. Move remaining client-side lifecycle writes out of AI Studio hooks.
2. Complete profile-driven adapter migration for all model families.
3. Implement reconciler replay execution (beyond claim/requeue/exhaust trigger pass).
4. Finalize Seedream shadow parity report and canary gate automation.
