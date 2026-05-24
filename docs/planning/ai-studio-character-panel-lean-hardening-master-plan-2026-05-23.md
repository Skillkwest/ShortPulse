---
title: AI Studio Character Panel Lean Hardening Master Plan
status: active
owner: Product + Engineering
created: 2026-05-23
last_updated: 2026-05-23
---

# AI Studio Character Panel Lean Hardening Master Plan

Purpose: reduce character-panel implementation weight without changing the current UI, UX, or live behavior contract.

## Source Of Truth

1. Current code and passing tests are the authority for this program.
2. Existing docs, planning files, and ADRs are supporting context only and may be stale or wrong.
3. This program does not require ADR work as a precondition. The immediate need is execution-ready planning, not architecture ceremony.

## Current Product Contract

The live character panel is the AI Studio-owned character surface. The active layout is:

1. Top character workspace.
2. Bottom carriage media library.

The top workspace currently owns:

1. Character library access.
2. Create and Save actions.
3. Character name editing.
4. Looks management.
5. Per-look description editing.
6. Three ordered reference slots: `portrait`, `close_up`, and `front_shot`.

For planning and style-conversion purposes, the top-surface scope also includes the character-owned modal flows launched from that workspace, including the character library picker modal and destructive confirmation dialogs.

The bottom carriage media library is the replacement surface for the retired QuickSwap deck and remains part of the live experience, but styling conversion work in this program applies only to the top workspace.

## Program Goals

1. Eradicate QuickSwap from the live character-panel runtime and supporting system surfaces.
2. Remove dead code, dead styling surfaces, and stale compatibility branches that no longer serve the current panel.
3. Convert the top workspace to raw inline styling ownership.
4. Preserve current visible behavior and AI Studio integration.
5. Leave the bottom carriage media library behaviorally and stylistically untouched unless a later program explicitly expands scope.

For styling, "preserve visible behavior" means recreating the real live visual contract raw rather than depending on stylesheet inheritance. That includes colors, fonts, typography scale, spacing, radii, borders, shadows, layout sizing, and interaction states.

## Scope

In scope:

1. Full-system QuickSwap eradication.
2. Active runtime simplification in the character-panel path.
3. Persistence and cleanup simplification where QuickSwap still adds weight.
4. Top-workspace-only inline styling conversion.
5. Planning, SOP, and SQL/documentation cleanup after runtime cutover.

Out of scope:

1. Redesigning the visible character-panel UX.
2. Replacing the bottom carriage media library.
3. Changing AI Studio character-mode generation semantics.
4. Reintroducing the standalone `/character` route as a primary surface.
5. ADR authoring as a required deliverable for this planning lane.

## Preserved Behavior Checklist

The following behaviors must remain unchanged unless a later explicitly approved lane says otherwise:

1. Character create, save, select, and delete.
2. Look add, rename, delete, and select.
3. Per-look description editing and persistence.
4. Three-slot reference assignment behavior.
5. Drag and drop into character slots.
6. Upload-to-open-slot bridge from AI Studio character upload flows.
7. Save and reopen persistence behavior.
8. AI Studio generation injection behavior for selected character data.
9. Current top-workspace plus bottom-carriage visual layout.
10. Current top-workspace visual contract, including typography, color, spacing, slot sizing, and state presentation.

## Visual Parity Contract

For the top workspace, parity means preserving the actual rendered visual result, not preserving the old CSS architecture.

The raw inline rebuild must preserve:

1. font family, weight, size, line height, and label/body hierarchy,
2. text colors, background colors, border colors, and icon color treatment,
3. spacing, padding, gap, alignment, and section sizing,
4. border radius, outline, and shadow treatment,
5. empty, filled, hover, focus, active, dragging, drop-active, disabled, success, and loading states,
6. current responsive behavior at the widths where the top workspace is used,
7. the current visual relationship between the top workspace shell and the unchanged bottom carriage.
8. the current visual treatment of top-surface modals, picker cards, modal headers, close actions, and confirmation dialogs launched from the character workspace.

## Known Current-State Findings

1. QuickSwap is no longer part of the intended product contract, but QuickSwap-era logic still exists in dead files, active hooks, persistence helpers, SQL references, and docs.
2. The largest visible runtime surface is already the top workspace plus the bottom embedded media library, not the old shell and deck composition.
3. The top workspace already uses a large amount of inline styling, but it still depends on stylesheets, class selectors, and CSS variables.
4. The bottom carriage media library is mounted in assignment mode, but click-to-assign wiring may currently be missing in the host path. This is a validation risk and must be treated as a current-state check, not an assumed live behavior.
5. Existing docs and planning files still describe obsolete QuickSwap-centric behavior and should not drive implementation decisions.

