# Enate Ende Canvas Runtime Performance Recovery Plan

Status: Lanes 1-5 implemented, locally validated, deployed, and re-audited in production; Lane 6 Canvas interaction backpressure is locally implemented and validated with deployment/runtime proof pending

Date: 2026-06-04

Launch target: 2026-07-07

Owner: Enate Ende

Scope: AI Studio right-rail Canvas responsiveness only.

Purpose: make the deployed Canvas feel fast, direct, and trustworthy for launch by correcting the root seams behind slow zoom, slow pan, and slow ghost dragging without adding new Canvas feature classes or forking the global right rail.

## Stop Condition For This Plan

This plan is complete when it provides a bounded implementation sequence that:

- keeps the Canvas on the canonical shared-scene plus per-viewport-camera contract
- explains the root causes behind slow pan, zoom, and ghost drag from runtime and code evidence
- separates Canvas-owned fixes from Quick Slot Inventory and Reference Grid ownership
- preserves project save and restore behavior for the full Canvas scene
- defines validation proof before and after each implementation lane
- avoids duplicate Canvas paths, hidden fallbacks, broad right-rail rewrites, or feature expansion before launch

## Current User-Facing Problem

After deployment, the right-rail Canvas feels unusably slow:

- wheel zoom does not visibly respond
- Space-drag and middle-drag panning feel broken or extremely slow
- dragging images, text, and videos with the ghost model is extremely laggy
- some items feel hard to select or inaccessible when they are clipped near the rail boundary

The goal is not to add Figma or Lucid-style features before launch. The goal is to make the current Canvas primitives feel immediate and reliable.

## Source Of Truth

Use these as the controlling sources for implementation:

1. `AGENTS.md`
2. `docs/agents/enate-ende/README.md`
3. `docs/agents/enate-ende/AGENTS.md`
4. `docs/agents/enate-ende/standard-operating-procedure.md`
5. `docs/adr/0083-create-mode-global-right-rail-authority.md`
6. `frontend/features/ai-studio/components/canvas/CANVAS_BEHAVIOR_MATRIX.md`
7. `frontend/features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState.ts`
8. `frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts`
9. `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx`
10. `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
11. `frontend/features/ai-studio/components/ReferenceGrid.tsx`
12. `frontend/features/ai-studio/reference-grid/logic/referenceGridPropsEquality.ts`

If this plan conflicts with current code or production behavior, re-audit and update the plan before implementing.

## Audit Evidence

Runtime production evidence from `https://www.shortpulse.ai/ai-studio` showed:

- the rail Canvas mounted with 8 Canvas items
- the rail viewport was only about 701 x 266 px in the inspected layout
- camera state was non-default: approximately `x=1333.76`, `y=991.76`, `zoom=0.803`
- coordinate scroll over the Canvas did not change `data-camera-zoom`
- Space-drag and middle-drag browser probes did not change camera state, with the caveat that browser automation may under-synthesize those exact gestures
- the right rail reported pressure telemetry: `data-grid-perf-degrade-level=2`, `data-grid-watchdog-input-stall-ms=293`, and `data-grid-watchdog-longtask-p95=206`
- Canvas, rail Canvas body, rail Canvas section, and inventory stack reported `contain: none`
- some Canvas item centers were outside the viewport or hit underlying page/rail elements rather than the Canvas item

Post-deploy production evidence from 2026-06-04 showed:

- the deployed production page now contains the Canvas containment signatures from Lanes 1-2: the rail Canvas section, body, and viewport report `contain: content`, the section and viewport report `isolation: isolate`, and the Canvas world reports `will-change: transform`
- wheel zoom now changes rail camera state on production, but small zoom gestures still took about 421-428 ms through the live UI, so the failure shifted from missing zoom behavior to unacceptable input latency
- Space-drag browser automation took about 1067-1070 ms and did not move the camera; this remains a pan reliability signal, with the caveat that browser automation may not hold Space exactly like a manual user gesture
- the right rail still reports worst-level pressure while Canvas is open: `data-grid-perf-degrade-level=2`, `data-grid-density-pressure-level=2`, input-stall readings around 303-328 ms, and long-task p95 readings around 209-225 ms
- the production Canvas had only 8 Canvas items, while the visible right rail still included dense Quick Slot Inventory and Reference Grid media cards, so Canvas latency must be treated as both Canvas render cost and sibling right-rail main-thread pressure

