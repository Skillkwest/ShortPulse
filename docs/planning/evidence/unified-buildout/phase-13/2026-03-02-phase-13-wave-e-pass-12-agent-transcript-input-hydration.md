# Phase 13 Wave E Pass 12: Agent Transcript/Input Hydration (Gated)

Date: 2026-03-02  
Owner: Engineering  
Status: Pass

## Scope
1. Extended session hydration normalizer to include an `agent` payload section:
   - transcript message normalization with guaranteed IDs,
   - input restoration,
   - prompt-origin/chat-mode normalization.
2. Added a `replaceMessages` seam to `useAiAgent` for explicit transcript restore without page-level state mutation hacks.
3. Added `useAiStudioAgentBridge` hydration seam (`hydrateFromSessionAgentSnapshot`) so page orchestration remains thin.
4. Extracted restore-candidate logging + hydration-apply effects into a dedicated hook (`useAiStudioSessionRestoreHydration`) to keep `pages/ai-studio.tsx` within size-budget policy.
5. Updated gated hydration apply to restore workspace/output + agent transcript/input in one one-shot flow per `sid`.

## Touched Surfaces
1. `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
2. `frontend/features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts`
3. `frontend/features/ai-agent/useAiAgent.ts`
4. `frontend/features/ai-agent/__tests__/useAiAgent.test.ts`
5. `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts`
6. `frontend/features/ai-studio/hooks/useAiStudioState.ts`
7. `frontend/features/ai-studio/hooks/useAiStudioSessionRestoreHydration.ts`
8. `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreHydration.test.ts`
9. `frontend/pages/ai-studio.tsx`

## Validation Commands
1. `npm -C frontend run test -- --run features/ai-agent/__tests__/useAiAgent.test.ts features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts features/ai-studio/logic/__tests__/sessionRestoreCandidate.test.ts features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreCandidate.test.ts`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run build`
5. `npm -C frontend run check:architecture-boundary`
6. `npm -C frontend run check:size-budget`

## Result
1. Targeted restore/agent tests passed.
2. Type-check, lint, and build passed.
3. Architecture-boundary checks passed.
4. Size-budget check passed after restore-effect extraction from `pages/ai-studio.tsx`.
5. Restore behavior remains fail-closed by default:
   - candidate load flag and apply flag are still independently gated,
   - hydration apply remains one-shot per `sid`.

## Risk Notes
1. Hydration now mutates agent transcript/input when apply is enabled; no server/API contract changed.
2. Unsupported/malformed snapshot message rows are dropped, and duplicate/missing IDs are normalized to avoid UI-action regressions on restored bubbles.
3. Restore still excludes ephemeral attachment tray state by design.
4. `check:size-budget` still reports existing warn-lane debt for `frontend/features/ai-studio/hooks/useAiStudioState.ts` (`781 > 650`); command passes in warn mode, but this remains queued modularization debt.

## Rollback Readiness
1. Immediate behavior rollback: `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED=false`.
2. Revert this pass commit if broader rollback is required.
