---
title: AI Studio Primary Character Panel Full-Surface Plan
status: Active
owner: Product + Engineering
created: 2026-02-15
last_updated: 2026-03-29
---

# AI Studio Primary Character Panel Full-Surface Plan

Purpose: make the AI Studio Character panel the canonical full Character management surface, keep the standalone `/character` route as a secondary entrypoint, and preserve Create-panel picker and generation-injection behavior while keeping image-heavy reference areas fast and readable.

## Scope Lock

In scope:
- AI Studio Character panel is the primary Character management surface.
- The panel must expose the full Character Manager experience, including manage and profile workflows.
- The Character surface should feel first-class inside AI Studio, not like a narrow embed.
- The AI Studio host must explicitly own panel-width, right-rail visibility, and embedded scroll behavior for this surface.
- Keep AI Studio Create-panel Character Picker separate and unchanged for this phase.
- Keep existing Character Mode injection behavior unchanged for generation.
- Keep the `/character` route functional as a secondary entrypoint or deep link, but do not treat it as the primary product home.
- Reuse Character-specific adaptive-media delivery policy and selectively borrow Media Library image-performance patterns where they fit.

Out of scope:
- Replacing Create-panel Character Picker with the management surface.
- Changing billing/credit/generation provider behavior.
- Database schema changes.
- Replacing the Media Library runtime or porting Media Library sign-batch surface runtime into Character Manager.

## Product Decisions (Locked)

1. This is not the Create-panel Character Picker flow.
2. The AI Studio Character panel is the primary management surface for character work.
3. The `/character` route is secondary to the AI Studio panel.
4. Character image-heavy regions must preserve the existing character-specific media delivery contract from ADR 0044.
5. Media Library runtime modules are reference material, not a transplant target for this lane.

## Surface Map

1. Primary surface:
   - AI Studio Character panel.
2. Secondary surfaces:
   - `/character` route.
   - Create/Edit character picker modals.
   - Any compatibility deep links into the character workflow.
3. Shared workflow substrate:
   - `CharacterManagerShell`.
   - `CharacterCreateWorkspaceLayout`.
   - draft/persistence/state helpers under `frontend/features/character-manager/`.
4. Media-performance reference surface:
   - AI Studio Media Library panel and modal runtime.
5. Character-specific delivery-policy seam:
   - `frontend/features/character-manager/logic/characterGridPreviewUrl.ts`
   - `frontend/features/character-manager/hooks/useCharacterCardPreviewUrls.ts`

## Plan Audit: Gaps Identified From Current Architecture

1. Character-panel host still reads like an embedded shell:
   - `CharacterPanel` currently wraps `CharacterManagerShell` and still starts on `manage`.
   - Impact: the AI Studio panel does not yet feel like the primary character home.

2. Route ownership is still split:
   - `/character` remains a fully developed route shell.
   - Impact: the repo still implies two possible primary homes unless the hierarchy is made explicit.

3. Image-heavy character subregions need a performance strategy:
   - QuickSwap decks, reference thumbnails, and image grids can become dense quickly.
   - Impact: without a width-aware and budget-aware rendering strategy, the panel can feel cramped or slow.

4. Shared state and draft persistence remain route-agnostic:
   - `useCharacterManagerDraft` and related helpers are shared today.
   - Impact: we need to preserve that reuse while making the panel feel primary.

5. Media Library is the strongest internal performance reference:
   - It already uses width-aware column budgets, shared preview/runtime helpers, and adaptive load pressure.
   - Impact: the character surface should copy the patterns that fit, not inherit Media Library runtime ownership blindly.

6. Host-width and right-rail behavior are part of the actual product contract:
   - AI Studio already special-cases the Character panel for width and right-rail visibility.
   - Impact: the plan needs explicit host-level work for shell sizing, canvas hiding, and rail toggle composition.

7. Docs and route descriptions still frame `/character` as the obvious standalone home:
   - `README.md`, `docs/routes.md`, and `sop_character_manager_operations.md` still center `/character`.
   - Impact: the implementation plan needs explicit doc-alignment work, not just a closing note.

