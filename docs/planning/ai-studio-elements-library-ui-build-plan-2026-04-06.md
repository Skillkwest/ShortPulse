---
title: AI Studio Elements Library UI Build Plan
status: Superseded historical reference
owner: Product + Frontend Engineering
created: 2026-04-06
last_updated: 2026-04-10
---

# AI Studio Elements Library UI Build Plan

> Historical note: superseded by the Elements decoupling packet dated 2026-04-09. Keep this document only as an early design/build reference for how the first Elements surface was originally framed before the feature was decoupled from Character.

Purpose: define the concrete UI/UX build contract for adding an `Elements` library to the AI Studio left rail, using the Character Library as the primary shell reference while staying compatible with future Kling 3.0 element wiring.

## Scope Lock

In scope:
- Add `Elements` as a first-class entry in the AI Studio left-rail `Libraries` section.
- Define the embedded Elements library shell, browse view, and profile/edit view.
- Reuse proven internal library patterns from Character, Styles, Presets, and Media Library surfaces.
- Produce implementation-ready UI artifacts, states, and component boundaries.
- Preserve forward compatibility with future Kling `kling_elements` pipeline wiring.

Out of scope:
- Provider payload wiring or submit-path mutation.
- Database schema work.
- Search/index backend work.
- Broad AI Studio shell redesign outside the new Elements surface.
- Refactoring the existing Kling settings UI in this lane.

## Product Decisions (Locked)

1. `Elements` is a true library surface, not another settings card.
2. The primary reference shell is the embedded Character Library, not the current Kling settings card.
3. The Elements surface must support two modes:
   - `Manage Elements`
   - `Element Profile`
4. The first UI pass is asset-first and edit-first:
   - creators can browse, create, edit, and delete elements
   - creators do not need provider wiring yet
5. The UI must stay compatible with Kie Kling 3.0 element semantics:
   - element names are prompt-addressable
   - image-backed and video-backed elements are different types
   - image-backed elements need multiple references, not only a single thumbnail
6. The first UI pass is local-library scoped:
   - no provider submit wiring
   - no persistence schema work
   - no drag-and-drop promotion from Media Library in this lane
7. The default landing tab is `Manage Elements`, unlike the embedded Character panel which defaults into profile/create mode.
8. The Elements library is a ShortPulse-side asset system, not a Kie-backed asset vault:
   - provider upload URLs are integration inputs, not canonical storage
   - future provider upload steps must be treated as transient delivery, not library persistence

## Primary Reference Surfaces

1. Character shell and embedded host:
   - `frontend/features/ai-studio/components/CharacterPanel.tsx`
   - `frontend/features/character-manager/components/CharacterManagerShell.tsx`
   - `frontend/features/character-manager/components/CharacterManagerWorkflowTabs.tsx`
   - `frontend/styles/character-manager.css`
   - `frontend/styles/character-manager-embedded.css`
2. Lightweight library card/edit patterns:
   - `frontend/features/ai-studio/components/PresetsLibraryPanel.tsx`
   - `frontend/features/ai-studio/components/StylesLibraryPanel.tsx`
