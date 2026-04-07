# AI Studio Elements Library Component And State Map (2026-04-06)

Status: Ready to implement  
Owner: Frontend Engineering

## Purpose

Define the initial component graph and state ownership for the Elements library UI so implementation can proceed with minimal churn.

## Recommended File Layout

Feature root:
- `frontend/features/elements-manager/`

Recommended structure:
- `frontend/features/elements-manager/types.ts`
- `frontend/features/elements-manager/constants.ts`
- `frontend/features/elements-manager/components/ElementsManagerShell.tsx`
- `frontend/features/elements-manager/components/ElementsManagerWorkflowTabs.tsx`
- `frontend/features/elements-manager/components/ElementsLibraryList.tsx`
- `frontend/features/elements-manager/components/ElementsLibraryCard.tsx`
- `frontend/features/elements-manager/components/ElementProfileEditor.tsx`
- `frontend/features/elements-manager/components/ElementIdentityCard.tsx`
- `frontend/features/elements-manager/components/ElementTypeSelector.tsx`
- `frontend/features/elements-manager/components/ElementReferenceAssetsCard.tsx`
- `frontend/features/elements-manager/hooks/useElementsManagerViewState.ts`
- `frontend/features/elements-manager/hooks/useElementsManagerDraft.ts`

AI Studio host:
- `frontend/features/ai-studio/components/ElementsPanel.tsx`

Styles:
- `frontend/styles/elements-manager.css`
- `frontend/styles/elements-manager-embedded.css`

## Core Types

```ts
type ElementAssetType = "image" | "video";

type ElementLibraryItem = {
  id: string;
  name: string;
  alias: string;
  description: string;
  assetType: ElementAssetType;
  thumbnailUrl: string | null;
  imageReferenceUrls: string[];
  videoReferenceUrl: string | null;
  updatedAt: string | null;
  status?: "draft" | "ready";
};

type ElementsWorkflowTab = "manage" | "profile";
```

## Host-Level State

Owned by:
- `ElementsPanel.tsx`

State:
- `activeTab`
- optional host-level scroll-lock behavior

Responsibilities:
- mount the shared Elements shell
- integrate with AI Studio tool selection
- own any panel-only behavior

## Shell-Level State

Owned by:
- `ElementsManagerShell.tsx`

State:
- selected element id
- profile mode:
  - `create`
  - `edit`
- delete confirmation target
- loading state
- top-level error state

Responsibilities:
- switch between `Manage Elements` and `Element Profile`
- coordinate selection, creation, and deletion flows
- keep layout and state transitions deterministic

## Draft/Edit State

Owned by:
- `useElementsManagerDraft.ts`

State:
- current draft fields
- dirty state
- validation messages

Draft fields:
- `name`
- `alias`
- `description`
- `assetType`
- `imageReferenceUrls`
- `videoReferenceUrl`

Responsibilities:
- initialize draft from selected item or blank create state
- expose field setters
- validate before save
- support reset on delete or explicit cancel

## Component Responsibilities

### `ElementsManagerWorkflowTabs`

Inputs:
- `activeTab`
- `setActiveTab`
- `title`

Owns:
- embedded tab row only

### `ElementsLibraryList`

Inputs:
- element list
- selected element id
- loading flag
- create handler
- select handler
- delete handler

Owns:
- empty state rendering
- loading skeleton rendering
- card list/grid container

### `ElementsLibraryCard`

Inputs:
- item
- selected flag
- onSelect
- onDelete

Owns:
- thumbnail presentation
- name/subcopy
- selected visual state
- delete affordance

### `ElementProfileEditor`

Inputs:
- mode
- draft
- validation
- field handlers
- save handler
- delete handler

Owns:
- overall profile layout
- save/delete CTA row

### `ElementIdentityCard`

Inputs:
- `name`
- `alias`
- `description`
- change handlers

### `ElementTypeSelector`

Inputs:
- `assetType`
- change handler

### `ElementReferenceAssetsCard`

Inputs:
- `assetType`
- `imageReferenceUrls`
- `videoReferenceUrl`
- add/remove/change handlers

Owns:
- image-mode vs video-mode conditional rendering
- dropzone or upload-slot presentation

## State Transitions

### Create flow

1. user clicks `Create New Element`
2. shell sets:
   - `activeTab = "profile"`
   - `mode = "create"`
   - blank draft
3. user fills fields
4. save commits new element
5. shell selects created element and stays on profile

### Select flow

1. user clicks library card
2. shell sets selected element
3. shell switches to:
   - `activeTab = "profile"`
   - `mode = "edit"`
4. draft hydrates from selected element

### Delete flow

1. user clicks delete on card or profile
2. shell opens confirm state
3. confirmed delete removes item
4. shell clears selection
5. shell returns to `Manage Elements`

## Validation Rules

Required:
- `name`
- `assetType`

Conditional:
- image element requires at least 2 image references
- video element requires exactly 1 reference video

Soft guidance:
- alias recommended
- description recommended

Future provider-boundary validation:
- image reference lists should cap at 4 items
- image guidance should enforce JPG/PNG and surface `300x300` minimum plus `10MB` maximum in the UI copy once real intake validation is wired
- video guidance should enforce MP4/MOV and surface `50MB` maximum in the UI copy once real intake validation is wired
- provider-upload URLs should be treated as delivery artifacts, not canonical library identifiers

## Test Matrix

Layout:
- default tab is `Manage Elements`
- tabs render in deterministic order

Behavior:
- create flow
- select flow
- delete flow
- empty state
- loading state
- image-mode fields
- video-mode fields

Accessibility:
- tabs are keyboard accessible
- cards are keyboard selectable
- delete buttons are announced with target names
- upload zones have explicit labels