Code evidence showed:

- ghost dragging exists: `useCanvasViewportInstanceState.ts` schedules `itemDragPreview` frames and commits the real move on pointer release
- camera updates exist: `scheduleCameraFrame` batches pan and wheel zoom through `requestAnimationFrame`
- wheel zoom exists: `handleViewportWheel` resolves wheel delta and calls `zoomCanvasCameraAtViewportPoint`
- Space-pan and middle-drag exist: `shouldStartCanvasPanFromPointerDown` allows `button === 1` or left-drag while Space is active
- Space tracking ignores editable keyboard targets, so Space pressed while focus is in an input or textarea does not arm Canvas pan
- `railCanvasProps` is created from live `baseRailCanvasProps`, then expanded with export-drag handlers in `useAiStudioPageMediaReferenceRuntime.ts`
- `ReferenceGrid` is memoized, but `areReferenceGridPropsEqual` treats `railCanvasProps` by reference
- therefore camera and ghost-preview updates can invalidate the whole `ReferenceGrid` memo boundary
- `ReferenceGrid` then runs heavy right-rail scaffolding and controller work before rendering `ReferenceGridSections`
- CSS containment mode currently contains reference cards and virtual spacers, not the Canvas viewport/world or rail Canvas section

## Root-Cause Ranking

### P0: Canvas Motion Is Coupled To Heavy Right-Rail Rendering

Confidence: high.

Why it matters: every pan, zoom, or ghost movement updates Canvas state, which changes `railCanvasProps` by reference. Because `ReferenceGrid` compares `railCanvasProps` with `left === right`, Canvas movement can force the entire heavy right rail to rerender or re-run expensive controller scaffolding.

This is the most likely source of the extreme latency because production telemetry already shows long main-thread stalls.

Primary owner seams:

- `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
- `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- `frontend/features/ai-studio/reference-grid/logic/referenceGridPropsEquality.ts`
- `frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx`
- `frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts`

### P0: Canvas Lacks Its Own Render And Paint Isolation

Confidence: high.

Why it matters: the Canvas viewport and world use transforms, but runtime computed styles reported `contain: none` on the Canvas and rail section. The existing performance containment flag protects reference cards, not Canvas motion.

Primary owner seams:

- `frontend/styles/ai-studio-canvas-workspace.css`
- `frontend/styles/ai-studio-reference-grid-split.css`
- `frontend/styles/ai-studio-canvas.css`

### P1: Space-Pan Is Too Dependent On Current Keyboard Focus

Confidence: high.

Why it matters: the intended contract is Space-drag or middle-drag panning. Current tracking intentionally ignores Space when the keyboard target is an input, textarea, select, or contenteditable. If the composer or a Canvas text editor keeps focus, Space-drag can look broken even though the pointer code is present.

Primary owner seams:

- `frontend/features/ai-studio/components/canvas/useCanvasSpacePanTracker.ts`
- `frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts`
- `frontend/features/ai-studio/components/canvas/canvasViewportPointerTypes.ts`

### P1: Canvas Item Targetability Degrades Near Viewport Edges

Confidence: medium.

Why it matters: when items are clipped or camera-translated far away, item centers can fall outside the Canvas viewport or hit underlying page elements. This can make item dragging and detail access feel inconsistent.

Primary owner seams:

- `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx`
- `frontend/styles/ai-studio-canvas-workspace.css`
- `frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts`

### P2: Wheel Event Handling May Be Correct In Isolation But Fragile In Production Shell

Confidence: medium.

Why it matters: unit tests assert rail wheel zoom works, including rail wheel isolation, but deployed probing did not change zoom. The likely cause is not missing geometry. It is either event delivery under the full shell, main-thread saturation, or the rail-only native wheel listener interacting poorly with production event timing.

