---
title: AI Studio Character Panel Lean Hardening Build Loop
status: active
owner: Product + Engineering
created: 2026-05-23
last_updated: 2026-05-23
---

# AI Studio Character Panel Lean Hardening Build Loop

Purpose: turn the character-panel lean hardening implementation into a checkpointed execution loop with a clear stop condition, scope lock, and durable continuation path.

## 1. Stop Condition

Stop this build loop only when another agent could verify all of the following without guessing:

1. The live character-panel runtime no longer depends on disconnected QuickSwap UI, hook, drag/drop, or dead persistence helper surfaces.
2. The currently safe top-workspace styling tranche is rebuilt raw inline for the panel-owned description and top label/title surfaces without changing the visible contract.
3. The focused validation suite for the character panel, AI Studio character-mode bridge, and affected persistence surfaces passes after the last in-scope checkpoint.
4. The remaining work is either:
   - completed,
   - explicitly moved into the next bounded checkpoint,
   - or explicitly marked blocked because it requires a compatibility or data-retirement decision outside this safe loop.
5. The current continuation state exists in this repo-owned build-loop document rather than only in chat.
6. If the work becomes blocked beyond agent control or beyond what can be safely completed and proven from the repo and current environment, the loop stops and records that blocker explicitly instead of guessing or drifting.

Concrete outputs required before closing this loop:

1. Updated runtime code in the active character-panel path.
2. Updated top-workspace raw inline style ownership for the current in-scope tranche.
3. Validation notes in this document.
4. Completed-checkpoint ledger in this document.
5. Clear next-checkpoint instructions or explicit blocked status.

Validation and audit checks required before closing this loop:

1. Focused Vitest coverage for character-panel runtime and AI Studio character-mode surfaces must pass.
2. Any changed persistence helper coverage in the same lane must pass.
3. Search-based scope checks must confirm the just-removed surfaces are actually gone from active runtime.

Out of scope for this loop:

1. Bottom carriage media-library styling conversion.
2. Broad SQL or migration cleanup.
3. Docs-wide QuickSwap retirement sweep.
4. Visual redesign.
5. Blind removal of compatibility-sensitive cleanup logic that still protects historical data.

Stop instead of continuing when:

1. The next action is useful but not required by the stop condition.
2. The next action requires expanding into SQL/data-retirement work without an explicit compatibility decision.
3. The next action primarily belongs to a different lane, such as bottom-carriage styling or docs-wide cleanup.
4. The next action is blocked beyond agent control, beyond available system capability, or beyond what can be safely proven from the repo and current environment.

## 2. Scope Lock

Exact lane being worked:

1. Character-panel lean hardening implementation.
2. Safe QuickSwap runtime eradication.
3. Safe top-workspace raw inline style ownership conversion for panel-owned surfaces only.

In scope:

1. `frontend/features/character-manager/components/CharacterPanelWorkspace.tsx`
2. `frontend/features/character-manager/components/CharacterDescriptionEditorCard.tsx`
3. `frontend/features/character-manager/components/CharacterProfileLoadingSkeleton.tsx`
4. `frontend/features/character-manager/components/CharacterPanelSplitHost.tsx`
5. `frontend/features/character-manager/hooks/useCharacterManagerCharacterSheetInteractions.ts`
6. `frontend/features/character-manager/hooks/useCharacterManagerDragInteractions.ts`
7. `frontend/features/character-manager/hooks/useCharacterManagerDroppedReferenceController.ts`
8. `frontend/features/character-manager/logic/characterManagerPersistence.ts`
9. `frontend/features/character-manager/logic/characterManagerPersistenceCore.ts`
10. Character-panel-focused tests in `frontend/features/character-manager/**/__tests__/`
11. Character-mode bridge tests in `frontend/features/ai-studio/**/__tests__/`
12. Durable continuation docs for this program under `docs/planning/`

Out of scope:

1. `frontend/features/ai-studio/components/ElementsEmbeddedMediaLibraryPanel.tsx`
2. Bottom carriage media-library CSS or shared media-library visual systems
3. Broad `sql/` migration retirement
4. ADR work
5. Unrelated AI Studio surface refactors
6. Mini Ecosystem surfaces

Tempting adjacent work that must not be picked up in this loop unless the stop condition requires it:

1. Reworking the bottom carriage click-to-assign model
2. Docs-wide stale reference cleanup
3. Shared picker/modal redesign
4. Character-panel visual redesign
5. Repo-wide stylesheet strategy work outside the top character workspace

## 3. Checkpoint Plan

### Checkpoint 1: Lock Preserved Runtime Contract

