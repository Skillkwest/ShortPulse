---
title: AI Studio Character Panel Lean Hardening Phase 4 Top Workspace Inline Style Conversion Plan
status: active
owner: Product + Engineering
created: 2026-05-23
last_updated: 2026-05-23
---

# Phase 4: Top Workspace Inline Style Conversion

Purpose: remove stylesheet, CSS-variable, and styling-linkage dependency from the top character workspace while leaving the bottom carriage media library alone.

## Goal

Make the top character workspace fully raw inline-styled without changing the rendered UI or user interaction behavior.

This phase is not just stylesheet removal. It is a visual-contract reconstruction phase. The team must discover the real current styles from the live rendered workspace and recreate them raw inline.

## Scope Boundary

In scope:

1. Top workspace styling ownership.
2. Top-workspace wrapper/layout styling.
3. Top-workspace child component styling.
4. Top-workspace state-driven visuals.
5. Replacement of class-selector styling hooks used only by the top workspace.
6. Character-library modal and confirmation-dialog styling launched from the top workspace.

Out of scope:

1. Bottom carriage media library styling.
2. Shared media-library stylesheet cleanup.
3. Any product-surface redesign.

## What Must Be Removed

1. Top-workspace dependency on character-specific stylesheets.
2. Top-workspace dependency on CSS custom properties.
3. Top-workspace dependency on class-based visual state selectors.
4. Top-workspace runtime reliance on class-selector DOM queries for styling purposes.

## Raw Style Reconstruction Contract

Before stylesheet-backed top-workspace styles are removed, the live visual truth must be captured and rebuilt inline.

That capture must include:

1. actual colors used by text, borders, backgrounds, icons, badges, and empty states,
2. actual typography values, including font family, size, weight, line height, and label hierarchy,
3. actual spacing values, including padding, gap, margin, and section sizing,
4. actual radii, outlines, and shadow treatment,
5. actual state visuals for hover, focus, active, dragging, drop-active, success, disabled, and loading states,
6. actual responsive behavior for the top workspace at real panel widths,
7. actual modal and picker-shell treatment used by the character library and confirmation flows.

## Live Style Discovery Method

The baseline for this phase should come from the live rendered surface, not just stylesheet source.

Recommended discovery sources:

1. rendered DOM inspection of the live character panel,
2. computed-style capture for critical surfaces and states,
3. screenshots or visual captures at the panel widths the surface actually uses,
4. code-level verification of where class names and inline styles are currently mixed,
5. stylesheet reads only as supporting traceability, not as the primary source of truth.

## Entry Gates

1. Runtime behavior is stable enough that style work will not mask logic churn.
2. The top-workspace-only scope boundary is explicitly respected.
3. Bottom carriage media-library styling remains excluded from this lane.
4. A live visual baseline exists for the top workspace and is detailed enough to rebuild styles raw.

## Workstreams

### Workstream 0: Capture The Live Visual Truth

Create a style baseline for the top workspace from the actual rendered panel before removing stylesheet dependence.

This baseline should inventory:

1. colors,
2. fonts and typography,
3. spacing and layout sizing,
4. borders, radii, and shadows,
5. all meaningful interactive and loading states,
6. responsive behavior at the widths the panel actually uses,
7. modal, picker, close-button, and confirmation-dialog presentation launched from the top surface.

The goal is not to preserve CSS selectors. The goal is to preserve the visual result those selectors currently produce.

### Workstream 1: Inline The Top Workspace Shell

Move active top-workspace layout and visual rules into inline ownership for:

1. `CharacterPanelWorkspace.tsx`
2. Top workspace container portions of `CharacterPanelSplitHost.tsx`
3. Any top-only wrapper rules currently coming from embedded panel CSS

Expected outcomes:

1. top-level workspace sizing and spacing are inline-owned,
2. top workspace section chrome is inline-owned,
3. top workspace state visuals no longer depend on embedded character stylesheets.

### Workstream 2: Inline Top Child Components

Convert the remaining top-workspace child surfaces away from stylesheet dependency:

1. `CharacterDescriptionEditorCard.tsx`
2. `EmbeddedCharacterLooksControl.tsx`
3. `CharacterProfileLoadingSkeleton.tsx`

This work should also remove residual class-name-only styling hooks in those components where possible.

### Workstream 2B: Inline Character-Owned Modal And Picker Surfaces

Bring the character-owned modal and picker flows into raw ownership for this top-surface path.

This includes:

1. character library modal shell and header actions,
2. saved-character picker cards and feedback states,
3. close-button and ghost-button treatment used inside this flow,
4. confirmation dialogs used for character and look deletion.

If shared primitives are too broad to convert globally without collateral churn, create character-owned raw wrappers or character-owned inline variants that preserve the current top-surface UI exactly.

### Workstream 3: Remove Weird Variables And Styling Linkages

Eliminate:

1. `var(...)` usage in top-workspace-owned surfaces.
2. Shared character CSS token dependency for top-workspace visuals.
3. Class-based hover, focus, empty, filled, dragging, and drop-active styling in the top workspace.

This is where "raw" ownership becomes real. If a visual state still depends on stylesheet selectors or shared CSS tokens, the phase is not done.

### Workstream 4: Replace Style-Contract Tests