## Tool / Host Strategy

Decision for this build-out:
- Keep the existing workflow identity helpers and embed the Character surface under the AI Studio Character tool path.
- Make the AI Studio host the primary experience, but do not force a broad tool-id renaming pass as part of this planning lane.
- Normalize logic with explicit helpers wherever character-tool gating matters.

Rationale:
- Lowest-risk path for making the AI Studio panel primary without broad cross-cutting churn.
- Avoids turning a surface-ownership decision into a tool-identity migration.

## Implementation Workstreams

### Workstream 1: Recast the AI Studio host as the primary surface
- Make the AI Studio Character panel read as the main entrypoint for character work.
- Ensure the primary state and panel chrome reflect management-first behavior.
- Replace the current hard-coded embedded default-tab assumption with an explicit landing-state contract.
- Decide whether the default landing state should be restore-last-used or Character Profile-first, then encode that decision in host tests and shell state.
- Keep panel scroll-lock behavior coherent with the chosen default tab.

Target files:
- `frontend/features/ai-studio/components/CharacterPanel.tsx`
- `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- `frontend/features/ai-studio/hooks/useCharacterPanelPropertiesScrollLock.ts`
- `frontend/features/ai-studio/components/__tests__/CharacterPanel.layout.test.tsx`
- `frontend/features/character-manager/hooks/useCharacterManagerShellViewState.ts`

### Workstream 2: Stabilize the shared Character Manager body
- Keep `CharacterManagerShell` as the shared workflow substrate used by both hosts.
- Separate any remaining route-only concerns from reusable workflow content if and when that becomes necessary.
- Preserve draft, persistence, and drag/drop behavior while the host hierarchy changes.
- Keep embedded-surface policy explicit instead of scattering panel-specific conditionals.

Target files:
- `frontend/features/character-manager/components/CharacterManagerShell.tsx`
- `frontend/features/character-manager/components/CharacterCreateWorkspaceLayout.tsx`
- `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts`
- `frontend/features/character-manager/logic/characterManagerPersistence.ts`
- `frontend/features/character-manager/logic/characterManagerSurfacePolicy.ts`

### Workstream 3: Preserve and extend the existing character media baseline
- Preserve the existing width-aware QuickSwap baseline and visible-window virtualization before adding new runtime logic.
- Keep reference thumbnails readable at common panel widths.
- Preserve the character-specific delivery policy:
  - prefer durable variant URLs first,
  - preserve direct signed Supabase URLs,
  - do not force Media Library sign-batch preview profiles into Character in this lane,
  - keep character detail/preview overlays full-quality and non-adaptive.
- Reuse adaptive-media policy and selective sizing patterns where they fit, but do not port the Media Library surface preview runtime into Character Manager.

Target files:
- `frontend/features/character-manager/components/CharacterQuickSwapDeckSection.tsx`
- `frontend/features/character-manager/components/CharacterManagerShell.tsx`
- `frontend/features/character-manager/hooks/useCharacterCardPreviewUrls.ts`
- `frontend/features/character-manager/logic/characterGridPreviewUrl.ts`
- `frontend/styles/character-manager.css`
- `frontend/styles/character-manager-embedded.css`
- `frontend/lib/adaptive-media/**` only if a bounded policy update is actually required

### Workstream 4: Keep secondary surfaces secondary
- Preserve Create/Edit picker behavior exactly as a selection surface.
- Keep `/character` working as a secondary deep link and route fallback.
- Avoid introducing duplicate character-management logic in the selection modals.
- Reframe route copy and route docs so `/character` is clearly secondary without breaking behavior.

Target files:
- `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`
- `frontend/features/ai-studio/components/edit/ExpertEditCharacterPickerModal.tsx`
- `frontend/pages/character.tsx`
- `README.md`
- `docs/routes.md`
- `docs/sops/sop_character_manager_operations.md`
- `docs/sops/sop_ai_studio_index.md`

### Workstream 5: Host sizing, visibility, and regression hardening
- Keep AI Studio shell width policy aligned with the Character panel’s primary-surface role.
- Preserve the Character-specific right-rail contract in AI Studio.
- Expand tests around the AI Studio host, the shared character body, and image-density behavior.
- Validate that media-heavy character regions remain usable at common panel widths.
- Confirm generation-injection and picker flows remain intact.
- Run the protected adaptive-media gate when touching protected character paths.

Target files:
- `frontend/features/ai-studio/logic/shellResize.ts`
- `frontend/styles/ai-studio-layout.css`
- `frontend/features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx`
- `frontend/features/character-manager/components/__tests__/CharacterManagerShell.layout.test.tsx`
- `frontend/features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx`
- new AI Studio host coverage that does not fully mock away `CharacterPanel`
- `docs/change_log.md`

## Acceptance Criteria

1. AI Studio Character is the default management surface for character work.
2. The surface supports the full manage/profile workflow without feeling like a narrow embed.
3. The AI Studio host uses an explicit default-tab contract instead of a legacy `manage` default assumption.
4. Dense reference imagery stays readable and responsive at common panel widths without violating ADR 0044 delivery rules.
5. Character right-rail behavior and panel-width behavior remain coherent in AI Studio.
6. Create/Edit picker flows are unchanged.
7. Existing Character Mode generation injection tests remain green.
8. `/character` continues to function as a secondary route or deep link and is documented that way.

## QA Checklist

- [ ] AI Studio Character opens as the primary management surface.
- [ ] Manage and profile workflows are both usable inside AI Studio.
- [ ] Embedded default-tab behavior matches the new locked host contract.
- [ ] Reference grids remain readable at common panel widths.
- [ ] QuickSwap columns adapt to panel width without becoming cramped.
- [ ] Character-grid cards prefer durable variants and preserve direct signed URLs where required.
- [ ] Character reference preview/detail overlay remains full-quality.
- [ ] AI Studio Character host still hides/shows the correct right-rail panels.
- [ ] AI Studio Character host still respects minimum shell-width behavior.
- [ ] AI Studio Create panel Character Picker still works as before.
- [ ] Character Mode generation submit path still injects hidden prompt + sheet refs as designed.
- [ ] `/character` still functions as a secondary entrypoint.
- [ ] Mobile and desktop layout remain usable.
- [ ] Protected-path validation passes: `cd frontend && npm run test:adaptive-v2-gate`

## Risk Register

1. Surface hierarchy drift between AI Studio and `/character`.
- Mitigation: lock the ownership decision in ADR and keep route docs aligned.

2. Plan drift into an unintended Media Library runtime transplant.
- Mitigation: keep ADR 0044 delivery boundaries explicit and preserve character-specific preview resolution helpers.

3. Image-heavy regions becoming too dense or too slow.
- Mitigation: preserve existing QuickSwap virtualization/width-aware baseline, then extend only where evidence shows a gap.

4. Shared workflow body diverging between hosts.
- Mitigation: keep a shared body/component boundary and maintain tests for both hosts.

5. Modal/overlay stack conflicts inside AI Studio shell.
- Mitigation: explicit z-index and focus/escape validation in manual QA.

## Execution Sequence

1. Lock the surface-ownership decision in ADR.
2. Recast the AI Studio host as the primary Character surface.
3. Lock the embedded default-tab and scroll/visibility contract in tests and host state.
4. Preserve shared workflow/body reuse while keeping `/character` secondary.
5. Preserve and extend the existing character-specific image-delivery baseline.
6. Run tests and manual QA checklist.
7. Update route/SOP/readme/changelog docs for shipped behavior.

## Docs To Update In Implementation PR

- `README.md` (primary/secondary character surface note)
- `docs/adr/0044-media-rendering-surface-delivery-policy-and-adr-reconciliation.md` only if the delivery-policy contract changes
- `docs/sops/sop_ai_studio_index.md` (panel behavior/ownership note)
- `docs/sops/sop_character_manager_operations.md` (primary-surface and secondary-route note)
- `docs/routes.md` (AI Studio Character panel and `/character` hierarchy note)
- `docs/change_log.md` (implementation summary)
