# Phase 13 Wave E Pass 5: Chat Mode Toggle + Raw Submit Routing

Date: 2026-03-02  
Owner: Engineering  
Status: Pass

## Scope
1. Renamed the user-facing toggle concept to `Chat Mode` with default ON behavior.
2. Added local chat-mode preference persistence with legacy raw-mode fallback compatibility.
3. Added right-of-composer Chat Mode toggle UI using the same toggle classes as Character Mode.
4. Enforced behavior split:
   - Chat Mode ON: normal agent send/respond path.
   - Chat Mode OFF: send affordances disabled; primary Create/Text submit uses raw prompt generation path.
5. Added focused tests for toggle behavior and generation routing.

## Touched Surfaces
1. Preference seam:
   - `frontend/features/ai-studio/logic/chatModePreference.ts`
   - `frontend/features/ai-studio/logic/__tests__/chatModePreference.test.ts`
2. Bridge + generation routing:
   - `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`
   - `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`
3. Prop-threading + chat composer UI:
   - `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioCreatePanelProps.ts`
   - `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`
   - `frontend/features/ai-studio/components/PromptStep.tsx`
   - `frontend/features/ai-studio/components/promptStep/types.ts`
   - `frontend/features/ai-studio/components/promptStep/PromptStepChatSurface.tsx`
   - `frontend/features/ai-studio/components/__tests__/PromptStep.actions.test.tsx`
4. Page wiring:
   - `frontend/pages/ai-studio.tsx`
5. Styling:
   - `frontend/styles/prefabs-agent.css`

## Validation Commands
1. `npm -C frontend run test -- --run features/ai-studio/components/__tests__/PromptStep.actions.test.tsx features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts features/ai-studio/logic/__tests__/chatModePreference.test.ts`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run test:adaptive-v2-gate`
5. `npm -C frontend run check:architecture-boundary`
6. `npm -C frontend run check:size-budget`

## Validation Summary
1. Targeted Chat Mode tests passed.
2. `type-check` and `lint` passed.
3. Adaptive gate remains green.
4. Architecture boundary checks passed.
5. Size-budget checks passed with existing warn-lane unchanged (`useAiStudioState.ts` remains over warn target; no new overages from this pass).

## Risk Notes
1. Chat mode preference is local-only and does not alter server/API contracts.
2. Raw-submit path is limited to Create/Text primary submit in text mode and reuses existing generation controller guards/credit checks.
3. Toggle styling reuses existing `audio-toggle character-mode-toggle` classes to avoid new style-system drift.

## Rollback Readiness
1. Revert this pass to restore always-agent submit behavior in Create/Text text mode.
2. Remove Chat Mode UI by reverting prompt/chat prop threading and composer toggle markup.
3. No SQL rollback required (no migration changes).