Primary owner seams:

- `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx`
- `frontend/features/ai-studio/components/canvas/useCanvasViewportInstanceState.ts`

## Non-Goals

Do not use this plan to add:

- connectors, arrows, frames, sticky notes, multiplayer presence, comments, templates, or workflow nodes
- a new Canvas persistence authority
- a new right-rail state authority
- per-workflow or per-mode Canvas forks
- broad Quick Slot Inventory or Reference Grid redesign
- broad file splitting that does not directly reduce Canvas runtime risk

## Protected Contracts

Every implementation lane must preserve:

- one global right rail across Standard, Pulse, and supported workflows
- one shared Canvas scene authority
- separate main and rail camera state
- ghost drag behavior: source item remains stable while the ghost moves, then the item commits on release
- item export drag behavior: Shift-drag starts native copy drag instead of moving the item
- project save and restore of the full durable Canvas scene
- Canvas behavior matrix contracts for pan, zoom, selection, drop, text edit, and delete

## Implementation Plan

### Lane 1: Prove And Isolate The Render Boundary

Goal: make Canvas motion stop dragging the heavy Reference Grid runtime through every frame.

Decision: this lane should be implemented first because it addresses the largest likely latency source without changing Canvas user behavior.

Tasks:

- add a targeted render-boundary test proving Canvas camera or ghost-preview changes do not cause `ReferenceGrid` card/controller recomputation when Quick Slot and Reference Grid props are otherwise stable
- split the rail Canvas render path into a memoized Canvas-only boundary inside `ReferenceGridSections` or an equivalent canonical right-rail section boundary
- avoid comparing live Canvas motion props inside the top-level `ReferenceGrid` equality if the rest of the right rail did not change
- keep the global right-rail authority intact; this is render isolation, not state isolation
- ensure Canvas drop ownership still works through the existing right-rail capture flow

Preferred implementation shape:

- introduce a small `RailCanvasSection` component under `frontend/features/ai-studio/reference-grid/components/`
- pass only Canvas section props into that component
- memoize inventory/card rendering separately from Canvas motion props
- keep `CanvasPropertiesPanel` as the Canvas renderer, not a duplicate Canvas implementation

Validation:

- targeted React test for no Reference Grid rerender/recompute on rail camera updates
- `npm -C frontend run test -- features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx`
- `npm -C frontend run test -- features/ai-studio/components/__tests__/ReferenceGrid.canvasSplit.test.tsx`
- runtime manual check on production after deploy: pan, zoom, and ghost drag should feel immediate at normal right-rail media density

Stop condition:

- Canvas camera and ghost-preview updates are Canvas-local for rendering purposes, and no right-rail authority fork was introduced

### Lane 2: Add Canvas-Specific Containment

Goal: reduce browser layout/paint cost during Canvas transforms.

Decision: do this after render isolation so CSS containment reinforces the correct boundary instead of masking a React ownership problem.

Tasks:

- add containment to the rail Canvas section/body where safe
- add containment to `canvas-workspace-viewport`
- add paint/layout isolation to `canvas-workspace-world` if it does not break drop, pointer, or transformed item behavior
- keep overflow clipping intentional so transformed items do not bleed into underlying workflow UI
- do not use containment that breaks item measurement, drag/drop hit testing, or media rendering

Candidate CSS direction:

- `contain: layout paint style` on Canvas viewport or Canvas rail body
- `isolation: isolate` on Canvas viewport
- preserve `overflow: hidden`, `touch-action: none`, and `overscroll-behavior: contain`

Validation:

- test or manual check for item selection, ghost drag, marquee, wheel zoom, and drop hit testing
- computed-style runtime check confirms Canvas containment is active
- no visual bleed outside the rail Canvas viewport

Stop condition:

- Canvas transform work has browser-level isolation and no hit-testing regression

### Lane 3: Make Pan Modifiers Reliable

Goal: make the user contract true: panning works with Space-drag or middle-drag.