Goal:

1. Protect the live character-panel replacement surface with explicit tests before removals.

Expected changed surfaces:

1. Character-panel split-host tests
2. Character-panel workspace tests
3. Character-mode bridge tests as needed

Validation to run:

1. Focused character-panel and AI Studio character-mode test suite

Self-audit question:

1. Did this checkpoint protect current live behavior, or did it accidentally encode stale intended behavior?

Scope-lock check:

1. No runtime removals yet.

Decision rule:

1. Continue only if the next cleanup is directly protected by the preserved-behavior contract.

Status:

1. Completed

### Checkpoint 2: Remove Dead QuickSwap Files

Goal:

1. Delete production-dead QuickSwap UI, hook, and helper files that no active runtime path imports.

Expected changed surfaces:

1. Dead component files
2. Dead hook files
3. Dead helper files
4. Dead tests for those deleted files

Validation to run:

1. Focused character-panel and AI Studio character-mode test suite
2. Search-based import verification

Self-audit question:

1. Was every deleted file actually disconnected from the active runtime?

Scope-lock check:

1. No persistence compatibility removal.

Decision rule:

1. Continue only if the next seam is still required by the stop condition.

Status:

1. Completed

### Checkpoint 3: Remove Active QuickSwap Drag/Drop Runtime Seams

Goal:

1. Eliminate QuickSwap-specific drag/drop and sheet-interaction branches from the live panel path while preserving character-sheet assignment behavior.

Expected changed surfaces:

1. `useCharacterManagerDragInteractions.ts`
2. `useCharacterManagerCharacterSheetInteractions.ts`
3. `useCharacterManagerDroppedReferenceController.ts`
4. `CharacterPanelWorkspace.tsx`
5. Associated hook tests

Validation to run:

1. Focused character-panel and AI Studio character-mode test suite

Self-audit question:

1. Did the live workspace keep all real assignment flows after the QuickSwap branch removal?

Scope-lock check:

1. No SQL or historical compatibility cleanup.

Decision rule:

1. Continue only if the remaining QuickSwap runtime residue is still in active code or directly blocks top-surface style ownership work.

Status:

1. Completed

### Checkpoint 4: Remove Disconnected QuickSwap Persistence Dead Surfaces

Goal:

1. Delete the standalone QuickSwap persistence module and orphaned types only after verifying they are disconnected from production imports.

Expected changed surfaces:

1. `frontend/features/character-manager/logic/characterQuickSwapPersistence.ts`
2. `frontend/features/character-manager/logic/__tests__/characterQuickSwapPersistence.test.ts`
3. `frontend/features/character-manager/types.ts`
4. `frontend/features/character-manager/logic/characterManagerPersistenceCore.ts`

Validation to run:

1. Focused character-panel and persistence-focused test suite
2. Search-based symbol verification

Self-audit question:

1. Did this remove only disconnected surfaces, leaving compatibility-sensitive cleanup logic intact?

Scope-lock check:

1. Do not remove live `character_quick_swap_items` cleanup queries in this checkpoint.

Decision rule:

1. Continue only if the next style slice is required by the stop condition and does not force broader visual redesign.

Status:

1. Completed

### Checkpoint 5: Top-Surface Inline Ownership Slice 1

Goal:

1. Move the description editor card and top workspace labels off shared character stylesheet label/helper hooks while preserving rendered appearance.

Expected changed surfaces:

1. `CharacterDescriptionEditorCard.tsx`
2. `CharacterPanelWorkspace.tsx`

Validation to run:

1. Focused character-panel and persistence-focused test suite
2. Search-based verification for removed label/helper class hooks in these surfaces

Self-audit question:

1. Did the inline conversion preserve the actual rendered contract instead of approximating it?

Scope-lock check:

1. Do not expand into bottom-carriage styling or broader modal redesign.

Decision rule:

1. Continue only if the next top-workspace style surface is directly required by the stop condition.

Status:

1. Completed

### Checkpoint 6: Top-Surface Inline Ownership Slice 2

Goal:

1. Rebuild the top-workspace loading prefab and remaining parent-workspace label/title style hooks raw inline.

Expected changed surfaces:

1. `CharacterProfileLoadingSkeleton.tsx`
2. Remaining top-workspace label/title/state styling in `CharacterPanelWorkspace.tsx`
3. Targeted tests if loading-state assertions need to become more explicit

Validation to run:

1. Focused character-panel and persistence-focused test suite
2. Search-based verification for removed loading-prefab and top-workspace class-hook dependencies

Self-audit question:

1. Are the remaining top-workspace styles still panel-owned, or are they leaking through stylesheet inheritance?

Scope-lock check:

1. Do not start modal-wide or bottom-carriage styling work inside this checkpoint.

Decision rule:

1. Continue only if the next action is required by the stop condition.
2. If only compatibility-sensitive cleanup remains, stop this loop and hand off the next bounded checkpoint.

Status:

1. Completed

### Checkpoint 7: Compatibility-Sensitive QuickSwap Cleanup Decision

Goal:

1. Decide whether the remaining QuickSwap cleanup queries in character deletion and orphan validation can be removed safely now or must remain gated behind a separate compatibility/data-retirement lane.

Expected changed surfaces:

1. `characterManagerPersistence.ts`
2. `characterManagerPersistenceCore.ts`
3. Potentially targeted tests only if the decision is evidence-backed and safe

Validation to run:

1. Focused persistence and character-panel suites
2. Search-based verification of any removed QuickSwap queries

Self-audit question:

1. Did this checkpoint remove historical protection without proof, or did it make the compatibility boundary clearer?

Scope-lock check:

1. Do not open SQL migration retirement or docs-wide cleanup as part of this checkpoint.

Decision rule:

1. If removal is not clearly safe, mark blocked and carry forward the exact blocker instead of forcing the cleanup.

Status:

1. Blocked
2. Evidence gathered in this loop shows the remaining `character_quick_swap_items` queries still protect historical cleanup behavior and known legacy contamination cases.
3. Safe removal cannot be proven from the repo and current environment alone.

## 4. Current Checkpoint Execution

Current checkpoint state:

1. Checkpoints 1 through 6 are complete.
2. Checkpoint 7 is blocked pending explicit compatibility/data-retirement direction.

Completed implementation summary:

1. Preserved the live top-workspace plus bottom-carriage contract with targeted tests.
2. Deleted dead QuickSwap UI, hook, and helper files that no live runtime imported.
3. Removed active QuickSwap drag/drop contamination from the live character-sheet interaction path.
4. Removed the disconnected standalone QuickSwap persistence module and orphaned types.
5. Converted the description card and top workspace heading labels away from shared character stylesheet label/helper hooks into inline-owned styles.
6. Converted the top-workspace loading prefab away from stylesheet-owned classes into inline-owned structure, typography, and animation behavior.

Current next required action:

1. Stop this loop and carry forward the explicit blocker instead of forcing removal of the remaining QuickSwap cleanup queries.

Why this next action is required by the stop condition:

1. The stop condition requires blocked work to be recorded explicitly instead of guessed through.
2. The only remaining known QuickSwap residue in this loop is compatibility-sensitive cleanup logic that still has evidence of historical data protection value.

Relevant files:

1. `frontend/features/character-manager/components/CharacterDescriptionEditorCard.tsx`
2. `frontend/features/character-manager/components/CharacterProfileLoadingSkeleton.tsx`
3. `frontend/features/character-manager/components/CharacterPanelWorkspace.tsx`
4. `frontend/features/character-manager/components/__tests__/CharacterPanelWorkspace.test.tsx`
5. `frontend/features/character-manager/components/__tests__/CharacterPanelSplitHost.test.tsx`
6. `frontend/features/character-manager/hooks/useCharacterManagerDroppedReferenceController.ts`
7. `frontend/features/character-manager/logic/characterManagerPersistence.ts`
8. `frontend/features/character-manager/logic/characterManagerPersistenceCore.ts`

## 5. Self-Audit, Scope-Lock Check, And Validation

Self-audit:

1. The completed checkpoints stayed in the safe runtime/style lane and did not expand into bottom-carriage styling or SQL retirement.
2. The remaining historical QuickSwap cleanup queries were intentionally preserved because they still protect legacy cleanup behavior and are not proven safe to remove blindly.
3. The top-surface style work used live style values rather than inventing new visual treatment.
4. This checkpoint correctly stopped at the compatibility boundary instead of treating historical cleanup protection as dead code.

Scope-lock check:

1. In-scope work remained inside the active character-panel runtime, top workspace, and durable planning surfaces.
2. No bottom-carriage styling work was opened.
3. No docs-wide cleanup or SQL retirement was folded into the implementation loop.

Validation already run:

1. Focused character-panel and AI Studio character-mode suite: `9` files / `60` tests passed after the active QuickSwap drop/runtime cleanup checkpoint.
2. Focused character-panel and persistence suite: `12` files / `78` tests passed after the disconnected persistence-module removal checkpoint.
3. Focused character-panel and persistence suite: `12` files / `78` tests passed after the top-surface inline label/description checkpoint.
4. Focused character-panel and persistence suite: `12` files / `78` tests passed after the top-workspace loading-prefab inline conversion checkpoint.
5. Documentation validation passed after recording the blocked checkpoint state.

