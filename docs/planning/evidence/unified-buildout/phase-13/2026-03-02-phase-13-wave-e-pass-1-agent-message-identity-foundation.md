# Phase 13 Wave E Pass 1: Agent Message Identity Foundation

Date: 2026-03-02  
Status: Pass (engineering slice)

## Scope
1. Guarantee runtime IDs for hook-generated user and assistant agent messages.
2. Add targeted message update seam (`updateMessageById`) for future inline-edit/linking features.
3. Keep API payload contracts unchanged (message IDs remain client-side only).

## Touched Surfaces
1. `frontend/features/ai-agent/useAiAgent.ts`
2. `frontend/features/ai-agent/client/messageStore.ts`
3. `frontend/features/ai-agent/client/__tests__/messageStore.test.ts`
4. `frontend/features/ai-agent/__tests__/useAiAgent.test.ts`

## Validation Commands
1. `npm -C frontend run test -- --run features/ai-agent/client/__tests__/messageStore.test.ts features/ai-agent/__tests__/useAiAgent.test.ts prefabs/agent/panels/__tests__/AgentChatPanel.actions.test.tsx`
2. `npm -C frontend run type-check`

## Key Outcomes
1. Hook-generated user messages now use `agent-user-*` IDs consistently.
2. Hook-generated assistant messages now use `agent-assistant-*` IDs consistently.
3. `updateMessageById` updates only the targeted message and no-ops when ID is missing.
4. Existing prefab action behavior remains unchanged (generate/click actions still pass).

## Risk Notes
1. Structured generate callback payload and bubble-media linking are not in this pass.
2. Session transcript persistence/restore integration is not in this pass.

## Rollback Path
1. Revert message-store and `useAiAgent` identity/update helper changes as one slice.
2. Keep legacy ID-optional behavior (fallback keying remains in prefab panel).
