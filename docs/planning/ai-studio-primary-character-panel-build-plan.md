---
title: AI Studio Primary Character Panel Build Plan
status: Active
owner: Product + Engineering
created: 2026-02-15
last_updated: 2026-02-15
---

# AI Studio Primary Character Panel Build Plan

Purpose: deliver a full Character Manager workflow body inside AI Studio when the primary toolbar Character button is selected, while preserving existing Create workflow Character Picker behavior and generation injection contracts.

## Scope Lock

In scope:
- Primary toolbar Character action opens a dedicated Character Properties panel in AI Studio.
- Panel content is the Character Manager workflow body only (no `/character` hero/header chrome).
- Character workflow parity target: match `/character` create/manage behavior (upload, drag/drop assign/replace/swap, persistence, delete, profile image controls).
- Keep AI Studio Create-panel Character Picker separate and unchanged for this phase.
- Keep existing Character Mode injection behavior unchanged for generation.
- Preserve the existing `/character` page behavior and implementation; no route-level feature/UX changes on `/character` in this effort.

Out of scope:
- Replacing Create-panel Character Picker with this new primary panel.
- Changing billing/credit/generation provider behavior.
- Database schema changes.
- Altering `/character` page behavior, layout, or workflow contract.

## Product Decisions (Locked)

1. This is not the Create-panel Character Picker flow.
2. The primary toolbar Character button opens its own dedicated panel.
3. The embedded panel should be the Character Manager workflow body only.

## Plan Audit: Gaps Identified From Current Architecture

1. `ToolId` mismatch risk already exists:
- Toolbar selects `canvas` (`frontend/features/ai-studio/constants.ts`).
- Some file-routing logic still checks only `selectedTool === "character"` (`frontend/features/ai-studio/hooks/useAiStudioWorkspaceActions.ts`).
- Impact: uploads and file-accept behavior can route incorrectly for the Character tool.

2. Dead/stale character path still present:
- Legacy `useCharacterWorkflow` and `CharacterPropertiesPanel` props are still wired at page level (`frontend/pages/ai-studio.tsx`, `frontend/features/ai-studio/hooks/useAiStudioCharacterPanelProps.ts`), but not used by rendered panel.
- Impact: extra complexity/regression surface during refactor.

3. Reuse boundary not yet extracted:
- `CharacterManagerShell` mixes page chrome and workflow internals in one large component (`frontend/features/character-manager/components/CharacterManagerShell.tsx`).
- Impact: embedding directly in AI Studio will duplicate/override page-only concerns.

4. Layout + modal integration risks:
- Character Manager overlays/modals and drag/drop states were designed for full-page route.
- AI Studio has its own column scroll, modal stack, and shell-resize behavior.
- Impact: z-index, overflow, and keyboard behavior conflicts unless explicitly validated.

5. Shared preference coupling:
- Character Manager beginner-mode local storage key is route-agnostic.
- Impact: toggling beginner mode in AI Studio may intentionally or unintentionally affect `/character`.
- Decision needed during implementation: keep shared preference or split keys.

## Tool ID Strategy (Decision)

Decision for this build-out:
- Keep internal `ToolId` as `canvas` for this phase to minimize broad churn.
- Treat `canvas` as canonical primary Character tool in AI Studio implementation.
- Normalize logic with an explicit helper (`isPrimaryCharacterTool`) wherever tool checks exist, then optionally migrate id naming later.

Rationale:
- Lowest-risk path for shipping the new panel quickly.
- Avoids touching many unrelated union checks/tests in one refactor.

## Implementation Workstreams

### Workstream 1: Extract reusable Character Manager workflow body
- Create a reusable component for workflow body content (create/manage tabs and all draft interactions), separated from route-only header/hero chrome.
- Keep behavior parity with existing Character Manager shell interactions.
- Keep persistence and validation through existing `useCharacterManagerDraft` hook and character-manager logic modules.

Target files:
- `frontend/features/character-manager/components/CharacterManagerShell.tsx`
- `frontend/features/character-manager/components/*` (new extracted body component(s))
- `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts` (reuse only, behavior unchanged)

### Workstream 2: Replace AI Studio placeholder Character panel
- Replace `CharacterPanel` placeholder render path for primary Character tool.
- Render extracted Character Manager workflow body in AI Studio properties column.
- Ensure this panel does not include `/character` hero/account/plan header.

