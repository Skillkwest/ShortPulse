# Media Library Five-Column Density Plan

Date: 2026-05-18

Purpose: retained plan for making approved media-library browse surfaces display up to five media columns while preserving load speed, display ratios, and surface boundaries.

## Plan Audit

The plan is useful only if it protects three things at the same time:

- layout goal: approved browse surfaces can show up to five media columns on wide enough containers
- performance goal: first paint, settle time, signing pressure, preview decode, and video attach budgets do not regress materially
- boundary goal: the full Media Library modal, Character QuickSwap, Reference Grid, and other media-adjacent grids do not change by accident

The highest-risk failure mode is a global shared-grid change that unintentionally changes the full modal. The second-highest risk is shrinking audio or prompt cards until their controls and text become harder to use. The third risk is improving density while quietly increasing preview bandwidth.

## Approved Scope

Apply the five-column density contract only to approved media-library browse surfaces:

- AI Studio Media Library panel
- Elements embedded Media Library panel
- Character panel bottom embedded Media Library browser

These surfaces share the panel browse runtime and should receive the same density behavior through explicit panel props or config.

## Explicit Exclusions

Do not change these surfaces in the first implementation:

- full AI Studio Media Library modal
- Character QuickSwap
- character-owned assignment/workspace grids above the embedded browser
- Reference Grid
- Quick Slot Inventory
- standalone `/media-library` route

The modal is a real runtime surface, but it is not the current target. Character QuickSwap and Reference Grid have their own layout contracts and should not inherit media-library density work.

## Layout Contract

Use this rule:

- five columns is a maximum for wide panel media browsing, not a forced count everywhere

Practical behavior:

- wide container: up to 5 columns
- medium container: 4 or 3 columns
- narrow/mobile: 2 or 1 columns
- never shrink below the readable card minimum without visual proof

Keep masonry behavior for images and videos so media ratios remain useful. Do not switch to fixed equal-height thumbnails in the first pass.

## Implementation Plan

1. Add an optional max-column control to the shared virtualizer.
   - Add `maxColumnCount?: number` or equivalent to `mediaGridVirtualization.ts`.
   - Thread it through `useMediaMasonryVirtualization.ts`.
   - Default must preserve current behavior when omitted.

2. Add a panel-only density prop to the shared grid components.
   - `MediaLibraryMediaGrid`
   - `MediaLibraryAllItemsGrid`
   - Use a named prop or config, not an implicit global default.

3. Pass the density prop only from panel surfaces.
   - `MediaLibraryPanel.tsx`
   - `ElementsEmbeddedMediaLibraryPanel.tsx`
   - Do not pass it from `MediaLibraryModal.tsx`.

4. Match the non-virtual CSS path.
   - Under the current virtualization threshold, CSS controls layout.
   - Add panel-only CSS so small item counts follow the same five-column contract.
   - Avoid changing modal CSS defaults.

5. Make preview sizing follow dense card size.
   - Avoid treating dense cards as if every card still needs a `320px` long-edge preview.
   - Use measured or estimated card width when selecting adaptive preview variants.
   - Keep current behavior when no density config is supplied.

6. Preserve runtime budgets.
   - Do not raise video autoplay/attach budgets.
   - Do not make audio eager-load by default.
   - Do not increase sign budgets just because more cards are visible.

## Performance Safeguards

Before accepting the change:

- first paint must not materially regress
- settle time must not materially regress
- missing preview ratio should remain healthy
- sign p95 and extra list calls should remain within the current healthy range
- video attach budget must remain capped
- audio should remain on-demand

If density increases visible-card count enough to stress preview work, prefer smaller preview variants and tighter visible-row prioritization before reducing correctness.

## Test Plan

Required unit coverage:

- virtualizer caps wide layouts at 5 when `maxColumnCount` is provided
- virtualizer still falls below 5 on narrow containers
- virtualizer behavior is unchanged when `maxColumnCount` is omitted
- `MediaLibraryPanel` passes the density prop to media and all-items grids
- `ElementsEmbeddedMediaLibraryPanel` passes the density prop to media and all-items grids
- `MediaLibraryModal` does not pass the density prop
- All Media audio cards still render controls correctly in component tests

Recommended commands:

```bash
cd frontend
npm test -- features/media-library/logic/__tests__/mediaGridVirtualization.test.ts features/ai-studio/components/__tests__/MediaLibraryMediaGrid.test.tsx features/ai-studio/components/__tests__/MediaLibraryAllItemsGrid.test.tsx features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx features/character-manager/components/__tests__/CharacterPanelSplitHost.test.tsx
```

## Visual Proof Plan

After implementation, verify screenshots or direct visual inspection for:

- AI Studio Media Library panel, normal width
- AI Studio Media Library panel, expanded width
- Elements embedded Media Library panel
- Character panel bottom embedded Media Library browser
- All Media with mixed images, videos, audio, and prompts
- Images-only and videos-only tabs

The visual pass must check:

- cards are readable
- audio controls are not cramped
- prompt cards remain understandable
- masonry ratios still feel useful
- no unrelated modal layout changed

## KPI Proof Plan

Run existing media panel KPI capture after the change for approved surfaces:

- `ai-studio-panel`
- `elements-media-panel`

Use the retained report only if credentials and runtime state allow a real proof run. If a direct proof run is not available, clearly mark the gap rather than claiming performance success.

## Rollback Strategy

Keep the change easy to unwind:

- use a named constant or prop value such as `MEDIA_LIBRARY_PANEL_MAX_COLUMNS = 5`
- keep modal behavior as the default path
- avoid scattered magic numbers
- isolate CSS under panel-specific selectors

If performance or readability regresses, remove the panel density prop or lower the constant without unwinding unrelated runtime work.

## Done Criteria

The lane is done when:

- approved browse surfaces can display up to five columns on wide enough containers
- narrow containers remain responsive and readable
- modal behavior is unchanged
- Character QuickSwap and Reference Grid are unchanged
- tests cover scoped propagation and virtualizer math
- visual proof shows acceptable display ratios and controls
- KPI proof shows no material speed regression, or the result is explicitly recorded as a blocker
