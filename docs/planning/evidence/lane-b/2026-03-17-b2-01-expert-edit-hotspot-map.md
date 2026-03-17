# Lane B Hotspot Map: B2-01 ExpertEditPanelView

date_utc: 2026-03-17  
slice_id: B2-01  
track: B-Core  
owner: Engineering  
linked_pr: n/a (planning/control artifact)

## Purpose
1. Record the remaining hotspot structure inside `ExpertEditPanelView.tsx` now that early micro-seams have reduced duplication but are yielding smaller returns.
2. Prevent further low-yield helper churn by identifying the next extraction boundaries before additional `B2-01` seams are taken.
3. Keep Lane B aligned with the tightened seam rubric and branch-by-abstraction style incremental refactoring.

## Current State
1. `ExpertEditPanelView.tsx` remains above the Lane B warn-mode budget at `5133` lines.
2. Recent seams have been valid and low-risk, but the value density is decreasing:
   - duplication has been reduced,
   - gesture cleanup is clearer,
   - larger orchestration boundaries still remain in the hotspot.
3. The next useful unit of progress is no longer "move another tiny repeated fragment"; it is "unlock a coherent sub-controller or presenter boundary."

## Remaining Domain Clusters
### 1. Markup viewport and pan lifecycle
Includes:
1. `handleMoveZoomSliderChange`
2. `resetMarkupViewport`
3. `syncViewportSizeByScope`
4. `beginMarkupPanGesture`
5. `continueMarkupPanGesture`
6. `endMarkupPanGesture`
7. `endMarkupPanGestureOnLeave`
8. `handleMarkupViewportWheel`

Why it matters:
1. This is a coherent viewport interaction domain with its own state, sizing, and terminal behavior.
2. It is a strong candidate for eventual extraction into a focused controller/hook because it already has a stable vocabulary: viewport, pan session, zoom slider, stage size.

### 2. Markup draw lifecycle
Includes:
1. `eraseMarkupStrokesAtPoints`
2. `beginMarkupDrawGesture`
3. `continueMarkupDrawGesture`
4. `endMarkupDrawGesture`
5. `endMarkupDrawGestureOnLeave`
6. `handleMarkupStagePointerTerminal`

Why it matters:
1. This is separate from viewport panning and should not stay interleaved forever.
2. It owns draw session semantics, eraser behavior, gesture history finalization, and global cursor cleanup.
3. This is likely the strongest next extraction-ready boundary.

### 3. Transform session lifecycle
Includes:
1. `endTransformPointerSession`
2. `handleMovePointerDown`
3. `handleMovePointerMove`
4. `handleMovePointerLeave`
5. move-tool reset/recenter history wiring

Why it matters:
1. This is a second strong controller boundary with its own session state and history semantics.
2. It is still coupled to selected layer state, transform history state, and drag-mode state, so extraction should happen only after its internal reset and baseline semantics are a little clearer.

### 4. History and undo/redo orchestration
Includes:
1. `commitTransformHistoryTransition`
2. `commitMarkupHistoryTransition`
3. `commitInpaintHistoryTransition`
4. undo/redo handlers
5. general reset handlers

Why it matters:
1. This area crosses move, markup, and inpaint behavior.
2. It is important orchestration code, but it is not yet the best first extraction target because it spans multiple domains.

### 5. Render-only panel and modal composition
Includes:
1. `renderMarkupControlsContent`
2. `renderMoveControlsContent`
3. modal panel render helpers
4. stage/render composition at the bottom of the component

Why it matters:
1. This is the eventual presenter split target.
2. It should likely follow controller separation, not precede it, because the render tree still depends on too many local interaction callbacks.

## Extraction Readiness Ranking
1. `Markup draw lifecycle`
   - Highest value next boundary.
   - Strong internal cohesion.
   - Clear state machine and terminal flow.
2. `Markup viewport and pan lifecycle`
   - Also strong, but still shares some coordination paths with draw routing.
   - Best taken either immediately after draw extraction or as part of a two-step markup interaction decomposition.
3. `Transform session lifecycle`
   - Good boundary, but slightly more coupled to cross-cutting layer/history concerns.
4. `Render-only panel and modal composition`
   - Valuable later, after interaction controllers are cleaner.
5. `History and undo/redo orchestration`
   - Defer until domain controllers are more isolated.

## Recommended Next Sequence
1. Stop taking generic helper seams.
2. Take one `B2-01` slice focused on the markup draw lifecycle as a bounded local controller extraction or controller-ready consolidation.
3. After that, take the markup viewport/pan lifecycle as the paired boundary.
4. Reassess whether the combined markup interaction domain can be moved behind a clearer internal abstraction.
5. Only then resume transform-session extraction and later render/presenter decomposition.

## Explicit Do-Not-Do List
1. Do not move more tiny one-off fragments into generic utility files unless they clearly satisfy the `3+` callsite or domain-boundary rule.
2. Do not extract render-only helpers that still drag large callback/state bundles with them.
3. Do not start a presenter split before the markup interaction domain is cleaner.
4. Do not continue micro-seams if they only produce single-digit hotspot reduction without improving the next real boundary.

## Immediate Next Slice Criteria
The next accepted `B2-01` seam should satisfy all of:
1. `local_consolidation` or `shared_extraction` classification is explicit up front.
2. It reduces hotspot complexity in the markup draw or markup viewport domain.
3. It makes a later module/hook extraction easier, not just smaller.
4. It preserves existing targeted tests and full Lane B gate bundle results.

## Alignment Note
1. This hotspot map is a process-control artifact, not a request for a broad rewrite.
2. It keeps the current no-regression lane workflow intact while shifting the next unit of progress from micro-cleanup to boundary preparation.