Target files:
- `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- `frontend/features/ai-studio/components/CharacterPanel.tsx` (replace or retire)

### Workstream 3: Normalize Character tool routing checks
- Fix all AI Studio logic paths that should treat primary Character tool as `canvas`.
- Centralize checks in helper function to prevent future drift.

Target files:
- `frontend/features/ai-studio/hooks/useAiStudioWorkspaceActions.ts`
- `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- `frontend/features/ai-studio/logic/propertiesPanelRouting.ts`
- `frontend/features/ai-studio/logic/*` where tool gating is character-specific

### Workstream 4: Remove stale legacy character panel wiring
- Remove unused `useCharacterWorkflow`-driven panel prop wiring from AI Studio page path once replacement is stable.
- Delete or archive unused glue code/tests tied to obsolete panel path.

Target files:
- `frontend/pages/ai-studio.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioCharacterPanelProps.ts`
- `frontend/features/character/components/CharacterPropertiesPanel.tsx` (only if no longer referenced)

### Workstream 5: Styling + interaction hardening
- Add/adjust AI Studio-specific styles for embedded Character Manager body.
- Ensure panel scroll behavior, drag/drop hit targets, and modal overlays work in properties column.
- Validate responsive behavior on desktop and mobile widths.

Target files:
- `frontend/styles/ai-studio-layout.css`
- `frontend/styles/ai-studio-properties.css`
- `frontend/styles/character-manager.css` (scoped extraction as needed)

### Workstream 6: Testing and regression protection
- Preserve and run existing Character Manager interaction tests.
- Add AI Studio integration tests for:
  - Character toolbar button opens embedded manager body.
  - Core create/manage interactions still function.
  - No regression in Create Character Mode injection flows.

Target files:
- `frontend/features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx`
- `frontend/features/ai-studio/components/__tests__/AiStudioToolbar.test.tsx`
- `frontend/tests/pages/ai-studio.character-mode.test.tsx`
- new AI Studio primary-character-panel tests (to be added)

## Acceptance Criteria

1. Clicking primary toolbar Character opens embedded Character Manager workflow body in AI Studio.
2. Embedded panel supports create/manage workflows with parity to `/character` body interactions.
3. Character uploads and drag/drop assignments persist and reload correctly.
4. Create-panel Character Picker remains intact and unchanged.
5. Existing Character Mode generation injection tests remain green.
6. No new console/runtime errors in AI Studio when switching between Create/Edit/Video/Character.

## QA Checklist

- [ ] Toolbar Character button selects primary Character panel.
- [ ] Panel shows create/manage workflow body only (no `/character` hero/header).
- [ ] Reference uploads accept only images and respect limits/validation messaging.
- [ ] Character Sheet assign/replace/swap behavior works.
- [ ] Assignments persist after refresh and character switching.
- [ ] Profile image upload/adjust/remove works.
- [ ] Manage tab create/select/delete flows work.
- [ ] AI Studio Create panel Character Picker still works as before.
- [ ] Character Mode generation submit path still injects hidden prompt + sheet refs as designed.
- [ ] Mobile and desktop layout remain usable.

## Risk Register

1. Large-component extraction drift from `CharacterManagerShell`.
- Mitigation: extract incrementally and keep behavior tests passing at each step.

2. Tool-id branching regressions (`canvas` vs `character`).
- Mitigation: centralized helper + search-based audit before merge.

3. Modal/overlay stack conflicts inside AI Studio shell.
- Mitigation: explicit z-index and focus/escape validation in manual QA.

4. Unintended coupling of beginner-mode preference between surfaces.
- Mitigation: decide and document whether shared or split storage key behavior is intended.

## Execution Sequence

1. Extract reusable Character Manager workflow body from route shell.
2. Embed workflow body into AI Studio primary Character panel.
3. Normalize `canvas` routing checks and remove stale character panel wiring.
4. Harden CSS/layout/modal interactions.
5. Run tests and manual QA checklist.
6. Update SOP/docs/change log for shipped behavior.

## Docs To Update In Implementation PR

- `docs/sops/sop_ai_studio_index.md` (panel behavior/ownership note)
- `docs/sops/sop_character_manager_operations.md` (embedded surface note, if behavior differs)
- `docs/routes.md` (AI Studio Character panel behavior note)
- `docs/change_log.md` (implementation summary)