## Audit Refresh Delta

The current repo still shows these concrete hotspots and they should remain front-and-center in execution:

1. `CharacterPanelSplitHost.tsx` still mounts the bottom carriage in assignment mode without passing `onSelectMedia`, so click-to-assign remains a live validation question.
2. `CharacterPanelWorkspace.tsx` still defines `DND_QUICK_SWAP_ITEM`, which confirms QuickSwap is still part of the active runtime contract rather than only dead code.
3. `useCharacterManagerDragInteractions.ts` still imports `CharacterQuickSwapItem`, tracks `setDraggedQuickSwapItemId`, and mutates class-driven drag state, so the runtime and styling cleanup lanes are still tightly coupled there.
4. `useCharacterManagerDroppedReferenceController.ts` still models `target: "quickswap"` and still owns the QuickSwap drop/upload branch, so Phase 2 remains necessary before persistence cleanup can be considered complete.
5. `CharacterDescriptionEditorCard.tsx` has moved further toward inline ownership but still carries class linkages, while `CharacterProfileLoadingSkeleton.tsx` is still heavily stylesheet-driven.
6. Active SOP, SQL, and data-dictionary docs still present QuickSwap as live behavior, so Phase 5 remains a real cleanup phase rather than optional polish.

## Phase Structure

### Phase 1: Behavior Lock And Replacement Contract

Goal: lock the real current panel contract before destructive cleanup starts.

Primary doc:

- `docs/planning/ai-studio-character-panel-lean-hardening-phase-1-behavior-lock-and-replacement-contract-plan-2026-05-23.md`

### Phase 2: QuickSwap Runtime Eradication

Goal: remove QuickSwap from live runtime code, active hooks, and dead UI modules.

Primary doc:

- `docs/planning/ai-studio-character-panel-lean-hardening-phase-2-quickswap-runtime-eradication-plan-2026-05-23.md`

### Phase 3: Persistence And Cleanup Simplification

Goal: remove QuickSwap persistence weight and reduce legacy compatibility burden after runtime cutover is safe.

Primary doc:

- `docs/planning/ai-studio-character-panel-lean-hardening-phase-3-persistence-and-cleanup-simplification-plan-2026-05-23.md`

### Phase 4: Top Workspace Inline Style Conversion

Goal: eliminate stylesheet, CSS-variable, and class-hook dependencies from the top workspace only.

Primary doc:

- `docs/planning/ai-studio-character-panel-lean-hardening-phase-4-top-workspace-inline-style-conversion-plan-2026-05-23.md`

### Phase 5: Docs, SQL, And Closeout Cleanup

Goal: retire stale references and update active docs after runtime and styling work are complete.

Primary doc:

- `docs/planning/ai-studio-character-panel-lean-hardening-phase-5-docs-sql-and-closeout-plan-2026-05-23.md`

## Validation Model

Validation is phase-gated. The program should not move forward by adjacency alone.

1. Phase 1 must establish the preserved-behavior contract and baseline validation path.
2. Phase 2 must prove active runtime no longer depends on QuickSwap.
3. Phase 3 must not remove compatibility or SQL surfaces until data-usage gates are satisfied.
4. Phase 4 must keep the top workspace visually and behaviorally identical while shifting styling ownership inline.
5. Phase 5 must update docs and SQL references only after the runtime truth has already changed.

## Phase Dependency Map

1. Phase 1 is the contract lock and anchors every later decision.
2. Phase 2 depends on Phase 1 because QuickSwap removal must preserve the live replacement-surface model.
3. Phase 3 depends on Phase 2 because persistence cleanup should only follow runtime cleanup.
4. Phase 4 depends on behavior stability from Phase 2 and benefits from Phase 3, but it can proceed while some gated compatibility remains.
5. Phase 5 depends on implemented truth from the earlier phases and should not lead runtime changes.

## Program-Wide Risk Register

### Risk 1: Preserving the wrong behavior

Older docs still describe QuickSwap-era behavior that is no longer the live panel contract.

Mitigation:

1. Use current code and tests as authority.
2. Treat Phase 1 as a hard prerequisite for destructive cleanup.

### Risk 2: Runtime cleanup breaking assignment behavior

QuickSwap residue is mixed into active drag, drop, and upload hooks.

Mitigation:

1. Remove clearly dead surfaces first.
2. Revalidate slot assignment, upload bridge, and generation injection after each runtime slice.

### Risk 3: Data-compatibility assumptions being wrong

Persistence still carries legacy fallback behavior that may protect historical data.

Mitigation:

1. Gate Phase 3 behind explicit compatibility review.
2. Preserve compatibility code where evidence is incomplete.

### Risk 4: Styling conversion drifting into redesign

Top-workspace inline conversion could become a visual redesign or accidentally pull in the bottom carriage.

Mitigation:

1. Keep the acceptance bar at visual parity.
2. Keep the bottom carriage explicitly out of scope.

### Risk 5: Hidden class-selector dependencies

Some current runtime behavior still depends on CSS classes and stylesheet-backed tests.

Mitigation:

1. Inventory class-selector hooks before style deletion.
2. Replace runtime hooks before removing related stylesheet dependency.

## Program-Wide Validation Matrix

### Automated validation

Run these at the relevant phase boundaries:

1. Targeted character-panel component tests.
2. Targeted AI Studio character-mode tests.
3. Persistence-focused tests when load/delete/hydration code changes.
4. Docs integrity checks when planning or SOP surfaces change.

### Manual validation

Perform these checks at the right points in the program:

1. Open the character panel and confirm the top workspace plus bottom carriage layout is unchanged.
2. Create a new character and save it.
3. Select an existing character and switch between looks.
4. Edit a description and confirm per-look persistence behavior.
5. Assign all three slots through supported flows.
6. Refresh and confirm state persistence.
7. Submit an AI Studio character-mode generation and confirm injection behavior is unchanged.
8. Compare top-workspace fonts, colors, spacing, radii, shadows, and interactive states against the live baseline.

### Search-based verification

Use targeted search passes to confirm cleanup success:

1. Search for remaining QuickSwap runtime references after Phase 2.
2. Search for remaining QuickSwap persistence references after Phase 3.
3. Search for remaining top-workspace stylesheet and `var(...)` dependencies after Phase 4.
4. Search active docs for stale QuickSwap-as-live references after Phase 5.

For Phase 4, include searches for top-surface modal and picker styling dependencies as well, not just the in-panel editor body.

## Recommended Execution Slices

1. Delete or isolate dead surfaces first.
2. Simplify active runtime seams second.
3. Simplify persistence only after runtime cleanup is stable.
4. Move styling ownership only after behavior is quiet.
5. Clean docs and SQL references last.

## Definition Of Success

The program is successful when all are true:

1. The current character panel looks and behaves the same.
2. QuickSwap is gone from the live character-panel system.
3. The top workspace owns its styling inline without stylesheet or CSS-variable dependency.
4. Compatibility code remains only where evidence says it must.
5. Active docs and planning indexes describe the real current system rather than the retired one.
6. Top-workspace visuals have been recreated raw from the live rendered truth rather than indirectly through stylesheet linkage.

## Risk Gates

1. Do not remove persistence or SQL compatibility surfaces until stored-data usage is verified.
2. Do not treat embedded media-library click-to-assign as preserved behavior until the current host wiring is verified in code and testing.
3. Do not let the top-workspace style conversion creep into the bottom carriage media library.
4. If a cleanup step changes live behavior, stop at isolation or simplification and defer destructive removal until the behavior delta is understood.

## Program Deliverables

1. This master plan.
2. A readiness-state document.
3. An implementation-entry checklist.
4. Phase plans for the five execution phases.
5. Planning-index updates so this program becomes part of the active reading path.

## Program Docs

1. `docs/planning/ai-studio-character-panel-lean-hardening-readiness-state-2026-05-23.md`
2. `docs/planning/ai-studio-character-panel-lean-hardening-implementation-entry-checklist-2026-05-23.md`
3. `docs/planning/ai-studio-character-panel-lean-hardening-phase-1-behavior-lock-and-replacement-contract-plan-2026-05-23.md`
4. `docs/planning/ai-studio-character-panel-lean-hardening-phase-2-quickswap-runtime-eradication-plan-2026-05-23.md`
5. `docs/planning/ai-studio-character-panel-lean-hardening-phase-3-persistence-and-cleanup-simplification-plan-2026-05-23.md`
6. `docs/planning/ai-studio-character-panel-lean-hardening-phase-4-top-workspace-inline-style-conversion-plan-2026-05-23.md`
7. `docs/planning/ai-studio-character-panel-lean-hardening-phase-5-docs-sql-and-closeout-plan-2026-05-23.md`
