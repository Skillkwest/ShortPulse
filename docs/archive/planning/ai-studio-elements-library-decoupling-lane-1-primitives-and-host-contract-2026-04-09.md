# AI Studio Elements Library Decoupling Lane 1: Primitives And Host Contract (2026-04-09)

Last updated: 2026-04-10  
Status: Completed  
Owner: Engineering  
Roadmap anchor: `docs/archive/planning/ai-studio-elements-library-decoupling-roadmap-2026-04-09.md`  
Tracker anchor: `docs/archive/planning/ai-studio-elements-library-decoupling-tracker-2026-04-09.md`

> Archived on 2026-04-26 during the docs-cleanup wave. This lane is completed and no longer belongs in active planning.

## Goal
Remove direct Character UI imports from the Elements shell and establish an explicit Elements AI Studio host contract without changing the rendered Elements experience.

## Why This Lane Is First
The safest real coupling reduction is:
1. stop importing Character UI components directly,
2. stop relying on Character-only host flex/min-height coverage,
3. keep the fragile Character selector surface intact until later lanes.

This lane is intentionally not a class-renaming lane.

## Required Constraint
This lane does not count as complete if it only adds thin pass-through wrappers around Character components. Acceptable outcomes are:
1. Elements-owned markup that preserves current behavior, or
2. a neutral shared primitive extracted from Character with Character behavior preserved.

Hidden re-export indirection is not sufficient.

## In Scope
1. Introduce an Elements-owned workspace/layout implementation or a neutral shared layout primitive.
2. Introduce an Elements-owned description editor implementation or a neutral shared primitive.
3. Update `ElementsManagerShell` to consume the new Elements-owned or neutral-shared implementation.
4. Make the Elements host contract explicit in AI Studio:
   1. `frontend/features/ai-studio/components/ElementsPanel.tsx`
   2. `frontend/features/ai-studio/hooks/useElementsPanelPropertiesScrollLock.ts`
   3. `frontend/styles/ai-studio-properties.css`
5. Preserve current DOM order and current visible layout.

## Out Of Scope
1. Removing `character-manager-page--embedded`.
2. Removing Character selectors from the Elements panel.
3. Adjacent picker/avatar/CTA contract work.
4. Stale model cleanup such as `deckReferenceUrls`.
5. Any rollout flag, feature toggle, canary gate, or temporary runtime switch.

## Required File Inventory
### Primary targets
1. `frontend/features/elements-manager/components/ElementsManagerShell.tsx`
2. new Elements-owned component files under `frontend/features/elements-manager/components/`
3. `frontend/features/ai-studio/components/ElementsPanel.tsx`
4. `frontend/features/ai-studio/hooks/useElementsPanelPropertiesScrollLock.ts`
5. `frontend/styles/ai-studio-properties.css`

### Possible shared extraction targets
1. `frontend/features/character-manager/components/CharacterCreateWorkspaceLayout.tsx`
2. `frontend/features/character-manager/components/CharacterCreateWorkspaceSurface.tsx`
3. `frontend/features/character-manager/components/CharacterDescriptionEditorCard.tsx`

### Character parity references
1. `frontend/features/ai-studio/hooks/useCharacterPanelPropertiesScrollLock.ts`
2. `frontend/features/ai-studio/components/__tests__/CharacterPanel.layout.test.tsx`
3. `frontend/features/character-manager/components/__tests__/CharacterManagerShell.layout.test.tsx`

## Host Contract Requirements
Lane 1 must leave behind an explicit Elements host contract for AI Studio:
1. `elements-panel-root` or equivalent Elements panel wrapper has explicit flex/min-height coverage.
2. Manage/profile transitions still apply and restore rail scroll-lock correctly.
3. Character host behavior remains unchanged.
4. The Elements host contract survives future removal of `character-manager-page--embedded`.

## Acceptance Criteria
1. `ElementsManagerShell` no longer imports Character UI components directly.
2. Elements-owned or neutral shared primitives own the implementation behind the imported surface.
3. Elements UI remains materially unchanged in manage and profile views.
4. `frontend/styles/ai-studio-properties.css` contains an explicit Elements host contract where needed.
5. `useElementsPanelPropertiesScrollLock` remains behaviorally aligned with the Character panel hook.

## Validation
### Required
1. `cd frontend && npm run lint`
2. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx'`

### Required if a shared primitive moves
1. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/CharacterPanel.layout.test.tsx'`
2. `cd frontend && npx vitest run 'features/character-manager/components/__tests__/CharacterManagerShell.layout.test.tsx'`

### Manual checks
1. AI Studio `Libraries -> Elements` manage view
2. AI Studio `Libraries -> Elements` profile view
3. manage/profile transition scroll-lock behavior
4. AI Studio `Libraries -> Characters`
5. `/character`

## Rollback Posture
1. Revert the Elements-owned primitive or wrapper implementation independently from later DOM/CSS work.
2. Revert Elements host CSS and host hook updates independently if sizing/scroll behavior drifts.
3. Do not carry a half-finished shared primitive extraction into Lane 2.
4. Use direct cutovers only; do not keep a fallback toggle between Character and Elements implementations.

## Exit Gate
Lane 1 is complete when:
1. direct Character UI imports are gone from `ElementsManagerShell`,
2. Elements host sizing and scroll behavior are explicit and parity-validated,
3. no DOM/class cutover has started yet.
