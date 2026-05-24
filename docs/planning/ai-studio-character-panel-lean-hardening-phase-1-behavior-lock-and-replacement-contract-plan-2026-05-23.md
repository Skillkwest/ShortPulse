---
title: AI Studio Character Panel Lean Hardening Phase 1 Behavior Lock And Replacement Contract Plan
status: active
owner: Product + Engineering
created: 2026-05-23
last_updated: 2026-05-23
---

# Phase 1: Behavior Lock And Replacement Contract

Purpose: lock the real current character-panel behavior before destructive cleanup begins.

## Goal

Establish one explicit current-state contract for the live character panel so later trim phases preserve the right behavior and stop preserving obsolete QuickSwap-era assumptions.

## Phase Scope

In scope:

1. Current behavior inventory.
2. Regression coverage expansion where gaps still exist.
3. Replacement-surface contract lock.
4. Validation of the embedded media-library assignment boundary.

Out of scope:

1. QuickSwap deletion.
2. Persistence retirement.
3. Style conversion.

## Required Inputs

1. Current code in the active character-panel path.
2. Passing character-panel and AI Studio character-mode tests.
3. The audit findings captured in the master plan and readiness-state docs.

## Entry Gates

1. This phase starts from current code and passing tests, not old docs.
2. No runtime cleanup starts until this phase defines the contract it is protecting.
3. Any behavior that remains ambiguous must be called out explicitly instead of silently assumed.

## Workstreams

### Workstream 1: Lock The Preserved Behavior Contract

Define and confirm the real behavior that later phases must preserve:

1. Character create, save, select, delete.
2. Look add, rename, delete, select.
3. Per-look description persistence.
4. Three-slot reference assignment behavior.
5. Drag/drop into slots.
6. Upload-to-open-slot routing.
7. Save/reopen persistence.
8. AI Studio generation injection.

### Workstream 2: Lock The Replacement Surface Contract

Document the live surface model as:

1. Top character workspace.
2. Bottom carriage media library.

Explicitly record that QuickSwap is not part of the intended preserved UI contract.

### Workstream 3: Validate The Bottom-Surface Interaction Boundary

Determine whether embedded carriage click-to-assign is:

1. live behavior,
2. dead intended behavior, or
3. a current bug.

This affects later validation, not the phase sequence itself.

### Workstream 4: Build The Validation Baseline

Make sure the live panel has targeted regression coverage around:

1. workspace rendering,
2. split-host behavior,
3. upload bridge,
4. generation injection,
5. replacement-surface layout assumptions.

## Current Runtime Focus Areas

This phase should explicitly inspect and document the live contract around:

1. `CharacterPanel.tsx`
2. `CharacterPanelSplitHost.tsx`
3. `CharacterPanelWorkspace.tsx`
4. `useAiStudioCharacterPanelUploadBridge.ts`
5. `useAiStudioCharacterModeController.ts`
6. `characterModePayload.ts`

## Specific Questions To Answer

1. Which visible interactions are definitely live today?
2. Which historical interactions are only described in docs but no longer mounted?
3. Is bottom-carriage click-to-assign a live behavior, a dormant intended path, or a current bug?
4. Which tests already protect the live panel and which gaps still need coverage?

Current audit refresh status:

1. The host still does not pass `onSelectMedia` into the bottom carriage media library.
2. This means the click-to-assign question remains open and should stay in Phase 1 until explicitly resolved.

## Deliverables

1. Locked preserved-behavior checklist.
2. Locked replacement-surface description.
3. Known-risk note for any still-ambiguous interaction.
4. Targeted validation path for later phases.

## Primary Target Files

1. `frontend/features/ai-studio/components/CharacterPanel.tsx`
2. `frontend/features/character-manager/components/CharacterPanelSplitHost.tsx`
3. `frontend/features/character-manager/components/CharacterPanelWorkspace.tsx`
4. `frontend/features/character-manager/components/__tests__/CharacterPanelWorkspace.test.tsx`
5. `frontend/features/character-manager/components/__tests__/CharacterPanelSplitHost.test.tsx`
6. `frontend/features/ai-studio/components/__tests__/CharacterPanel.test.tsx`
7. `frontend/features/ai-studio/hooks/__tests__/useAiStudioCharacterModeController.test.ts`
8. `frontend/features/ai-studio/logic/__tests__/characterModePayload.test.ts`

## Manual QA Baseline

1. Open the character panel and confirm the top workspace and bottom carriage both mount as expected.
2. Open the character library and select a saved character.
3. Create a new character draft and confirm the expected unsaved workflow.
4. Add or switch a look and confirm the expected editing surface remains intact.
5. Confirm visible slot count and ordering remain `portrait`, `close_up`, `front_shot`.
6. Confirm the Save and Create actions still appear in the expected top workspace location.

## Acceptance Criteria

1. The preserved behavior list is explicit and implementation-ready.
2. The replacement surface is documented as workspace plus carriage media library.
3. QuickSwap is formally removed from the preserved-behavior definition.
4. Current click-to-assign status is classified and documented.
5. The baseline test path for later phases is defined.

## Validation

1. Run targeted character-panel and AI Studio character-mode tests.
2. Verify that current UI copy and visible layout still match the live contract.
3. Record any remaining behavioral uncertainty as a known gate rather than burying it in later phases.

## Phase Risks

1. Accidentally locking obsolete behavior from stale docs instead of the live product.
2. Misclassifying a broken or disconnected path as preserved behavior.
3. Starting cleanup before validation expectations are clear.

## Stop Rule

Stop Phase 1 when the preserved-behavior contract is explicit enough that later cleanup can be judged against it without ambiguity.
