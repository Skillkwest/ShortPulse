# Phase 06 Slice B Evidence: Character Mode Stale Bundle Guard (2026-02-27)

## Scope
Hardened Character Mode submit-time bundle refresh so stale/deleted character context cannot be injected.

## Code Changes
1. `frontend/features/ai-studio/hooks/useAiStudioCharacterModeController.ts`
- added explicit unavailable-character error classification,
- fail-closed behavior: clears bundle and returns `null` when selected character is unavailable or snapshot id mismatches selected character,
- preserves continuity fallback for transient refresh failures only.

## Tests Added/Updated
1. `frontend/features/ai-studio/hooks/__tests__/useAiStudioCharacterModeController.test.ts`
- added coverage for:
  - unavailable selected character (`Character is no longer available.`) -> no stale bundle reuse,
  - mismatched refreshed snapshot id -> no stale bundle reuse.

## Validation Runs
1. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioCharacterModeController.test.ts`
2. `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioCharacterModeLifecycle.test.ts features/ai-studio/hooks/__tests__/useAiStudioCharacterModeController.test.ts features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx features/character-manager/logic/__tests__/characterLibraryWindow.test.ts lib/__tests__/mediaSignedUrlCache.test.ts`
3. `npm -C frontend run lint`
4. `npm -C frontend run type-check`
5. `npm -C frontend run build`
6. `npm -C frontend run docs:check`

All commands passed.

## Rollback Notes
1. Revert this slice commit to restore previous refresh fallback behavior that could reuse stale cached bundle on unavailable character errors.
2. No schema migrations were introduced in this slice.
