# Phase 13 Wave C Pass 4 Evidence (Control Enablement)

Date: 2026-03-02  
Owner: Engineering  
Status: Pass (Control implementation) / Pending (Observation windows)

## Scope
Implement controlled webhook canary gating without expanding route/API surface:
1. Scope webhook callback registration by user/model cohort allowlists.
2. Keep polling/reconciler active as safety path for all non-canary traffic.
3. Keep `/api/fal/webhook` as the only webhook ingress route.

## Touched Surfaces
1. Runtime flags and parser:
   - `frontend/lib/server/api/falRuntimeFlags.ts`
2. Webhook callback targeting:
   - `frontend/lib/server/api/falSubmitTargeting.ts`
3. Submit/queue wiring:
   - `frontend/lib/server/api/falSubmitProxy.ts`
   - `frontend/lib/server/api/generationQueue/dispatch.ts`
4. Operational docs:
   - `docs/sops/sop_provider_incident_response.md`

## Validation Commands
1. `npm -C frontend run test -- lib/server/api/__tests__/falRuntimeFlags.test.ts lib/server/api/__tests__/falSubmitTargeting.test.ts tests/api/fal-webhook-signature.test.ts lib/server/api/__tests__/generationQueue.dispatch.test.ts lib/server/api/__tests__/generationQueue.dispatch.integrity.test.ts`
2. `npm -C frontend run test:phase11:fal-regression`
3. `npm -C frontend run validate:phase11:fal-regression`

## Key Results
1. New canary targeting tests pass:
   - empty allowlist => callback registration allowed (full cohort behavior),
   - configured allowlist + out-of-cohort => callback registration blocked,
   - wildcard/prefix allowlist matching supported.
2. Existing queue dispatch integrity/no-capacity tests remain green.
3. Full Phase-11 Fal regression validation bundle remains green (`test`, `type-check`, `lint`, `docs:check`, `build`).

## Gate Assessment
1. Pass 4 control objective: met.
   - canary scoping is now enforceable through env allowlists only.
   - no new route surface or client contract changes were introduced.
2. Pass 4 rollout objective: pending.
   - two canary observation windows are still required before closeout.

## Rollback Readiness
1. Disable canary scoping: clear `SHORTPULSE_FAL_WEBHOOK_CANARY_USER_ALLOWLIST` and `SHORTPULSE_FAL_WEBHOOK_CANARY_MODEL_ALLOWLIST`.
2. Disable webhook path entirely: set `SHORTPULSE_FAL_WEBHOOK_ENABLED=false`.
3. Keep polling/reconciler path active during any rollback transition.

## Pending Operational Evidence
1. Window 1 + Window 2 SQL metrics packet capture:
   - duplicate settlement count = `0`
   - duplicate media persistence count = `0`
   - no queue/recovery regression vs baseline thresholds.
2. Promote/hold/rollback decision entry after second window.
