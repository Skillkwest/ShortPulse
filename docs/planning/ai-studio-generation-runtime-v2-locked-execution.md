# AI Studio Generation Runtime V2: Locked Execution

Status: Active  
Owner: AI Studio Engineering  
Last updated: 2026-02-20

## Locked objective
Ship one reliable, modular, server-authoritative Fal generation runtime behind existing `/api/fal/*` contracts.

Pipeline:
`submit -> retrieve/webhook -> normalize -> persist media -> settle billing -> recover if needed`

## Locked decisions
1. No new public page.
2. Keep existing AI Studio UI and current `/api/fal/*` contracts.
3. Server owns generation lifecycle; client is render-only for lifecycle state.
4. Single retry owner: server runtime only.
5. Enforce strict lifecycle transitions in one place.
6. Idempotency on all side effects.
7. Canary by model family (Seedream first).
8. Block merges/rollout on reliability gate regressions.

## Execution sequence (no alternatives)
1. Schema convergence and fallback retirement.
2. Settlement unification (`settleGenerationOutcome`) and reservation-first billing.
3. Webhook-first ingestion route (`/api/fal/webhook`) with polling fallback retained.
4. Reconciler trigger route (`/api/internal/generation-recovery/run`) with secret auth.
5. Runtime flags wired in code and deployment docs.
6. Client lifecycle side-effects retirement (phased removal from hooks).
7. Shadow parity, then canary allowlist ramp.

## Rollout flags
- `SHORTPULSE_FAL_INTEGRATION_MODE=legacy|shadow|on`
- `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST`
- `SHORTPULSE_FAL_WEBHOOK_ENABLED`
- `SHORTPULSE_FAL_RECONCILER_ENABLED`
- `SHORTPULSE_FAL_RECONCILER_CRON_SECRET`
- `SHORTPULSE_FAL_RECONCILER_BATCH_SIZE`
- `SHORTPULSE_FAL_RECONCILER_MAX_ATTEMPTS`
- `SHORTPULSE_FAL_RECONCILER_MIN_AGE_SECONDS`
- `SHORTPULSE_FAL_CIRCUIT_BREAKER_ENABLED`
- `SHORTPULSE_FAL_CIRCUIT_BREAKER_THRESHOLD_15M`
- `SHORTPULSE_FAL_DIRECT_DEBIT_FALLBACK_ENABLED` (emergency only, default off)

## Hard gates (merge and rollout blockers)
1. Duplicate billing settlement by `provider_request_id` must remain zero.
2. Duplicate media persistence for same generation/output slot must remain zero.
3. Stuck-running beyond policy window must not regress.
4. Terminal-no-media unresolved backlog must stay below threshold.
5. Recovery success rate must stay above threshold.

## Deliverables checklist
- [x] ADR lock (`docs/adr/0020-ai-studio-server-authoritative-runtime-v2.md`)
- [x] Runtime flags module
- [x] Unified settlement API + status proxy integration
- [x] Webhook route added and signature-verified
- [x] Internal reconciler trigger route added and secret-guarded
- [x] Migration-019 fallback removal in runtime write paths
- [x] New convergence migrations (`020`-`023`)
- [ ] Client lifecycle side-effects removed from AI Studio hooks
- [ ] Seedream shadow parity report published
- [ ] Seedream canary gates passed for 72h
