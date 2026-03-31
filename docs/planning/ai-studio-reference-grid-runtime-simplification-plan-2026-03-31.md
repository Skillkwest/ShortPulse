# AI Studio Reference Grid Runtime Simplification Plan (2026-03-31)

Purpose: define the narrow simplify/rebuild lane for the AI Studio reference runtime after the March 2026 freeze investigation. This is an active-lane execution spec, not a new broad architecture program.

## Resume Handles
Use these exact phrases when you want an agent to find this lane again quickly:
- `AI Studio Reference Grid runtime`
- `AI Studio reference grid freeze lane`
- `reference grid runtime simplification`
- `reference grid freeze investigation`
- `reference grid preview runtime`
- `ReferenceGrid runtime plan`

Preferred short handles:
- `ai studio ref-grid runtime`
- `ref-grid freeze lane`
- `ref-grid runtime plan`

## Status
- Status: paused after successful UX validation
- Current posture: major freeze lane complete enough to stop; further work is optional follow-up, not active required execution
- Resume rule: do not reopen this lane by adjacency; only resume if the heavy AI Studio flow becomes materially bad again or a new measured hotspot clearly justifies more work

## Stop Point
The March 2026 freeze lane stopped after:
- preview-runtime ownership was simplified
- scroll/virtual-metrics churn was reduced
- visible-output map churn was reduced
- temporary incident diagnostics were removed from the hot path

Observed outcome before closeout:
- the original runaway `ReferenceGrid` rerender shape was materially reduced
- real heavy-flow UX validation looked acceptable

## Re-entry Notes
If this lane reopens later:
1. start by reading this plan
2. search using the resume handles above
3. add fresh targeted diagnostics for the current incident instead of assuming the old counters still exist
4. remeasure first, then decide whether the next lane is:
   - preview/runtime churn
   - virtualization churn
   - boundary churn
   - or a different issue entirely

Do not assume the next unfinished phase in this file is automatically the correct next step; re-entry must be evidence-led.

## Scope
- In scope:
  - `frontend/features/ai-studio/components/ReferenceGrid.tsx`
  - `frontend/features/ai-studio/reference-grid/controllers/*`
  - `frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioReferenceGridProps.ts`
  - minimal wrapper/boundary cleanup in `AiStudioReferenceRail`, `AiStudioShellFrame`, and `AiStudioPageContent` when it directly reduces reference-lane coupling
- Out of scope:
  - Media Library runtime rebuild
  - generation control-plane / canonical-output redesign
  - broad AI Studio state-domain redesign
  - speculative UX redesign outside the reference lane

## Why This Lane Exists
The freeze investigation established three facts:
1. Broad output-store invalidation was real and has already been reduced.
2. Upstream page/shell churn was real and has partially been reduced.
3. The remaining dominant complexity sits inside the `ReferenceGrid` runtime itself.

The current reference runtime still composes too many concerns in one hot surface:
- output selection and projection
- viewport virtualization
- quick-slot / all-refs ownership
- image hydration queue + decode runtime
- loading visual policy
- video lifecycle + autoplay
- split-pane geometry
- drag/drop + clipboard
- telemetry/debug instrumentation

The goal is to keep user-visible behavior while reducing the number of runtime owners and the amount of state churn inside the reference lane.

## Locked Constraints
1. This plan must stay narrow and tied to the active runtime problem.
2. Keep the current user-visible reference workflows unless a later explicit product decision changes them.
3. Do not reopen Media Library or generation-pipeline lanes through adjacency.
4. Each phase must either:
   - reduce a measured source of churn, or
   - remove a clearly duplicated runtime owner without increasing product risk.

## Product Behaviors To Preserve
- Quick Slot Inventory and Reference Grid both remain available.
- Duplicate suppression between Quick Slot and All Refs remains intact.
- Active output priority remains intact.
- Loading, retry, failure, and success card behavior remain intact.
- Visible-first hydration remains intact.
- Video autoplay remains bounded, viewport-gated, and detachable.
- Drag/drop, reorder, clipboard, and detail-opening flows remain intact.

## Complexity To Reduce
### Essential complexity to keep
- virtualization and visible-first work
- ownership/dedupe across surfaces
- bounded preview delivery
- bounded video attach budget
- failure/loading UI contracts

### Accidental complexity to reduce
- hydration spread across multiple controllers
- autoplay split across multiple controllers
- repeated projection/model-building layers
- three nested split systems in one hot surface
- debug/incident counters in the main runtime path
- wrapper/alias clutter around the reference-lane contract

## Target Runtime Shape
### 1. `ReferenceGridShell`
Owns layout only:
- quick-slot/all-refs section structure
- optional styles/canvas embedding
- panel open/collapse state
- refs for scroll containers and section roots

Does not own:
- preview runtime
- video runtime
- card-model derivation

### 2. `useReferenceGridSurfaceModel`
One derived model layer for:
- visible quick-slot cards
- visible all-refs cards
- near-viewport candidates
- active-output projection
- ownership/dedupe decisions

This replaces much of the current chained projection layering across ids, outputs, media outputs, and card items.

### 3. `useReferenceGridPreviewRuntime`
One owner for:
- hydration candidate selection
- image decode queue
- hydrated preview state
- loaded state
- loading visual state
- fallback preview handling

This replaces the current multi-hook hydration/loading mesh.

