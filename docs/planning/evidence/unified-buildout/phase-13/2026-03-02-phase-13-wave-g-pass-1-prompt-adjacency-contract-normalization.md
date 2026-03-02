# Phase 13 Wave G Pass 1: Prompt-Adjacency Contract Normalization

Date: 2026-03-02  
Status: Pass

## Scope
1. Normalize prompt-adjacent input resolution for chat-off Create submit paths.
2. Normalize agent-output generate request parsing through a shared seam instead of page-local branching.
3. Add focused regression locks for chat-mode adjacency and restore-hydration gating paths.

## Touched Surfaces
1. `frontend/features/ai-studio/logic/promptAdjacency.ts`
2. `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`
3. `frontend/pages/ai-studio.tsx`
4. `frontend/features/ai-studio/logic/__tests__/promptAdjacency.test.ts`
5. `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`

## Validation Commands
1. `cd frontend && npm run test -- features/ai-studio/logic/__tests__/promptAdjacency.test.ts features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`
2. `cd frontend && npm run test -- features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreHydration.test.ts`
3. `cd frontend && npm run type-check`
4. `cd frontend && npm run lint`

## Result Summary
1. Prompt-adjacency resolution now uses one shared logic seam (`promptAdjacency.ts`) for:
   - chat-off create prompt resolution (with explicit shared-prompt fallback policy),
   - agent-output generate request normalization (legacy string + structured request compatibility).
2. Focused regression packet is green:
   - `promptAdjacency` unit suite passed (`7` tests),
   - `useAiStudioGenerationController` suite passed (`21` tests),
   - `useAiStudioSessionRestoreHydration` suite passed (`3` tests),
   - local `type-check` and `lint` passed.

## Risks / Notes
1. No route/API envelope changes were made.
2. No SQL/migration changes were introduced.
3. Wave F staging admin-API observation remains deferred pending staging deployment parity.

## Rollback
1. Revert the prompt-adjacency seam and hook/page wiring in:
   - `promptAdjacency.ts`
   - `useAiStudioGenerationController.ts`
   - `pages/ai-studio.tsx`
2. Revert the new/updated regression tests if behavior rollback is required.
