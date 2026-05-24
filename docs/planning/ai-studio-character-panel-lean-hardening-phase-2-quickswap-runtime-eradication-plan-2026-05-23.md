---
title: AI Studio Character Panel Lean Hardening Phase 2 QuickSwap Runtime Eradication Plan
status: active
owner: Product + Engineering
created: 2026-05-23
last_updated: 2026-05-23
---

# Phase 2: QuickSwap Runtime Eradication

Purpose: remove QuickSwap from the live character-panel runtime without changing the current visible character-panel experience.

## Goal

Strip QuickSwap concepts out of active runtime code, dead UI modules, and live hook contracts so the character panel only models the real current workflow.

## Phase Scope

In scope:

1. Dead QuickSwap UI and hook removal.
2. Active-hook simplification.
3. QuickSwap type and drag contract removal from live panel paths.
4. Drop-controller simplification once QuickSwap targets are gone.

Out of scope:

1. SQL cleanup.
2. Historical migration retirement.
3. Top-workspace style conversion.

## Entry Gates

1. Phase 1 preserved-behavior contract is locked.
2. Ambiguous interactions, especially bottom-carriage click-to-assign, are classified for validation purposes.
3. Targeted tests for the live panel path are ready to run as cleanup lands.

## Workstreams

### Workstream 1: Remove Dead QuickSwap Files

Target strong dead-code candidates first:

1. `frontend/features/character-manager/components/CharacterQuickSwapDeckSection.tsx`
2. `frontend/features/character-manager/hooks/useCharacterQuickSwapDeck.ts`
3. `frontend/features/character-manager/hooks/useCharacterQuickSwapTipPreference.ts`
4. `frontend/features/character-manager/components/CharacterCreateWorkspaceLayout.tsx`

This slice should prefer the lowest-risk wins first:

1. files no longer imported by live runtime,
2. tests that only defend retired behavior,
3. references in indexes or dead-code allowlists.

### Workstream 2: Remove QuickSwap Contamination From Active Panel Runtime

Clean QuickSwap seams out of the active workspace path, including:

1. QuickSwap DnD item types.
2. `draggedQuickSwapItemId`.
3. Empty QuickSwap maps passed into active hooks.
4. Inert QuickSwap uploader stubs passed into drop controllers.

This is the highest-value runtime trim in the phase because it removes active complexity without changing the visible UI.

### Workstream 3: Simplify Active Hooks

Reduce the live hook contracts so they only represent current character-panel behavior:

1. `useCharacterManagerCharacterSheetInteractions.ts`
2. `useCharacterManagerDragInteractions.ts`
3. `useCharacterManagerDroppedReferenceController.ts`

Expected simplification themes:

1. fewer target types,
2. fewer compatibility maps,
3. fewer dead conditional branches,
4. clearer drag-state ownership,
5. more direct slot-assignment behavior.

### Workstream 4: Remove QuickSwap Concepts From Live Types

Prune QuickSwap-targeted types and helper branches from the active character-manager type surface once runtime call sites are gone.

## Recommended Order Inside The Phase

1. Remove dead modules that are clearly outside the live render path.
2. Remove active workspace stubs and fake QuickSwap seam-passing.
3. Simplify shared hooks and type surfaces.
4. Re-run tests and search for survivors before opening persistence cleanup.

## Primary Target Files

1. `frontend/features/character-manager/components/CharacterPanelWorkspace.tsx`
2. `frontend/features/character-manager/hooks/useCharacterManagerCharacterSheetInteractions.ts`
3. `frontend/features/character-manager/hooks/useCharacterManagerDragInteractions.ts`
4. `frontend/features/character-manager/hooks/useCharacterManagerDroppedReferenceController.ts`
5. `frontend/features/character-manager/types.ts`
6. `frontend/features/character-manager/components/CharacterQuickSwapDeckSection.tsx`
7. `frontend/features/character-manager/hooks/useCharacterQuickSwapDeck.ts`
8. `frontend/features/character-manager/hooks/useCharacterQuickSwapTipPreference.ts`
9. `frontend/features/character-manager/components/CharacterCreateWorkspaceLayout.tsx`

## Search Targets

Search for and classify survivors around:

1. `QuickSwap`
2. `DND_QUICK_SWAP_ITEM`
3. `draggedQuickSwapItemId`
4. `appendQuickSwapFiles`
5. `hasQuickSwapMediaFileId`
6. QuickSwap-targeted drop-controller branches

Current audit refresh confirms these are still active hotspots:

1. `CharacterPanelWorkspace.tsx` still defines `DND_QUICK_SWAP_ITEM`.
2. `useCharacterManagerDragInteractions.ts` still depends on `CharacterQuickSwapItem` and `setDraggedQuickSwapItemId`.
3. `useCharacterManagerDroppedReferenceController.ts` still exposes `handleQuickSwapReferenceDrop` and keeps `target: "quickswap"` in the pending-target model.

## Manual QA

1. Drag an image into each slot and confirm assignment still works.
2. Replace an occupied slot and confirm expected overwrite behavior.
3. Use the current upload bridge path and confirm files route to open slots correctly.
4. Reopen the panel and confirm assigned refs still render.

## Preserved Behavior Focus

The following behaviors are especially sensitive in this phase:

1. Drag/drop into character slots.
2. External upload-to-slot flow.
3. Internal reference/image drop ingestion.
4. Save and reopen behavior.
5. AI Studio generation injection.

## Acceptance Criteria

1. The live character-panel runtime no longer carries QuickSwap concepts.
2. The active workspace no longer passes fake QuickSwap seams into live hooks.
3. Dead QuickSwap UI/modules are removed or clearly isolated for later archival if deletion is not yet safe.
4. Drag/drop and upload behavior remain intact.

## Validation

1. Re-run targeted character-panel and character-mode tests.
2. Check for remaining QuickSwap references in active character-panel runtime paths.
3. Manually verify slot interaction behavior if the runtime seam changed materially.

## Phase Risks

1. Breaking slot assignment while simplifying shared drag/drop hooks.
2. Leaving hidden QuickSwap branches in active runtime code and thinking the cleanup is done.
3. Accidentally deleting behavior now owned by the bottom carriage replacement model.

## Stop Rule

Stop Phase 2 when QuickSwap is gone from the active runtime path even if persistence and docs still need later cleanup.
