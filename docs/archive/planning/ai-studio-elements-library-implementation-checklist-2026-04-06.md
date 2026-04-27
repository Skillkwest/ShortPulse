# AI Studio Elements Library Implementation Checklist (2026-04-06)

Status: Superseded historical reference  
Owner: Frontend Engineering  
Depends on:
- `docs/archive/planning/ai-studio-elements-library-ui-build-plan-2026-04-06.md`
- `docs/archive/planning/ai-studio-elements-library-ui-spec-2026-04-06.md`
- `docs/archive/planning/ai-studio-elements-library-wireframes-2026-04-06.md`
- `docs/archive/planning/ai-studio-elements-library-component-state-map-2026-04-06.md`

> Archived on 2026-04-26 during the docs-cleanup wave. Superseded by the completed Elements decoupling packet.

> Historical note: superseded by the Elements decoupling packet dated 2026-04-09. Retain this document only as the original first-build execution checklist for historical context.

## Purpose

Turn the Elements planning pack into an execution-ready checklist so implementation can start without reopening scope.

## Phase 0: Entry Criteria

- confirm current branch is the user-approved working branch
- confirm this lane is UI-only
- confirm no persistence or provider wiring is bundled into the first diff
- confirm the Character Library remains the shell reference for embedded behavior
- confirm the Elements library copy frames assets as product-owned library items, not Kie-hosted uploads

## Phase 1: Toolbar And Host Wiring

- add `elements` to `ToolId`
- add `Elements` to `librariesToolList` directly after `Characters`
- add icon mapping for the new tool
- mount `ElementsPanel` from the AI Studio host flow
- add layout coverage for the new left-rail entry and active-state behavior

## Phase 2: Feature Scaffold

- create `frontend/features/elements-manager/`
- add `types.ts`
- add `constants.ts`
- add `ElementsManagerShell.tsx`
- add `ElementsManagerWorkflowTabs.tsx`
- add `useElementsManagerViewState.ts`
- add `useElementsManagerDraft.ts`

## Phase 3: Manage Elements View

- implement `ElementsLibraryList.tsx`
- implement `ElementsLibraryCard.tsx`
- render loading skeleton state
- render empty state
- render populated state
- render selected state
- add delete initiation affordance

## Phase 4: Element Profile View

- implement `ElementProfileEditor.tsx`
- implement `ElementIdentityCard.tsx`
- implement `ElementTypeSelector.tsx`
- implement `ElementReferenceAssetsCard.tsx`
- support create mode
- support edit mode
- support image element variant
- support video element variant

## Phase 5: Styles

- add `frontend/styles/elements-manager.css`
- add `frontend/styles/elements-manager-embedded.css`
- match Character Library spacing, border language, and CTA emphasis
- verify narrow-panel collapse behavior

## Phase 6: Interaction Rules

- selecting a card opens `Element Profile`
- `Create New Element` opens blank create mode
- save keeps the user on the created or updated profile
- delete returns the user to `Manage Elements`
- tab switching behavior is deterministic
- draft retention behavior is explicit and tested

## Phase 7: Validation

- add layout tests for the host panel and tab order
- add behavior tests for create, select, delete, loading, and empty states
- add accessibility assertions for tabs, cards, delete labels, and upload zones
- run targeted test files for the new Elements surface
- run at least one adjacent-surface regression check for toolbar and panel switching behavior

## Phase 8: Self-Audit Before Wiring

- verify the UI does not mention unsupported persistence guarantees
- verify the UI does not leak Kling provider terminology into core library controls
- verify image and video element paths are visually distinct
- verify the panel still feels native beside `Characters`, `Media`, `Presets`, and `Styles`
- verify future-validation helper text does not contradict Kie constraints:
  - images `2..4`, JPG/PNG, `300x300+`, `10MB max`
  - video `1`, MP4/MOV, `50MB max`
- verify no copy suggests provider URLs are the permanent saved form of an element

## Out-Of-Scope Guardrails

Do not pull these into the first build:
- server persistence
- API routes
- Kie payload submission
- automatic sync into `klingElements`
- media-library promotion flows
- character-to-element conversion flows

## Build Exit Criteria

Do not call the first implementation pass complete until:
- the planning docs and implementation still agree on default tab, scope, and future wiring boundary
- the toolbar entry, panel shell, and core states are all landed together
- tests cover the new host routing and the shell state transitions