Replace top-workspace stylesheet-text assertions with component-level render or behavior assertions where needed.

### Workstream 5: Replace Runtime Class Hooks

Refactor active drag styling hooks that currently depend on class-selector queries so they use inline-safe refs or direct handles instead.

## Recommended Order Inside The Phase

1. Capture the live visual baseline.
2. Inventory top-workspace stylesheet dependencies.
3. Inline top shell and wrapper styles from the captured visual truth.
4. Inline child component styles from the captured visual truth.
5. Inline character-owned modal and picker surfaces from the captured visual truth.
6. Replace runtime class hooks.
7. Remove no-longer-needed stylesheet dependencies and update tests last.

## Primary Target Files

1. `frontend/features/character-manager/components/CharacterPanelWorkspace.tsx`
2. `frontend/features/character-manager/components/CharacterDescriptionEditorCard.tsx`
3. `frontend/features/character-manager/components/EmbeddedCharacterLooksControl.tsx`
4. `frontend/features/character-manager/components/CharacterProfileLoadingSkeleton.tsx`
5. `frontend/features/character-manager/components/CharacterPanelSplitHost.tsx`
6. `frontend/features/character-manager/hooks/useCharacterManagerDragInteractions.ts`
7. `frontend/features/ai-studio/components/picker/AiStudioPickerPrimitives.tsx`
8. `frontend/components/ConfirmationModal.tsx`
9. `frontend/features/ai-studio/logic/__tests__/characterPanelLayoutContract.test.ts`
10. `frontend/styles/character-manager.css`
11. `frontend/styles/character-manager-embedded.css`
12. `frontend/styles/character-manager-workspace.css`
13. `frontend/styles/ai-studio-properties.css`
14. `frontend/styles/ai-studio-character-controls.css`
15. `frontend/styles/ai-studio-model-picker.css`
16. `frontend/styles/ui-patterns.css`

## Top-Workspace Style Inventory Themes

Expect to remove or replace dependencies in these categories:

1. wrapper and split-host layout rules,
2. action-button visuals,
3. description card typography and spacing,
4. looks-control presentation,
5. reference-slot empty, filled, active, and drop states,
6. loading skeleton visuals,
7. drag ghost and dragging state visuals.

Expect to capture and restate real values in these categories:

1. top-row button colors, shadows, and radii,
2. field label and input typography,
3. description card shell and textarea presentation,
4. looks-control text hierarchy and chip/button treatment,
5. reference-slot card shell, placeholder treatment, and destructive-action styling,
6. success-badge visual treatment,
7. loading-state line, avatar, and card styling,
8. character-library modal shell, picker-card, and close-action styling,
9. confirmation-dialog shell and action styling.

Current audit refresh confirms these specific hotspots:

1. `CharacterDescriptionEditorCard.tsx` is partially inline but still carries class-based linkage.
2. `CharacterProfileLoadingSkeleton.tsx` is still predominantly class-driven.
3. `useCharacterManagerDragInteractions.ts` still uses class selectors and `classList` mutation for drag visuals.
4. `EmbeddedCharacterLooksControl.tsx` still uses `var(--color-bg, #0f1115)`.
5. `CharacterPanelWorkspace.tsx` still mounts character-library modal flows through shared picker primitives and shared modal button classes.
6. `ConfirmationModal.tsx` is still fully class-driven.

## Manual QA

1. Compare the top workspace visually before and after at common desktop widths.
2. Repeat that check at narrow widths where the panel still needs to read cleanly.
3. Verify buttons, labels, cards, fields, and slot states still look identical in color, typography, spacing, and shape.
4. Verify hover, focus, drag, drop, loading, empty, filled, disabled, and success states still communicate clearly.
5. Open the character library modal and verify modal shell, picker cards, delete affordances, and close actions still look identical.
6. Open the delete confirmations and verify copy, shell, and action styling still match the live baseline.
7. Confirm the bottom carriage media library has not visually changed.

## Acceptance Criteria

1. The top workspace no longer depends on character-specific stylesheets for its owned visual contract.
2. The top workspace no longer depends on CSS variables for its owned visual contract.
3. The rendered top workspace remains visually identical in structure, typography, color, spacing, and state behavior.
4. The bottom carriage media library remains untouched by this phase.
5. The raw inline styles are derived from the actual live rendered style baseline, not merely copied from stylesheet naming conventions.
6. Character-library modal and confirmation-dialog surfaces launched from the top workflow are also raw-owned or raw-wrapped without stylesheet-driven presentation.

## Validation

1. Re-run targeted character-panel tests.
2. Verify the top workspace still renders correctly at common desktop and mobile widths.
3. Verify button, slot, loading, focus, drag, drop, disabled, and success states still read correctly.
4. Verify character-library modal and confirmation-dialog visuals still match the live baseline.
5. Confirm no style-cleanup changes spill into the bottom carriage media library.

## Phase Risks

1. Accidentally changing the visual contract while trying to simplify styling.
2. Discovering late that runtime drag behavior still depends on removed class names.
3. Pulling shared bottom-carriage styling into scope by accident.

## Stop Rule

Stop Phase 4 when the top workspace is fully inline-owned even if shared bottom-carriage styling remains stylesheet-backed.