3. Asset-browser interaction patterns:
   - `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
4. Current Kling panel context:
   - `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`
   - `frontend/features/ai-studio/components/ReferenceKlingAdvancedSteps.tsx`
   - `docs/sops/sop_video_generation.md`

## Problem Statement

The repo currently has no canonical Elements library surface. Kling 3.0 exposes element inputs inside the video properties flow, but that UI is not a reusable creator-facing library. The current `klingElements` controls are form rows inside the video panel and do not provide:
- a browsable reusable library
- a stable left-rail workflow
- explicit asset typing
- a cohesive profile/edit experience

Without an Elements library, any future Kling improvements will continue to overfit to the video properties panel instead of a reusable AI Studio asset system.

## Future Contract Constraints

The UI must not block later Kie wiring. The future integration boundary is:
- image-backed elements:
  - future provider mapping: `element_input_urls`
  - UI should expect `2..4` image references
  - Kie requires JPG/PNG, at least `300x300`, max `10MB` each
- video-backed elements:
  - future provider mapping: `element_input_video_urls`
  - UI should expect exactly one reference video
  - Kie requires MP4/MOV, max `50MB`
- prompt usage:
  - future prompt binding should reference a stable element name or alias
- asset durability:
  - Kie file URLs must be treated as expirable integration inputs
  - the canonical library should continue to assume ShortPulse-owned durability, not provider-hosted permanence

This lane does not implement those mutations, but the UI must not model elements in a way that contradicts them.

## Surface Map

1. Left rail entry:
   - new `Elements` button under `Libraries`
2. Embedded Elements host:
   - mounted from AI Studio properties/tool selection flow
3. Embedded shell:
   - header
   - workflow tabs
   - body switch between `Manage Elements` and `Element Profile`
4. Supporting states:
   - empty
   - loading
   - no selection
   - create
   - edit
   - delete confirm
   - validation error

## UX Model

### Mode 1: Manage Elements

Purpose:
- browse all saved elements
- select one for editing
- create a new element
- delete existing elements

Layout:
- embedded header with eyebrow + tab row
- heading `Elements Library`
- short helper copy
- `Create New Element` CTA
- element card grid or stacked list depending on width

Behavior:
- selecting a card opens `Element Profile`
- active card is visibly selected
- delete is available from the card
- empty state shows a single-path create CTA

### Mode 2: Element Profile

Purpose:
- edit one element’s identity and asset payload
- support future prompt binding without exposing provider details everywhere

Layout:
- detail editor surface
- identity section
- asset-type section
- reference-assets section
- metadata/helper section

Behavior:
- no element selected:
  - show onboarding empty state with create CTA
- selected element:
  - allow inline edit
  - allow delete
  - allow switching back to manage view

## Information Architecture

Every element in the first-pass UI should have:
- `id`
- `name`
- `alias`
- `description`
- `assetType`
  - `image`
  - `video`
- `thumbnailUrl`
- `imageReferenceUrls`
- `videoReferenceUrl`
- `updatedAt`
- `status`

Guidance:
- `name` is creator-facing and future prompt-facing
- `alias` is optional in the UI but useful for a future normalized token
- `thumbnailUrl` is presentation-only and may be derived from the first image or video poster later
- `imageReferenceUrls` is the future source of truth for image-backed elements
- `videoReferenceUrl` is the future source of truth for video-backed elements
- reference media shown in the library should be modeled as reusable ShortPulse assets, even if future provider delivery requires temporary upload URLs

## Implementation Workstreams

### Workstream 1: Add the left-rail tool and host entry

- Add `Elements` under `Libraries` in the left rail.
- Route selection into a new Elements host panel.
- Keep behavior parallel to the existing `Characters` and `Media` library entries.

Target files:
- `frontend/features/ai-studio/components/AiStudioToolbar.tsx`
- `frontend/features/ai-studio/components/__tests__/AiStudioToolbar.test.tsx`
- `frontend/features/ai-studio/components/AiStudioPageContent.tsx`

### Workstream 2: Build the embedded Elements shell

- Create the shared shell contract for:
  - `Manage Elements`
  - `Element Profile`
- Match the Character Library’s embedded header rhythm and tab behavior.
- Decide and lock the default landing tab:
  - recommended default: `Manage Elements`

Target files:
- `frontend/features/ai-studio/components/ElementsPanel.tsx`
- `frontend/features/elements-manager/components/ElementsManagerShell.tsx`
- `frontend/features/elements-manager/components/ElementsManagerWorkflowTabs.tsx`
- `frontend/features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx`

### Workstream 3: Build the library/browse surface

- Create the manage view:
  - section header
  - helper copy
  - create CTA
  - loading skeletons
  - empty state
  - card grid/list
- Preserve responsive density and explicit selected state.

Target files:
- `frontend/features/elements-manager/components/ElementsLibraryList.tsx`
- `frontend/features/elements-manager/components/ElementsLibraryCard.tsx`
- `frontend/features/elements-manager/components/__tests__/ElementsManagerShell.behavior.test.tsx`

### Workstream 4: Build the profile/edit surface

- Create the profile editor:
  - identity card
  - asset type selector
  - reference asset intake
  - description/helper block
- Support create-mode and edit-mode in one surface.
- Make image-backed and video-backed fields visibly different.

Target files:
- `frontend/features/elements-manager/components/ElementProfileEditor.tsx`
- `frontend/features/elements-manager/components/ElementReferenceAssetsCard.tsx`
- `frontend/features/elements-manager/components/ElementIdentityCard.tsx`

### Workstream 5: Style ownership and responsive behavior

- Keep style ownership modular.
- Borrow Character Library embedded spacing and card language.
- Do not mutate `globals.css`.
- Use one dedicated stylesheet for the new feature, with AI Studio-specific embedded overrides if needed.

Target files:
- `frontend/styles/elements-manager.css`
- `frontend/styles/elements-manager-embedded.css`

### Workstream 6: State model and future pipeline seam

- Keep UI state local and explicit.
- Define future mapping notes for Kling pipeline attachment.
- Ensure the chosen state shape can later hydrate from persistence without UI redesign.

Target files:
- `frontend/features/elements-manager/types.ts`
- `frontend/features/elements-manager/constants.ts`
- `frontend/features/elements-manager/hooks/useElementsManagerViewState.ts`

## Acceptance Criteria

1. AI Studio left rail includes an `Elements` library entry.
2. Selecting `Elements` opens a dedicated embedded library shell.
3. The shell exposes `Manage Elements` and `Element Profile`.
4. `Manage Elements` supports loading, empty, populated, selected, and delete-ready states.
5. `Element Profile` supports create and edit states with explicit asset-type differences.
6. The layout remains usable at common AI Studio panel widths.
7. The surface visually belongs to the same family as the Character Library.
8. The UI state model remains compatible with future Kling element wiring.

## Non-Blocking Follow-Ups

These are intentionally deferred and must not block the first UI build:
- drag-and-drop promotion from Media Library into Elements
- element search, sort, and filtering controls
- bulk actions across multiple elements
- persistence-backed draft recovery
- direct linking from Kling settings into a selected library element
- token auto-generation and collision handling beyond basic local draft rules

## Open Questions To Resolve During Implementation

These do not block starting the build, but should be locked once the first working shell exists:
- whether the `Elements` toolbar icon should mirror `Characters` with a semantic object icon or reuse a generic library icon already in the toolbar family
- whether the populated manage surface should ship with the optional add-tile on day one
- whether narrow panel widths should keep a compact card grid longer or collapse earlier into a strict list
- whether local draft retention should survive tool switches or only tab switches within the Elements panel

## Deliverables

This planning pack is complete only when the following artifacts stay in sync:
- build plan:
  - `docs/planning/ai-studio-elements-library-ui-build-plan-2026-04-06.md`
- UI spec:
  - `docs/planning/ai-studio-elements-library-ui-spec-2026-04-06.md`
- wireframes:
  - `docs/planning/ai-studio-elements-library-wireframes-2026-04-06.md`
- component and state map:
  - `docs/planning/ai-studio-elements-library-component-state-map-2026-04-06.md`
- implementation checklist:
  - `docs/planning/ai-studio-elements-library-implementation-checklist-2026-04-06.md`

## Evidence Notes

Repo-backed references:
- `frontend/features/ai-studio/components/AiStudioToolbar.tsx`
- `frontend/features/ai-studio/constants.ts`
- `frontend/features/ai-studio/components/CharacterPanel.tsx`
- `frontend/features/character-manager/components/CharacterManagerShell.tsx`
- `frontend/features/character-manager/components/CharacterManagerWorkflowTabs.tsx`
- `frontend/features/ai-studio/components/PresetsLibraryPanel.tsx`
- `frontend/features/ai-studio/components/StylesLibraryPanel.tsx`
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- `frontend/features/ai-studio/hooks/taskSubmission/videoPayloads.ts`
- `frontend/lib/server/providerIntegration/kieModelContracts.ts`

Official documentation references used for future-boundary constraints:
- Kie Kling 3.0 market docs:
  - `https://docs.kie.ai/cn/market/kling/kling-3.0`
