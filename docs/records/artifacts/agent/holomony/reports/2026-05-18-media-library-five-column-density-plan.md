# Media Library Five-Column Density Plan

Date: 2026-05-18

Purpose: retained plan for making approved media-library browse surfaces display up to five media columns while preserving load speed, display ratios, and surface boundaries.

## Plan Audit

The plan is useful only if it protects three things at the same time:

- layout goal: approved browse surfaces can show up to five media columns on wide enough containers
- performance goal: first paint, settle time, signing pressure, preview decode, and video attach budgets do not regress materially
- boundary goal: the full Media Library modal, Character QuickSwap, Reference Grid, and other media-adjacent grids do not change by accident

The highest-risk failure mode is a global shared-grid change that unintentionally changes the full modal. The second-highest risk is shrinking audio or prompt cards until their controls and text become harder to use. The third risk is improving density while quietly increasing preview bandwidth.

Latest audit update:

- the virtualized media-only grid currently uses `targetColumnWidth: 220`
- the virtualized All Media grid currently uses `targetColumnWidth: 188`
- panel CSS already overrides packed panel grids toward `--media-library-modal-preview-width: 188px`
- the implementation must reconcile virtual and non-virtual density behavior instead of changing only one path
- dense preview work must account for the current static `cardLongEdgePx: 320` calls in both grid components

Second audit update:

- this is a five-column masonry-column goal, not a strict equal-row grid goal
- with the current practical minimum width of `188px` and `1px` gaps, a surface needs about `944px` of usable grid width to show five columns
- narrower panels should intentionally render fewer columns instead of shrinking cards until controls, prompts, or ratios degrade
- the Character panel bottom embedded browser can inherit the five-column contract, but it should only reach five when the split/expanded state gives it enough width
- the repo does not have a `frontend/app` path; implementation and tests should stay under `frontend/features` and `frontend/styles`

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

## Current Code Facts

Use these facts as the implementation baseline:

- `MediaLibraryMediaGrid` is shared by the full modal and panel surfaces.
- `MediaLibraryAllItemsGrid` is shared by panel surfaces and embedded panel surfaces.
- `MediaLibraryModal` uses `MediaLibraryMediaGrid` and must not receive the panel density prop.
- `MediaLibraryPanel` and `ElementsEmbeddedMediaLibraryPanel` are the intended density prop sources.
- `CharacterPanelSplitHost` inherits the bottom browser through `ElementsEmbeddedMediaLibraryPanel`.
- Virtualization starts only after the configured item threshold, so small libraries depend on CSS layout.
- Panel preview signing and video browse preview signing are already visibility-scoped through `visibleMediaIdsRef`; this must remain true after the density change.

## Layout Contract

Use this rule:

- five columns is a maximum for wide panel media browsing, not a forced count everywhere
- "five media to a row" means five masonry columns on wide enough media-library browse panels; masonry rows can look staggered because images and videos keep their real aspect ratios

Practical behavior:

- wide container: up to 5 columns
- medium container: 4 or 3 columns
- narrow/mobile: 2 or 1 columns
- never shrink below the readable card minimum without visual proof

Keep masonry behavior for images and videos so media ratios remain useful. Do not switch to fixed equal-height thumbnails in the first pass.

Minimum card-size rule:

- do not reduce All Media below the current practical `188px` target without a visual pass
- do not reduce media-only cards below `188px` in the first pass
- treat `944px` usable grid width as the rough threshold for five columns at the current minimum
- if five columns cannot fit while preserving readable card width, show fewer than five columns

Surface-specific implications:

- AI Studio main Media Library panel is the most likely surface to hit five columns at normal or expanded width.
- Elements embedded Media Library panel may hit five columns only when its panel width is large enough; otherwise four or fewer is correct.
- Character panel bottom embedded Media Library browser should use the same density config through `ElementsEmbeddedMediaLibraryPanel`, but normal split height/width may make four or fewer columns the right result.
- Full Media Library modal must remain unchanged unless a later task explicitly expands scope to the modal.

## Implementation Plan

0. Capture or record a pre-change baseline.
   - Use existing retained KPI packets if a fresh run is not possible.
   - Prefer a fresh same-environment baseline before implementation when credentials/runtime allow it.
   - Record whether the baseline is direct, retained, or unavailable.