Decision: keep plain left-drag as item move or marquee. Do not make ordinary empty-space drag pan because that would violate the current behavior matrix.

Tasks:

- audit focus behavior when the user clicks from the composer into Canvas
- preserve text input behavior: pressing Space inside a textarea must still type a space
- allow Space-pan to arm when the pointer is over or inside the Canvas surface even if the previous focused element was the composer
- ensure Space-pan works on empty viewport and on items
- ensure middle-drag works on empty viewport and on items
- add explicit tests for Space-pan after composer-like editable focus, without breaking text entry

Preferred implementation shape:

- keep `useCanvasSpacePanTracker` as the canonical modifier tracker
- add a Canvas-local pointer/focus arming path rather than a global key hack
- only treat Space as a pan modifier when Canvas is the active pointer surface or has focus

Validation:

- Space + left drag empty Canvas pans
- Space + left drag item pans instead of moving item
- middle drag empty Canvas pans
- middle drag item pans instead of moving item
- Space typed in prompt textarea still inserts a space

Stop condition:

- panning is reliable under realistic focus conditions and no text-input behavior regresses

### Lane 4: Tighten Wheel Zoom In The Full Shell

Goal: make wheel zoom visibly respond in the deployed right-rail Canvas.

Decision: do this after render isolation because zoom may already feel fixed once heavy rerenders stop. If zoom remains broken, handle the event seam directly.

Tasks:

- confirm whether real wheel events reach `CanvasPropertiesPanel` in production after render isolation
- reassess the rail-only native wheel listener that calls `preventDefault`
- keep rail wheel isolation: wheel in Canvas must not scroll the window or inventory
- ensure wheel zoom runs through one canonical handler, not parallel native and React zoom paths
- add or tighten tests for production-like rail nesting if the current tests are too isolated

Validation:

- wheel over Canvas changes `data-camera-zoom`
- zoom clamps between `0.2` and `2.5`
- zoom anchors around pointer location
- rail page/inventory does not scroll during Canvas zoom

Stop condition:

- deployed Canvas wheel zoom works and remains isolated from page scroll

### Lane 5: Improve Item Targetability And Camera Recovery

Goal: make items easy to select and move even when the Canvas camera is offset or items are near rail edges.

Decision: this is a usability hardening lane, not a new feature lane.

Tasks:

- audit whether current restored camera state can open with most items clipped or outside useful view
- add a low-risk camera recovery affordance only if needed, such as a tested reset-to-content behavior or safer initial restore bounds
- ensure item pointer capture remains stable during ghost drag
- ensure clipping does not let underlying workflow elements steal pointer targets from visible Canvas items
- consider increasing visible Canvas default split only if the current split makes normal interaction too constrained, and keep this separate from performance fixes

Validation:

- visible items are selectable by clicking the visible item body
- clipped items do not leak pointer ownership to underlying workflow UI
- ghost drag continues until release
- camera state restore remains faithful and does not silently rewrite saved camera state

Stop condition:

- normal visible Canvas items can be selected, dragged, and opened without accidental underlying-surface hits

### Lane 6: Production Proof Matrix

Goal: prove the fixes on the deployed production surface before calling the Canvas launch-ready.

Tasks:

- use `https://www.shortpulse.ai/ai-studio` as the browser validation surface
- test a right rail with Canvas, Quick Slot Inventory, and Reference Grid visible
- test with a media-dense project, not an empty fixture only
- test wheel zoom
- test Space-drag pan
- test middle-drag pan if browser/device supports it
- test image, video, and text ghost drag
- test item export drag with Shift
- test dropping Canvas items into workflows if the workflow target is in scope for that manual pass
- save and restore the project and confirm Canvas scene, item positions, and camera state restore

Pass threshold:

- pan and ghost drag feel immediate enough for normal creative work
- wheel zoom visibly responds within the gesture
- no obvious item teleporting, source-item movement during ghost drag, or cross-surface pointer stealing
- Quick Slot Inventory and Reference Grid remain usable after Canvas interaction
- project restore returns the full Canvas scene

Stop condition:

- production proof is decision-grade or remaining failures are captured with exact repro and owner seam

