# Phase 2 Evidence - Canonical Continuity Guard Validation

Date: 2026-03-20  
Phase: 2  
Status: Partial complete (local validation complete; preview/production packet pending)

## Objective
Validate that canonical continuity state is not polluted by refusal or fallback lanes and is only committed on successful prompt outputs.

## Code Contract Verified
Canonical commit guard is implemented in:
1. `frontend/features/agent-runtime/studioAgentCoordinator.ts`
   - canonical write path executes only when `!finalRefusal` in `finalizeSuccessfulTurn`.
   - refusal paths preserve `effectiveCanonical`.
2. `frontend/features/agent-runtime/studioAgentCanonicalPersistence.ts`
   - write is skipped when canonical is null/empty or persistence is disabled.

## Validation Commands
1. `npm -C frontend run test -- tests/api/studio-agent.runtime.test.ts`
2. `npm -C frontend run type-check`

## Key Local Assertions Covered
From `tests/api/studio-agent.runtime.test.ts`:
1. Refusal path preserves canonical prompt:
   - `does not synthesize applyPrompt on refusal and preserves canonical prompt`
   - `keeps single-stage semantic refusal actionless and preserves canonical prompt`
2. Infra fallback remains assistant fallback lane:
   - `maps transient upstream failures to assistant fallback when chat fallback is disabled`
   - `maps transient v2 upstream failures to assistant fallback`
3. Non-refusal success paths preserve prompt-only contract and canonical continuity:
   - `keeps prompt-only response parity between single-stage and legacy fallback`

## Result
1. Local continuity regression suite passed.
2. No local evidence of fallback/refusal canonical pollution in covered paths.

## Remaining Runtime-Truth Gap
1. Preview and production runtime truth capture for continuity invariants is pending.
2. A follow-up packet must include environment snapshots and trace excerpts for those environments.
