# Character Panel Media Assignment Onboarding Audit

Date: 2026-05-18

Purpose: onboard the AI Studio character-panel media assignment workflow into Holomony's retained surface inventory as a separate candidate surface.

## Decision

Do not treat the character panel as part of the existing media-panel KPI family.

Treat it as a separate candidate surface with this stable id:

- `character-panel-media-assignment`

Reason:

- the embedded browse panel is shared with `elements-media-panel`
- the selection, copy, persistence, and restore authority are character-owned
- the persistence boundary is `character_media_assets`, not the media-library panel contract

## System Boundary

- system row: `ai-studio-characters-workflow`
- host surface:
  - `frontend/features/ai-studio/components/CharacterPanel.tsx`
- split-host seam:
  - `frontend/features/character-manager/components/CharacterPanelSplitHost.tsx`
- character-owned workspace:
  - `frontend/features/character-manager/components/CharacterPanelWorkspace.tsx`

Shared browse/runtime dependency:

- `frontend/features/ai-studio/components/ElementsEmbeddedMediaLibraryPanel.tsx`
- `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`
- `frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts`

Character-owned authority and persistence dependency:

- `frontend/features/character-manager/hooks/useCharacterManagerDroppedReferenceController.ts`
- `frontend/features/character-manager/hooks/useCharacterCardPreviewUrls.ts`
- `frontend/features/character-manager/logic/characterManagerPersistenceCore.ts`
- `frontend/features/character-manager/logic/characterQuickSwapPersistence.ts`

## Why This Is Separate

The bottom pane is the shared embedded panel in assignment mode, but it does not own the final save contract.

- `CharacterPanelSplitHost` mounts `ElementsEmbeddedMediaLibraryPanel` with `mediaCardInteractionMode="assignment"`.
- `CharacterPanelWorkspace` receives the selection payload, fetches the selected URL, converts it into a `File`, and then saves it through character-owned paths.
- character uploads and copied internal references persist to `character_media_assets`.

This is a different workflow and failure boundary from:

- `ai-studio-panel`
- `elements-media-panel`

## Current Measurement Path

Usable now:

- focused code/runtime audit through the files above
- targeted tests:
  - `frontend/features/ai-studio/components/__tests__/CharacterPanel.test.tsx`
  - `frontend/features/character-manager/components/__tests__/CharacterPanelSplitHost.test.tsx`
  - `frontend/features/character-manager/components/__tests__/CharacterPanelWorkspace.test.tsx`
- focused browser audit path:
  1. open AI Studio Character panel
  2. arm a character-sheet slot
  3. select image media from the embedded panel
  4. verify assignment succeeds
  5. verify the saved character restores the assignment correctly on reopen

Not available yet:

- no first-class Holomony KPI packet for this surface
- no dedicated direct automation for selection/drop-to-saved-character latency or failure rate

## Correctness Gates

This surface should not be promoted beyond candidate status unless it proves:

- assigned media is copied into character-owned storage rather than attached as shared media-library ownership
- only valid image media can be assigned to character-sheet reference slots
- slot-full behavior fails clearly without silent mutation
- wrong-asset assignment does not occur
- save/reopen preserves the assigned character media
- `character_media_assets` isolation remains intact

## Explicit Out Of Scope

This onboarding does not change or reopen:

- the panel KPI family for `ai-studio-panel`
- the panel KPI family for `elements-media-panel`
- `/character` route optimization as a first-class Holomony surface
- Reference Grid or Quick Slot Inventory onboarding

## Baseline Note

Current baseline state:

- surface is user-approved for onboarding
- surface boundary is now explicit
- owner files are identified
- measurement path is partial but real
- retained onboarding evidence now exists

Current status:

- `candidate-onboarded`

Next highest-ROI need:

- add a direct audit path for:
  - selection/drop to saved-character latency
  - selection/drop failure rate
  - save/reopen trust on the character panel workflow