## Test Plan

Minimum test targets after implementation:

- `npm -C frontend run test -- features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx`
- `npm -C frontend run test -- features/ai-studio/components/canvas/__tests__/canvas.drop.test.tsx`
- `npm -C frontend run test -- features/ai-studio/components/__tests__/ReferenceGrid.canvasSplit.test.tsx`
- any new render-boundary test added for rail Canvas isolation
- `npm -C frontend run docs:check` after doc/index changes

Use `npm -C frontend run build` only at a meaningful checkpoint or before deploy readiness, not after every small patch.

## Rollback And Regression Rules

- If render isolation breaks Canvas drop routing, revert the isolation lane rather than adding a second drop route.
- If containment breaks hit testing, back out the specific containment rule and keep the React render boundary fix.
- If Space-pan support threatens textarea typing, preserve typing and redesign the Canvas arming rule.
- If wheel zoom still fails after render isolation, do not add a second zoom authority; fix the existing wheel event path.
- If any lane threatens project save or restore, stop and re-audit before continuing.

## Implementation Sequence

1. Render boundary isolation.
2. Canvas-specific containment.
3. Pan modifier reliability.
4. Full-shell wheel zoom hardening.
5. Item targetability and camera recovery.
6. Production proof matrix.

This sequence is intentional. It addresses the likely largest latency source first, then adds browser isolation, then fixes gesture reliability.

## Implementation Checkpoint

### Lane 1: Render Boundary Isolation

Status: implemented locally on 2026-06-04.

Completed source updates:

- `CanvasPropertiesPanel` can now consume a live Canvas props store through `useSyncExternalStore`, so Canvas motion can update the Canvas renderer without requiring the full right rail to receive a new `railCanvasProps` object every frame.
- `useAiStudioPageMediaReferenceRuntime` now stabilizes the right-rail Canvas props object with `useCanvasPropertiesPanelLivePropsBridge`, while publishing fresh camera, ghost-preview, handler, and item props into the Canvas-local store.
- A focused live-props bridge test covers camera updates and latest wheel handler delivery through the stable Canvas prop boundary.
- The page media reference runtime test now asserts that `railCanvasProps` identity stays stable while the live store publishes fresh camera state.

Validation completed:

- `npm -C frontend run test -- features/ai-studio/components/canvas/__tests__/canvas.livePropsBridge.test.tsx features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx features/ai-studio/components/__tests__/ReferenceGrid.canvasSplit.test.tsx features/ai-studio/hooks/__tests__/useAiStudioPageMediaReferenceRuntime.test.ts`
- `npm -C frontend run type-check:touched`

Stop boundary:

- Stop here before Lane 2 unless explicitly continuing from this checkpoint. The next plan lane is Canvas-specific containment.

### Lane 2: Canvas-Specific Containment

Status: implemented locally on 2026-06-04.

Completed source updates:

- The right-rail Canvas section and Canvas body now use `contain: layout paint style`, with `isolation: isolate` on the section, so Canvas transform work has a browser-level boundary from the rest of the right rail.
- The Canvas viewport now uses `contain: layout paint style` and `isolation: isolate` while preserving `overflow: hidden`, `touch-action: none`, and `overscroll-behavior: contain`.
- The transformed Canvas world now has `will-change: transform` but deliberately does not use paint containment, because Canvas items can live outside the viewport coordinate box and must be brought into view by the camera transform.
- The Canvas interaction test now includes a CSS contract assertion for the containment selectors.

Validation completed:

- `npm -C frontend run test -- features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx features/ai-studio/components/canvas/__tests__/canvas.drop.test.tsx features/ai-studio/components/__tests__/ReferenceGrid.canvasSplit.test.tsx features/ai-studio/reference-grid/components/__tests__/ReferenceGridSections.test.tsx`
- `npm -C frontend run type-check:touched`

Stop boundary:

- Lane 2 has local test proof for hit-testing-sensitive Canvas behavior and CSS contract proof for containment. Production computed-style proof remains pending until deploy/runtime validation. The next plan lane is Pan modifier reliability.

