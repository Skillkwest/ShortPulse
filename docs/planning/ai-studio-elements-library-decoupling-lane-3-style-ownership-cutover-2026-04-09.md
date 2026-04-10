# AI Studio Elements Library Decoupling Lane 3: Style Ownership And Adjacent Runtime Contract Cutover (2026-04-09)

Last updated: 2026-04-10  
Status: Completed  
Owner: Engineering  
Roadmap anchor: `docs/planning/ai-studio-elements-library-decoupling-roadmap-2026-04-09.md`  
Tracker anchor: `docs/planning/ai-studio-elements-library-decoupling-tracker-2026-04-09.md`

## Goal
Move live Elements rendering ownership out of Character stylesheets and resolve adjacent live runtime contracts that still borrow Character-owned CTA/avatar styling.

## Why This Lane Is Broader Than The Original Packet
The audit showed that “style ownership” is not complete if the Elements panel is clean but adjacent live Elements flows still use Character-owned contracts.

That means this lane must finish two things together:
1. the panel itself becomes Elements-owned for rendering and layout,
2. the remaining live CTA/avatar contracts used by Elements-adjacent surfaces are moved to intentional ownership.

## In Scope
1. Replace live panel rendering dependence on `character-manager-page--embedded` and Character descendant selectors.
2. Replace `.elements-manager-shell--character-clone` as a rendering-critical root scope.
3. Move panel layout, spacing, and breakpoint ownership into Elements stylesheets.
4. Re-home adjacent live CTA/avatar contracts used by Elements-related surfaces:
   1. `character-mode-create-btn`
   2. `character-mode-create-btn--inline`
   3. `character-mode-create-btn-icon`
   4. `.ai-character-list-avatar-image` where it is currently part of an accidental Character-shaped contract
5. Keep Character-only surfaces stable if a shared contract becomes intentionally generic.

## Out Of Scope
1. Historical docs cleanup.
2. Stale model retirement.
3. Character feature redesign.
4. Any rollout flag, feature toggle, canary gate, or temporary runtime switch.

## Required Dependency Inventory To Close
Before this lane exits, explicitly inventory and resolve remaining Elements dependence on:
1. `frontend/styles/character-manager.css`
2. `frontend/styles/character-manager-workspace.css`
3. `frontend/styles/character-manager-embedded.css`
4. `frontend/styles/elements-manager.css`
5. `frontend/styles/elements-manager-embedded.css`
6. `frontend/styles/ai-studio-properties.css`
7. `frontend/styles/globals.css`

Track three dependency classes:
1. remaining Character selectors
2. remaining Character custom properties
3. remaining import-order assumptions

## Primary File Targets
### Panel ownership
1. `frontend/features/elements-manager/components/ElementsManagerShell.tsx`
2. `frontend/features/elements-manager/components/ElementsManagerWorkflowTabs.tsx`
3. `frontend/styles/elements-manager.css`
4. `frontend/styles/elements-manager-embedded.css`
5. `frontend/styles/ai-studio-properties.css`
6. `frontend/styles/globals.css` only if import-order cleanup is necessary

### Adjacent live consumers
1. `frontend/features/ai-studio/components/ElementPickerModal.tsx`
2. `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`
3. `frontend/features/ai-studio/components/edit/ExpertEditCharacterPickerModal.tsx`
4. `frontend/styles/ai-studio-character-controls.css`

### Validation surfaces
1. `frontend/features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx`
2. `frontend/features/ai-studio/components/__tests__/VideoPropertiesPanel.test.tsx`
3. `frontend/features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx`

## Cutover Method
1. Promote Elements selectors from additive to authoritative for the panel.
2. Verify panel parity cluster by cluster:
   1. root shell and workflow chrome
   2. manage list
   3. profile sheet
   4. references grid
   5. loading/error states
3. Re-home adjacent CTA/avatar contracts to an intentional shared AI Studio contract or an Elements-owned contract.
4. Bring every consumer of the moved shared contract along in the same slice.
5. Remove Character rendering dependence only after parity is proven at the required breakpoints.

## Acceptance Criteria
1. Elements panel renders correctly through Elements-owned selectors and stylesheets.
2. `.elements-manager-shell--character-clone` is removed or no longer rendering-critical.
3. `character-manager-page--embedded` is removed from Elements or no longer required for correct Elements rendering.
4. Adjacent Elements-related surfaces no longer depend on Character-owned CTA/avatar rendering contracts by accident.
5. Character route and embedded Character panel remain unchanged.
6. Remaining Character selector/property dependence is empty or explicitly documented as intentional shared infrastructure.

## Validation
### Required
1. `cd frontend && npm run lint`
2. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx'`
3. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/VideoPropertiesPanel.test.tsx'`
4. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx'`

### Required if shared layout or host primitives move again
1. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/CharacterPanel.layout.test.tsx'`
2. `cd frontend && npx vitest run 'features/character-manager/components/__tests__/CharacterManagerShell.layout.test.tsx'`

### Manual parity checks
1. AI Studio `Libraries -> Elements` manage view
2. AI Studio `Libraries -> Elements` profile view
3. AI Studio entity picker modal for Elements
4. breakpoint matrix at `>=1101`, `1280..1101`, `<=1180`, `<=1100`, and `<=860`
5. AI Studio `Libraries -> Characters`
6. `/character`

## Rollback Posture
1. Restore Character-backed selectors for the affected cluster before undoing DOM changes.
2. If a shared CTA/avatar contract regresses consumers, restore the old shared contract and defer the re-home slice instead of layering ad hoc overrides.
3. Keep panel slices and adjacent consumer slices small enough to revert independently.
4. Do not preserve a long-lived toggle between Character-owned and Elements-owned style/runtime contracts.

## Exit Gate
Lane 3 is complete when:
1. the Elements panel no longer depends on Character rendering/style ownership,
2. adjacent live Elements consumers no longer depend on Character-owned CTA/avatar contracts by accident,
3. any remaining Character references are cleanup-only or intentionally shared infrastructure.