## 6. Status Against Stop Condition

Current status:

1. The implementation loop is blocked beyond what can be safely proven and completed from the repo and current environment.
2. QuickSwap dead runtime and disconnected dead persistence surfaces are removed.
3. The current safe top-workspace inline-style tranche is complete.
4. The remaining compatibility-sensitive cleanup boundary is identified and intentionally not forced.
5. The smallest unblocking action is an explicit decision on whether historical `character_quick_swap_items` cleanup protection may be retired despite known legacy contamination and migration/backfill history.

## 7. Next Checkpoint Or Continuation Prompt

Exact next checkpoint to run:

1. None until the compatibility/data-retirement blocker is resolved.

Continuation prompt:

```text
Reload the character-panel build loop before doing work.

Use:
- docs/planning/ai-studio-character-panel-lean-hardening-build-loop-2026-05-23.md
- docs/planning/ai-studio-character-panel-lean-hardening-master-plan-2026-05-23.md
- docs/planning/ai-studio-character-panel-lean-hardening-phase-4-top-workspace-inline-style-conversion-plan-2026-05-23.md
- docs/planning/ai-studio-character-panel-lean-hardening-phase-3-persistence-and-cleanup-simplification-plan-2026-05-23.md

Stop condition:
- Remove disconnected QuickSwap runtime/dead persistence surfaces from the live panel path.
- Complete the current safe top-workspace raw inline style tranche.
- Keep focused validation green.
- Stop if the next action requires bottom-carriage styling, SQL retirement, or unproven compatibility removal.

Scope lock:
- In scope: top character workspace surfaces and active character-panel runtime files.
- Out of scope: bottom carriage media library styling, broad SQL cleanup, docs-wide cleanup, visual redesign.

Completed checkpoints:
- Checkpoint 1: preserved behavior lock
- Checkpoint 2: dead QuickSwap file purge
- Checkpoint 3: active QuickSwap drag/drop seam cleanup
- Checkpoint 4: disconnected QuickSwap persistence dead-surface purge
- Checkpoint 5: top-surface inline ownership slice 1
- Checkpoint 6: top-surface inline ownership slice 2

Next checkpoint:
- Do not continue automatically. Resume only after an explicit compatibility/data-retirement decision about the remaining `character_quick_swap_items` cleanup protection.

Why this checkpoint is required:
- The active stop condition now requires the loop to stay stopped until the blocker is resolved.

Relevant files:
- frontend/features/character-manager/logic/characterManagerPersistence.ts
- frontend/features/character-manager/logic/characterManagerPersistenceCore.ts
- frontend/features/character-manager/logic/__tests__/characterSheetPresets.test.ts
- frontend/features/character-manager/logic/__tests__/characterManagerPersistenceCore.test.ts

Validation already run:
- Focused suite passed at 12 files / 78 tests after the latest completed checkpoint.

Known blocker boundary:
- characterManagerPersistence.ts and characterManagerPersistenceCore.ts still contain compatibility-sensitive QuickSwap cleanup queries; do not remove them without explicit evidence that the historical protection is no longer needed.
- Repo evidence supporting the blocker includes:
  - `frontend/features/character-manager/logic/__tests__/characterSheetPresets.test.ts` still models `character_quick_swap_items` as part of orphan-cleanup protection.
  - `docs/agents/nuclo/memory.md` records legacy staging contamination involving `character_quick_swap_items` linked to the wrong `asset_kind`.
  - `sql/migrations/045_add_character_quickswap_deck.sql`, `068_add_character_media_assets_isolation.sql`, and `119_require_character_media_id_on_character_links.sql` all encode historical backfill/integrity behavior around the table.

## 8. Closeout When Complete Or Blocked

Current closeout state:

1. Not complete.
2. Blocked.
3. Automation should stop until the compatibility/data-retirement blocker is explicitly resolved.

Blocked closeout rule:

1. If a checkpoint cannot continue because the blocker is beyond agent control or beyond what can be safely completed and proven from the repo and current environment, stop the loop immediately.
2. Record the blocker in this build-loop document.
3. Record the smallest unblocking action.
4. Do not continue into adjacent work as a substitute.
```

## 8. Closeout When Complete Or Blocked

Current closeout state:

1. Not complete.
2. Not blocked.
3. Ready to continue at Checkpoint 6.