1. Add named density constants.
   - Add a single panel constant such as `MEDIA_LIBRARY_PANEL_MAX_COLUMNS = 5`.
   - Add a panel minimum target width constant such as `MEDIA_LIBRARY_PANEL_MIN_COLUMN_WIDTH = 188` instead of scattering `188` or `220`.
   - Add a derived minimum five-column width check or comment so future agents understand why five columns need about `944px`.
   - Keep modal defaults unchanged.

2. Add an optional max-column control to the shared virtualizer.
   - Add `maxColumnCount?: number` or equivalent to `mediaGridVirtualization.ts`.
   - Thread it through `useMediaMasonryVirtualization.ts`.
   - Default must preserve current behavior when omitted.

3. Add a panel-only density prop to the shared grid components.
   - `MediaLibraryMediaGrid`
   - `MediaLibraryAllItemsGrid`
   - Use a named prop or config, not an implicit global default.

4. Pass the density prop only from panel surfaces.
   - `MediaLibraryPanel.tsx`
   - `ElementsEmbeddedMediaLibraryPanel.tsx`
   - Do not pass it from `MediaLibraryModal.tsx`.

5. Match the non-virtual CSS path.
   - Under the current virtualization threshold, CSS controls layout.
   - Add panel-only CSS so small item counts follow the same five-column contract.
   - Avoid changing modal CSS defaults.
   - Ensure the CSS path and virtualizer path use the same practical card-width target.
   - Prefer a panel-scoped CSS custom property over hard-coded duplicate width values.
   - Confirm the CSS change applies to both media-only and All Media packed grids.

6. Make preview sizing follow dense card size.
   - Avoid treating dense cards as if every card still needs a `320px` long-edge preview.
   - Use measured or estimated card width when selecting adaptive preview variants.
   - Keep current behavior when no density config is supplied.
   - Do not increase `fetchpriority="high"` count just because more cards fit in a row; if anything, reconsider whether the first `8` eager-priority cards are still appropriate after the density change.

7. Preserve runtime budgets.
   - Do not raise video autoplay/attach budgets.
   - Do not make audio eager-load by default.
   - Do not increase sign budgets just because more cards are visible.
   - Keep `visibleMediaIdsRef` wired through AI Studio and Elements/Character embedded panel paths.

8. Add a rollback path in the same diff.
   - One constant or prop removal should disable the density behavior.
   - Do not require reverting unrelated preview or runtime code to roll back layout density.

## Performance Safeguards

Before accepting the change:

- first paint must not materially regress against the same-environment baseline
- settle time must not materially regress against the same-environment baseline
- missing preview ratio should remain healthy
- sign p95 and extra list calls should remain within the current healthy range
- video attach budget must remain capped
- audio should remain on-demand
- visible-row signing must remain scoped to visible ids
- no added count-only/list churn should appear
- higher visual density must not increase initial eager media work beyond the existing budgeted behavior

If density increases visible-card count enough to stress preview work, prefer smaller preview variants and tighter visible-row prioritization before reducing correctness.

Stop condition:

- if visual readability requires cards smaller than the minimum target, stop and keep fewer columns
- if KPI evidence regresses materially and smaller previews do not recover it, roll back density rather than tuning around a bad layout

## Test Plan

Required unit coverage:

- virtualizer caps wide layouts at 5 when `maxColumnCount` is provided
- virtualizer still falls below 5 on narrow containers
- virtualizer produces exactly 5 columns around the `944px` threshold with `188px` target width and `1px` gap
- virtualizer behavior is unchanged when `maxColumnCount` is omitted
- `MediaLibraryPanel` passes the density prop to media and all-items grids
- `ElementsEmbeddedMediaLibraryPanel` passes the density prop to media and all-items grids
- `MediaLibraryModal` does not pass the density prop
- All Media audio cards still render controls correctly in component tests
- the panel paths still pass `visibleMediaIdsRef` into the mixed grid
- the panel paths do not alter video autoplay budget constants
- non-virtual panel CSS contains a panel-scoped density rule and does not alter modal packed-grid defaults
- tests or assertions cover the Character panel inheritance path through `ElementsEmbeddedMediaLibraryPanel` without changing character workspace grids

Recommended commands:

```bash
cd frontend
npm test -- features/media-library/logic/__tests__/mediaGridVirtualization.test.ts features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts features/ai-studio/hooks/__tests__/useMediaVideoBrowsePreviewUrls.test.ts features/ai-studio/components/__tests__/MediaLibraryMediaGrid.test.tsx features/ai-studio/components/__tests__/MediaLibraryAllItemsGrid.test.tsx features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx features/character-manager/components/__tests__/CharacterPanelSplitHost.test.tsx
```

## Visual Proof Plan

After implementation, verify screenshots or direct visual inspection for:

- AI Studio Media Library panel, normal width
- AI Studio Media Library panel, expanded width
- Elements embedded Media Library panel
- Elements embedded Media Library panel, expanded or widest available state if normal width cannot fit five columns
- Character panel bottom embedded Media Library browser
- Character panel bottom embedded Media Library browser, expanded or widest available state if normal split width cannot fit five columns
- All Media with mixed images, videos, audio, and prompts
- Images-only and videos-only tabs

The visual pass must check:

- cards are readable
- audio controls are not cramped
- prompt cards remain understandable
- masonry ratios still feel useful
- no unrelated modal layout changed
- normal-width panels do not force five columns when that would make cards too small
- expanded panels show up to five columns when the container is wide enough
- if a surface cannot show five columns at current width, record the measured width and expected fallback column count instead of treating it as a failure

## KPI Proof Plan

Before implementation:

- capture a fresh baseline if credentials/runtime allow it
- otherwise state that retained packets are the available baseline

Run existing media panel KPI capture after the change for approved surfaces:

- `ai-studio-panel`
- `elements-media-panel`

Use the retained report only if credentials and runtime state allow a real proof run. If a direct proof run is not available, clearly mark the gap rather than claiming performance success.

Record these fields in the implementation closeout:

- first paint
- settle time
- sign p95
- extra list call count
- resolver churn
- missing preview ratio
- visible state flips
- whether the evidence is fresh or retained

## Rollback Strategy

Keep the change easy to unwind:

- use a named constant or prop value such as `MEDIA_LIBRARY_PANEL_MAX_COLUMNS = 5`
- keep modal behavior as the default path
- avoid scattered magic numbers
- isolate CSS under panel-specific selectors
- keep adaptive preview-size changes guarded by the same panel density config

If performance or readability regresses, remove the panel density prop or lower the constant without unwinding unrelated runtime work.

## Implementation Status

Implemented on 2026-05-18.

Code changes made:

- added `MEDIA_LIBRARY_PANEL_DENSITY_CONFIG` with `maxColumnCount: 5` and `targetColumnWidth: 188`
- added optional `maxColumnCount` support to `mediaGridVirtualization.ts` and `useMediaMasonryVirtualization.ts`
- added optional `densityConfig` props to `MediaLibraryMediaGrid` and `MediaLibraryAllItemsGrid`
- passed the density config only from `MediaLibraryPanel.tsx` and `ElementsEmbeddedMediaLibraryPanel.tsx`
- left `MediaLibraryModal.tsx` unchanged, so modal grids stay on the default path
- added panel-scoped CSS for `.media-library-panel-density-grid`
- kept CSS column-count density on the non-virtual path only, with an explicit virtualized reset to avoid fighting absolute-positioned masonry
- routed dense panel preview requests through the smaller `188px` card long-edge input instead of the old static `320px` panel value

Validation completed:

- focused virtualizer/grid/panel/Character host tests passed
- targeted eslint on touched files passed
- docs check passed

Validation gaps:

- direct browser visual proof is still needed before calling the visual/layout part done
- fresh KPI proof is still needed before claiming no speed regression
- full repo `type-check` and full repo `lint` are currently blocked by unrelated pre-existing failures outside this lane

## Done Criteria

The lane is done when:

- approved browse surfaces can display up to five columns on wide enough containers
- narrow containers remain responsive and readable
- modal behavior is unchanged
- Character QuickSwap and Reference Grid are unchanged
- tests cover scoped propagation and virtualizer math
- visual proof shows acceptable display ratios and controls
- KPI proof shows no material speed regression, or the result is explicitly recorded as a blocker
- retained Holomony memory/inventory is updated with the result, not just the plan