- Kie API getting started guide:
  - `https://docs.kie.ai/cn`
- Kie motion-control docs:
  - `https://docs.kie.ai/30079657e0`

## Risks

1. Over-copying Character UI and inheriting character-specific affordances that do not fit elements.
- Mitigation: copy shell structure, not character-specific content.

2. Under-specifying the element data model and forcing redesign during pipeline wiring.
- Mitigation: lock the image/video element split and prompt-addressable naming now.

3. Building a modal-heavy editor that feels inconsistent with the left-rail library model.
- Mitigation: make the primary experience panel-native; use modals only for destructive confirms or bounded edit tasks.

4. Creating an overly heavy library when a lighter card/edit model would suffice.
- Mitigation: use Presets and Styles as references for where to keep the surface lean.

## Validation Plan

- Add layout tests for default tab, tab switching, and responsive DOM order.
- Add behavior tests for:
  - create
  - select
  - delete
  - empty state
  - type-specific editor fields
- Run targeted validation:
  - `cd frontend && npm run build`
  - targeted component tests for the new Elements surface

## Deliverables In This Planning Pack

1. UI build plan:
   - `docs/planning/ai-studio-elements-library-ui-build-plan-2026-04-06.md`
2. UI spec:
   - `docs/planning/ai-studio-elements-library-ui-spec-2026-04-06.md`
3. Wireframe artifact:
   - `docs/planning/ai-studio-elements-library-wireframes-2026-04-06.md`
4. Component and state map:
   - `docs/planning/ai-studio-elements-library-component-state-map-2026-04-06.md`
