# AI Studio Right-Rail Performance Scope Contract (2026-03-23)

Last updated: 2026-03-23  
Status: Active  
Owner: AI Studio Engineering  
Companion tracker: `docs/planning/ai-studio-right-rail-performance-tracker-2026-03-23.md`

## Purpose
Define the exact scope, stop rules, and done state for the current AI Studio right-rail performance effort so implementation stays high-value and does not drift into patchwork.

## Why this document exists
The repo already has broader Reference Grid and media-rendering plans. This document is narrower on purpose. It governs only the current right-rail effort:
- Reference Grid
- Quick Slot Inventory
- rail Canvas

It exists to answer three questions before any additional implementation:
1. What is in scope?
2. What counts as done?
3. What kind of follow-up work is explicitly not justified without new evidence?

## Companion docs
- `docs/planning/ai-studio-reference-grid-reliability-master-roadmap-2026-03-21.md`
- `docs/planning/ai-studio-reference-grid-reliability-master-tracker-2026-03-21.md`
- `docs/planning/ai-studio-reference-grid-stabilization-v4-plan.md`
- `docs/planning/media-library-reference-grid-optimization-plan.md`

## Scope
### In scope
1. Right-rail drag/drop correctness for Reference Grid, Quick Slot, and rail Canvas.
2. Right-rail perceived speed for newly inserted media.
3. Duplicate-work reduction when the same output is visible in Quick Slot and All Refs.
4. Shared media-resolution and hydration policy for right-rail surfaces.
5. Targeted tests that lock the above contracts.

### Out of scope
1. Broad Media Library architecture or query-path redesign.
2. Unrelated AI Studio panels and shell work outside the right rail.
3. Speculative drag-hover or rendering micro-optimizations without evidence.
4. Global app performance work that does not directly change right-rail user behavior.
5. New telemetry surfaces unless they are required to close a concrete right-rail decision.

## Research inputs
This effort should stay aligned with high-value sources, not instinct alone.

### Repo-backed findings
1. Shared right-rail duplicate ownership is now centralized in `useReferenceGridSurfaceOwnershipController`.
2. Shared right-rail media resolution is now centralized in `useReferenceGridResolvedMediaController`.
3. Shell bypass and surface-local drop handling already exist for the right rail; new work must justify itself against current routing behavior.

### External guidance
1. React `useMemo`: use manual memoization only for noticeably slow calculations or values that help avoid repeated expensive work.
   Source: `https://react.dev/reference/react/useMemo`
2. React Performance Tracks: use profiling evidence when deciding whether another optimization pass is warranted.
   Source: `https://react.dev/reference/dev-tools/react-performance-tracks`
3. MDN HTML Drag and Drop API: drag payloads are intentionally constrained during drag operations; treat hover-time logic as hint-driven and keep real payload parsing for drop-time behavior.
   Source: `https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API`
4. web.dev virtualization guidance: keep visible-window work bounded and avoid rendering or processing more media items than the viewport needs.
   Source: `https://web.dev/articles/virtualize-long-lists-react-window`

## Execution lanes
### RR-1 Surface routing and drop ownership
Scope:
- Shell bypass behavior
- Quick Slot direct payload acceptance
- rail Canvas direct payload acceptance

Success condition:
- Right-rail drops route to the intended target surface without shell fallback stealing the interaction.

### RR-2 Duplicate-surface ownership
Scope:
- Quick Slot vs All Refs ownership policy
- duplicate loading suppression
- duplicate video/image visible-work suppression

Success condition:
- Quick Slot is the clear primary owner when both surfaces show the same output.

### RR-3 Shared media resolution and first paint
Scope:
- preview/full/fallback resolution reuse
- first image paint before hydration completion
- hydration queue reuse of shared resolution policy

Success condition:
- Right-rail card derivation and hydration scheduling do not independently rebuild the same media policy.

### RR-4 Measurement-gated follow-up only
Scope:
- image hydration internals
- additional drag-hover optimization
- deeper video/autoplay refinement

Success condition:
- No work begins in this lane without profiling or a concrete repo-backed defect.

## Done state
The scope is done when all required items below are true.

### Required
1. Right-rail drop routing is correct for Reference Grid, Quick Slot, and rail Canvas.
2. Quick Slot accepts internal references and Media Library payloads as first-class drops.
3. rail Canvas accepts internal references, library payloads, text, and files without shell interference.
4. Duplicate-surface ownership is centralized and consistent.
5. Duplicate All Refs copies do not do redundant visible work when Quick Slot already owns the same output.
6. Newly inserted image media can paint without waiting for hydration completion.
7. Hydration scheduling uses the same preferred-surface and shared media-resolution policy as visible card derivation.
8. Targeted tests cover the main right-rail contracts.
9. No remaining obvious duplicated right-rail policy seam exists across the active controllers.

### Optional
1. Additional drag-hover micro-optimizations.
2. More video/autoplay tuning.
3. More telemetry counters.
4. Further helper consolidation inside image hydration internals.

Optional work is not part of the done state unless profiling proves it is still a top bottleneck.

## Stop rules
1. Do not continue by adjacency alone.
2. Do not open a new right-rail lane unless it maps to a failed required item or a measured bottleneck.
3. If the next idea is only a possible improvement and not a concrete remaining defect, stop.
4. If the next change would reintroduce the same policy in another controller instead of consolidating it, stop and redesign.
5. Once all required done-state items are satisfied, move to closeout audit instead of continuing optimization.

## Required validation bundle
For right-rail behavior-changing work:
1. `cd frontend && npm run test -- features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx features/ai-studio/reference-grid/controllers/__tests__/useReferenceGridHydrationQueueController.test.ts features/ai-studio/reference-grid/controllers/__tests__/useReferenceGridVideoLifecycleController.test.ts`
2. Add `features/ai-studio/reference-grid/controllers/__tests__/useReferenceGridResolvedMediaController.test.ts` when shared media-resolution policy changes.
3. Run the relevant shell/canvas drop tests when routing changes:
   `cd frontend && npm run test -- features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx features/ai-studio/hooks/__tests__/useAiStudioShellDndController.test.ts features/ai-studio/components/canvas/__tests__/canvas.drop.test.tsx`
4. `npm -C frontend run docs:check` when planning docs change.

## Current decision posture
This scope is allowed to continue only until the required done-state items are true. After that point, further right-rail work requires:
1. a measured bottleneck,
2. a concrete repo-backed defect, or
3. a user-directed scope expansion.