### 4. `useReferenceGridVideoRuntime`
One owner for:
- visible video tracking
- autoplay-enabled id selection
- attach budget
- detach timing
- node registration lifecycle

This replaces the current autoplay/video controller split.

### 5. `ReferenceGridInteractions`
One interaction boundary for:
- drag/drop routing
- clipboard/paste
- reorder and selection callbacks

This stays separate from rendering/runtime ownership.

## Execution Phases
### Phase 0: Contract Lock
Goal:
- define the exact ownership boundary before behavior-changing refactors

Deliverables:
- explicit keep/cut/split inventory for the reference lane
- target hook/module map
- validation bundle for each later phase

Entry criteria:
- current freeze investigation packet accepted as baseline

Exit criteria:
- all later phases have a declared ownership move and regression target

### Phase 1: Preview Runtime Consolidation
Goal:
- merge hydration/loading into one runtime owner

Absorb or replace:
- `useReferenceGridHydrationQueueController`
- `useReferenceGridImageHydrationController`
- `useReferenceGridLoadedMediaController`
- `useReferenceGridLoadingVisualController`

Target output:
- stable per-card preview state
- bounded decode/hydration runtime
- loading/failure visual state derived in one place

Why first:
- highest internal complexity cluster
- highest likelihood of reducing runtime churn without product-visible change

### Phase 2: Video Runtime Consolidation
Goal:
- merge autoplay/video lifecycle into one runtime owner

Absorb or replace:
- `useReferenceGridAutoplayBudgetController`
- `useReferenceGridAutoplaySelectionController`
- `useReferenceGridVideoLifecycleController`
- `useReferenceGridAutoplayEventController` where still justified

Target output:
- one bounded visible-video runtime
- one source of truth for attach/detach and enabled ids

### Phase 3: Surface Model Consolidation
Goal:
- replace the current projection chain with one derived card model per surface

Absorb or replace portions of:
- `useReferenceGridViewportProjectionController`
- `useReferenceGridSurfaceOwnershipController`
- `useReferenceGridResolvedMediaController`
- `useReferenceGridCardItemsController`

Target output:
- `quickSlotCards`
- `allRefsCards`
- `nearViewportCards`
- `activeCard`

### Phase 4: Boundary Cleanup
Goal:
- reduce reference-lane contract clutter after runtime consolidation

Candidates:
- simplify `useAiStudioReferenceGridProps`
- remove deprecated alias/wrapper clutter in `AiStudioPageContent`
- collapse forwarding layers only if they no longer justify themselves

Rule:
- do not treat wrapper cleanup as a standalone architecture project

### Phase 5: Split/Layout Decision Gate
Goal:
- decide whether current nested split behavior is worth preserving

Questions:
- should Quick Slot vs All Refs remain the only full interactive split?
- should Styles remain a simpler collapsible section instead of a peer split?
- should Canvas stay embedded in this lane or be downgraded to a simpler section?

This phase is a product/UX decision gate, not an automatic refactor.

### Phase 6: Telemetry Cleanup
Goal:
- remove or isolate temporary incident instrumentation from the hot path

Keep:
- durable perf telemetry with clear operational value

Remove or isolate:
- freeze-investigation counters that only served the current incident

## Sequencing Rules
1. Phase 1 before Phase 2.
2. Phase 2 before Phase 3.
3. Phase 3 before broad wrapper cleanup.
4. Phase 5 only after runtime consolidation has stabilized.
5. Stop after any phase if the next change is no longer clearly reducing risk more than it adds churn.

## Validation Contract
Every implementation phase must include:
- targeted tests for touched areas
- `cd frontend && npx tsc --pretty false --noEmit`
- focused hot-path remeasurement in a real AI Studio generation session

Minimum preserved behaviors to verify:
- quick-slot reorder/drop
- duplicate suppression
- active output behavior
- loading/failure/retry UI
- bounded autoplay behavior
- styles/canvas visibility behavior if touched

## Measurement Contract
During the original March 2026 incident, freeze-investigation counters were used as the short-term perf contract.

Current posture:
- those temporary diagnostics were removed at closeout
- future re-entry should add fresh targeted diagnostics that match the current incident

At minimum compare:
- `referenceGrid.render`
- `referenceRail.render`
- `pageContent.render`
- `referenceGrid.internalChange.imageHydrationState`
- `referenceGrid.internalChange.virtualMetrics`
- `referenceGrid.internalChange.visibleOutputById`
- any new phase-specific runtime counters added intentionally for the phase

## Risks
1. Duplicate suppression regressions between Quick Slot and All Refs.
2. Loading-state flicker regressions during preview runtime consolidation.
3. Active-output priority regressions.
4. Video detach/attach regressions during autoplay runtime consolidation.
5. Split-layout regressions if layout simplification is mixed too early with runtime consolidation.

## Stop Criteria
This lane is complete when all are true:
1. Hot generation sessions no longer threaten browser responsiveness.
2. The reference lane has a small number of explicit runtime owners.
3. Remaining issues are normal tuning or UX choices, not architectural churn.
4. Temporary incident instrumentation can be removed or isolated safely.

## Immediate Next Action
Start with Phase 1.

Concrete first implementation target:
- design and build `useReferenceGridPreviewRuntime`
- migrate one slice at a time from the current hydration/loading controllers into that runtime
- preserve current loading/failure UX
- remeasure before touching autoplay/video runtime
