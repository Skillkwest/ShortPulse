# AI Studio Right-Rail Performance Master Plan (2026-03-23)

Last updated: 2026-03-24  
Status: Completed (`done_required_scope`)  
Owner: AI Studio Engineering  
Canonical closeout docs: `docs/planning/ai-studio-right-rail-performance-scope-contract-2026-03-23.md`, `docs/planning/ai-studio-right-rail-performance-tracker-2026-03-23.md`  
Tracker anchor: `docs/planning/ai-studio-right-rail-performance-master-tracker-2026-03-23.md`  
Implementation entry checklist: `docs/archive/planning/ai-studio-right-rail-performance-implementation-entry-checklist-2026-03-23.md`  
Readiness state: `docs/planning/ai-studio-right-rail-performance-readiness-state-2026-03-23.md`  
ADR anchor: `docs/adr/0049-ai-studio-right-rail-surface-ownership-and-media-resolution-contract.md`

## Summary
This plan defines the scoped execution contract for AI Studio right-rail performance work so implementation can continue without drifting into broad Reference Grid churn or speculative micro-optimization. The required scope is now complete and closed.

This document is retained as supporting execution history. The canonical closeout entry points for this completed scope are the scope contract and compact tracker listed above.

Primary intent:
1. Keep the right rail fast and predictable for the surfaces users interact with directly.
2. Centralize duplicated policy instead of repeating performance rules across multiple controllers.
3. Stop implementation when the remaining work is profiling-driven or optional instead of continuing by momentum.

## Program Objectives
1. Make right-rail drops route to the intended target surface consistently.
2. Ensure Quick Slot owns duplicate-surface priority over All Refs.
3. Share right-rail media resolution policy across hot paths instead of recomputing it per controller.
4. Preserve immediate-feeling first paint for newly inserted right-rail media.
5. Define a clear done state and stop condition for this scope.

## Scope Lock
In scope:
1. AI Studio right-rail `Reference Grid`, `Quick Slot Inventory`, and `rail Canvas`.
2. Drag/drop correctness, first-paint speed, duplicate-work reduction, and bounded hot-path media work for those surfaces.
3. Targeted tests, tracker updates, and ADR updates required to keep the scope coherent.

Out of scope:
1. Broad Media Library architecture or list-query redesign.
2. Unrelated AI Studio panels and unrelated Expert Edit work.
3. Global adaptive-media redesign outside the right rail.
4. Speculative micro-optimizations without a concrete repo-backed bottleneck.

## Done State / Exit Criteria
Required:
1. No known right-rail drop path routes to the wrong surface.
2. Duplicate-surface ownership is centralized and Quick Slot is primary when the same output appears in Quick Slot and All Refs.
3. Right-rail preview/full/fallback resolution is shared across visible-card and hydration hot paths.
4. Newly inserted image cards can paint without waiting for hydration completion.
5. Targeted tests cover drag/drop routing, duplicate ownership, and hot-path media resolution behavior.
6. The next remaining work is either profiling-driven or explicitly optional.

Optional:
1. Further image-hydration queue tuning after profiling.
2. Additional shell drag micro-optimizations if a measured bottleneck remains.
3. Telemetry/perf harness expansion beyond the current targeted validation bundle.

## Decision Locks
1. Right-rail work is limited to concrete user-facing problems on `Reference Grid`, `Quick Slot Inventory`, and `rail Canvas`.
2. Prefer shared controllers and shared policy seams over adding new per-surface conditionals.
3. Shell drag/drop capture may assist routing, but the concrete target surface remains authoritative.
4. Quick Slot owns duplicate loading, hydration, and warmup priority over duplicate All Refs copies.
5. Right-rail preview/full/fallback resolution must be computed from one shared contract, not re-derived independently in each consumer.
6. No further right-rail optimization starts without either:
   - an unmet required tracker row, or
   - a measured/proved bottleneck that is a better use of time than stopping.

## Research Inputs
1. React `useMemo` guidance: use caching for noticeably expensive recalculations with stable dependencies, and only as a performance optimization, not as correctness scaffolding.  
   Source: `https://react.dev/reference/react/useMemo`
2. MDN `DataTransfer.getData()` guidance: drag data is safe to read during `dragstart` and `drop`; during other events the data should be treated as unavailable even though formats can still be enumerated.  
   Source: `https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/getData`
3. web.dev virtualization guidance: long interactive lists should render only the visible window rather than keeping the entire list mounted.  
   Source: `https://web.dev/articles/virtualize-long-lists-react-window`

## Execution Lanes
### Lane A: Surface Contract
Scope:
1. Right-rail target routing.
2. Duplicate-surface ownership.
3. Drop target correctness between rail Canvas, Quick Slot, and Reference Grid.

Current repo-backed progress:
1. Right-rail drop routing and target bypass behavior have already been tightened in implementation.
2. Duplicate-surface ownership is now centralized in `useReferenceGridSurfaceOwnershipController`.

Exit:
1. `RRP-M02` and `RRP-M03` complete.

### Lane B: Media Work Contract
Scope:
1. Shared right-rail media resolution.
2. First-paint and hydration interaction.
3. Residual hot-path image/video work only when tied to a clear bottleneck.

Current repo-backed progress:
1. Shared media resolution now lives in `useReferenceGridResolvedMediaController`.
2. Card derivation and hydration queueing now consume the shared resolver rather than recomputing policy separately.

Exit:
1. `RRP-M04` and `RRP-M05` complete.

### Lane C: Validation And Stop Gates
Scope:
1. Track required vs optional work explicitly.
2. Prevent continuation once only optional or profiling-driven work remains.
3. Keep implementation slices bound to targeted validation and immediate checkpoint commits.

Exit:
1. `RRP-M06` through `RRP-M08` complete.

## Sequencing Rules
1. Lane A required rows must stay green before new Lane B work starts.
2. Lane B changes must not widen scope into Media Library or unrelated adaptive-media programs.
3. Lane C rows decide whether implementation continues or stops.
4. If the next proposed slice cannot point to a specific open required tracker row or measured bottleneck, implementation stops.

## Current Repo-Backed Progress Snapshot
Completed or materially advanced in current repo state:
1. `a9bea956` `Improve AI Studio right-rail drop routing`
2. `8c261d92` `Share cached drag transfer hints across right rail`
3. `bad386cf` `Consolidate reference-grid duplicate surface ownership`
4. `3f484597` `Share reference-grid media resolution across hot paths`
5. `59a8c012` `Add AI Studio right-rail performance scope docs`
6. `33554d4f` `Close AI Studio right-rail scope`

Primary implementation seams now aligned to this plan:
1. `frontend/features/ai-studio/components/ReferenceGrid.tsx`
2. `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridSurfaceOwnershipController.ts`
3. `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`

## Validation Bundle
Per planning update:
1. `npm -C frontend run docs:check`

Per implementation slice:
1. Run only the targeted right-rail test suites for touched seams.
2. Commit immediately after the slice is green.
3. Update tracker status and stop-state reasoning before continuing.

## Stop Rule
Stop implementation for this scope when all required tracker rows are complete and the next remaining work is optional or depends on new profiling evidence.