### Lane 3: Pan Modifier Reliability

Status: implemented locally on 2026-06-04.

Completed source updates:

- `useCanvasSpacePanTracker` now tracks the physical Space key even when the keydown target is an editable control, so a subsequent Canvas pointer gesture can still become Space-pan.
- Editable keyboard targets still receive normal Space typing because the tracker continues to avoid `preventDefault()` for input, textarea, select, and contenteditable targets.
- Plain left-drag behavior remains unchanged; panning still requires Space-drag or middle-drag.
- The Canvas interaction test now covers the realistic composer-focus case: Space keydown from a textarea is not prevented, then dragging on the Canvas pans the camera.

Validation completed:

- `npm -C frontend run test -- features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx features/ai-studio/components/canvas/__tests__/canvasInteractionController.test.ts`
- `npm -C frontend run test -- features/ai-studio/components/canvas/__tests__/canvas.livePropsBridge.test.tsx features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx features/ai-studio/components/canvas/__tests__/canvas.drop.test.tsx features/ai-studio/components/__tests__/ReferenceGrid.canvasSplit.test.tsx features/ai-studio/reference-grid/components/__tests__/ReferenceGridSections.test.tsx features/ai-studio/hooks/__tests__/useAiStudioPageMediaReferenceRuntime.test.ts`
- `npm -C frontend run type-check:touched`

Stop boundary:

- Lane 3 has local proof that Space-drag can pan after editable focus while preserving textarea Space typing. Production/manual gesture proof remains pending until deploy/runtime validation. The next plan lane is Full-shell wheel zoom hardening.

### Lane 4: Full-Shell Wheel Zoom Hardening

Status: implemented locally on 2026-06-04.

Completed source updates:

- Canvas wheel handling now uses one canonical viewport-native wheel listener instead of splitting responsibility between a native rail listener for scroll prevention and React `onWheel` for zoom.
- `CanvasPropertiesPanel` routes native wheel events through the existing page-owned `onViewportWheel` handler via a ref, so the listener stays stable while still using the latest Canvas controller handler.
- The shared Canvas contract now defines the minimal wheel event shape needed by the controller instead of requiring React's synthetic wheel event type.
- The existing zoom controller remains the only zoom authority; no fallback zoom path was added.

Validation completed:

- `npm -C frontend run test -- features/ai-studio/components/canvas/__tests__/canvas.livePropsBridge.test.tsx features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx`
- `npm -C frontend run test -- features/ai-studio/components/canvas/__tests__/canvas.livePropsBridge.test.tsx features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx features/ai-studio/components/canvas/__tests__/canvas.drop.test.tsx features/ai-studio/components/__tests__/ReferenceGrid.canvasSplit.test.tsx features/ai-studio/reference-grid/components/__tests__/ReferenceGridSections.test.tsx features/ai-studio/hooks/__tests__/useAiStudioPageMediaReferenceRuntime.test.ts`
- `npm -C frontend run type-check:touched`

Stop boundary:

- Lane 4 has local proof that wheel zoom still changes camera zoom, uses the latest live handler, and prevents rail wheel scroll propagation. Production/manual wheel proof remains pending until deploy/runtime validation. The next plan lane is Item targetability and camera recovery.

### Lane 5: Item Targetability And Camera Recovery

Status: implemented as local hardening proof on 2026-06-04.

Completed source updates:

- Added a regression test proving an item ghost drag continues and commits even when move/release events land on the Canvas viewport instead of the original item element. This protects the existing controller fallback path for clipped-edge or imperfect pointer-capture scenarios.
- Re-audited pointer capture and release handling for item drag, pan, text resize, pointer cancel, and viewport fallback paths.
- Re-audited camera restore behavior and intentionally did not add hidden camera reset or auto-fit behavior, because silently rewriting restored camera state would violate the protected save/restore contract.
- Confirmed compact Canvas split coverage remains in `ReferenceGrid.canvasSplit.test.tsx`.

Validation completed:

- `npm -C frontend run test -- features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx`
- `npm -C frontend run test -- features/ai-studio/components/canvas/__tests__/canvas.livePropsBridge.test.tsx features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx features/ai-studio/components/canvas/__tests__/canvas.drop.test.tsx features/ai-studio/components/__tests__/ReferenceGrid.canvasSplit.test.tsx features/ai-studio/reference-grid/components/__tests__/ReferenceGridSections.test.tsx features/ai-studio/hooks/__tests__/useAiStudioPageMediaReferenceRuntime.test.ts features/ai-studio/logic/__tests__/sessionSnapshotCanvas.test.ts`
- `npm -C frontend run type-check:touched`

Stop boundary:

- Lane 5 has local proof for visible-item drag continuity and save/restore camera preservation. Production/manual targetability proof remains pending until deploy/runtime validation. The next plan lane is the Production Proof Matrix.

### Pre-Production Local Gate

Status: passed locally on 2026-06-04.

Validation completed:

- `npm -C frontend run build`

Stop boundary:

- The implementation passes the broad local production build gate. The remaining plan work is deploy/runtime Production Proof Matrix validation on `https://www.shortpulse.ai/ai-studio`; do not mark the plan complete from local proof alone.

### Lane 6: Canvas Interaction Backpressure

Status: implemented locally on 2026-06-04 after deployed production proof still showed severe latency; deployment/runtime proof remains pending.

Goal:

- when the user is actively zooming, panning, or dragging in the rail Canvas, dense sibling media work in Quick Slot Inventory and Reference Grid must yield frame budget to Canvas input
- use the existing right-rail background-visual-work suspension authority instead of adding a second media throttling system or a duplicate Canvas implementation

Current source update:

- `CanvasPropertiesPanel` now emits an optional `onInteractionActiveChange` signal during pointer gestures and wheel gestures
- `ReferenceGrid` wires that signal into `useReferenceGridRuntimeScaffold`
- `useReferenceGridRuntimeScaffold` now includes rail Canvas interaction in `suspendBackgroundVisualWork`, which is already consumed by autoplay selection, preview runtime scheduling, hydration queue suspension, visual telemetry suspension, and autoplay budget recomputation
- production-inspectable attrs were added: `data-rail-canvas-interaction-active` and `data-grid-background-visual-work-suspended`

Validation completed:

- `npm -C frontend run test -- features/ai-studio/components/__tests__/ReferenceGrid.canvasSplit.test.tsx`
- `npm -C frontend run test -- features/ai-studio/components/canvas/__tests__/canvas.livePropsBridge.test.tsx features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx`
- `npm -C frontend run test -- features/ai-studio/components/canvas/__tests__/canvas.livePropsBridge.test.tsx features/ai-studio/components/__tests__/ReferenceGrid.canvasSplit.test.tsx features/ai-studio/components/canvas/__tests__/canvas.interactions.test.tsx`
- `npm -C frontend run type-check:touched`
- `npm -C frontend run docs:check`
- `npm -C frontend run build`

Stop boundary:

- continue only to validate type safety/build and, after deployment, production-runtime proof that Canvas input flips the suspension attrs and improves perceived zoom/pan/drag latency. If production still lags, the next canonical investigation is imperative transient Canvas camera/ghost rendering, not more right-rail patches.

## Self-Audit

This plan avoids patch-on-patch work because it starts at the render ownership seam instead of tuning pointer math first.

This plan avoids duplicate Canvas paths because `CanvasPropertiesPanel`, `useCanvasViewportInstanceState`, and the shared-scene contract remain canonical.

This plan avoids adjacent right-rail sprawl because Quick Slot Inventory and Reference Grid remain shared surfaces; Enate may touch the render boundary only to prevent Canvas motion from forcing unrelated heavy work.

This plan protects launch value because every lane is tied to the current user-visible failures: slow zoom, slow pan, slow ghost drag, and unreliable Canvas targetability.

## Ready-To-Begin Condition

Implementation may begin when the user asks to start this plan. The first implementation lane should be Lane 1 only, and it should stop after render-boundary validation before moving to Lane 2.
