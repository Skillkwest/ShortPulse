# AI Studio Divider Drag Latency Execution Plan

Status: execution-ready  
Owner: Latency  
Last updated: 2026-06-04

## Objective

Eliminate the severe visible lag when dragging:

- the vertical divider between the workflow panel and the right rail, and
- the horizontal dividers inside the right rail between `Canvas`, `Quick Slot Inventory`, `Reference Grid`, and `Styles`

when the current AI Studio project has a medium-to-large persisted `Reference Grid`.

This plan is preserve-behavior only. The implementation must not introduce UI, UX, layout, styling, design, or product-semantics changes beyond removing the drag lag.

## Planning Stop Condition

This planning lane is complete when:

1. the owning performance seam is chosen and justified from current repo truth,
2. the exact implementation files and signal flow are mapped,
3. the implementation phases, validations, proof path, and stop conditions are explicit,
4. rejected alternative approaches are documented so implementation does not drift, and
5. the next best action is implementation rather than more planning.

If all five are true, stop planning and begin implementation from `Phase 0`.

## Implementation Stop Condition

The implementation lane is complete only when all of the following are true:

1. dense-project divider dragging is visibly smoother for both the vertical shell divider and the right-rail horizontal dividers,
2. divider behavior still feels live and preserves current interaction semantics,
3. `Reference Grid`, `Quick Slot Inventory`, and `Canvas` remain global right-rail surfaces under `docs/adr/0083-create-mode-global-right-rail-authority.md`,
4. resize-session changes are covered by narrow regression validation and a dedicated divider-drag proof pass, and
5. no blocking regressions remain in project restore, quick-slot behavior, canvas visibility, preview loading, autoplay, hydration, autosave, or archive behavior.

Stop and report instead of continuing when:

- the next candidate requires visible UX change to succeed,
- the next change would rewrite right-rail ownership rather than fix the canonical seam,
- validation shows a restore, hydration, or media regression that must be fixed before additional work,
- or the remaining proof gap is production-auth-only and local proof is already sufficient for implementation correctness.

## Source Of Truth

Primary sources:

- [docs/planning/shortpulse-latency-launch-plan-2026-07-07.md](./shortpulse-latency-launch-plan-2026-07-07.md)
- [docs/adr/0083-create-mode-global-right-rail-authority.md](../adr/0083-create-mode-global-right-rail-authority.md)
- [docs/agents/latency/standard-operating-procedure.md](../agents/latency/standard-operating-procedure.md)

Owning code seams:

- [frontend/features/ai-studio/hooks/useAiStudioShellResize.ts](../../frontend/features/ai-studio/hooks/useAiStudioShellResize.ts)
- [frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts](../../frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts)
- [frontend/features/ai-studio/components/ReferenceGrid.tsx](../../frontend/features/ai-studio/components/ReferenceGrid.tsx)
- [frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts)
- [frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts)
- [frontend/features/ai-studio/reference-grid/controllers/useReferenceGridViewportProjectionController.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridViewportProjectionController.ts)
- [frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardItemsController.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardItemsController.ts)
- [frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx)

## Explicit Non-Goals

- Do not redesign divider UX.
- Do not convert live drag into a ghost-divider-only interaction unless the chosen preserve-behavior strategy fails.
- Do not fork `Reference Grid`, `Quick Slot Inventory`, or `Canvas` into per-workflow state.
- Do not use this lane for general CSS cleanup, right-rail refactors, or layout polish.
- Do not broaden into startup, pricing, billing, or non-divider latency work.
- Do not use Supabase image transformations.

## Current Repo Truth

### Proven symptom shape

- New or sparse projects drag smoothly.
- Medium-to-large persisted projects with many `Reference Grid` items drag poorly.
- The lag happens on both the vertical shell divider and the right-rail horizontal dividers.

### Proven owning seam

The divider hooks themselves are simple live-state handlers:

- vertical shell drag updates width on every `pointermove` in [useAiStudioShellResize.ts](../../frontend/features/ai-studio/hooks/useAiStudioShellResize.ts)
- horizontal right-rail drag updates top-ratio on every `pointermove` in [useReferenceGridHorizontalSplit.ts](../../frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts)

The dominant cost appears after those state updates:

1. live size change reaches `ResizeObserver`-driven metric sync in [useReferenceGridVirtualMetricsController.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts)
2. metric changes recompute viewport windows and visible-id slices in [useReferenceGridViewportProjectionController.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridViewportProjectionController.ts)
3. visible-card derivation rebuilds in [useReferenceGridCardItemsController.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardItemsController.ts)
4. rendered card node arrays rebuild in [useReferenceGridCardRenderController.tsx](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx)
5. hydration queue, autoplay, and preview telemetry also participate in the same active surface

### Important repo-specific finding

The repo already has a partial “pause expensive visual work” lane through `suspendBackgroundVisualWork`, but that suspension currently gates:

- autoplay selection
- hydration queue scheduling
- preview swap telemetry
- autoplay budget maintenance

It does not gate the main resize-to-virtual-metrics-to-card-render cascade that appears to dominate divider drag lag.

### Important secondary finding

The vertical shell divider also writes width to `localStorage` whenever width state changes. This is real main-thread work, but it does not explain the dense-project dependency. Treat it as a secondary cleanup inside the same lane, not the primary fix.

### Already-rejected primary explanations

- `Studio Preview` as primary cause: rejected. It is comparatively lightweight and does not own a similar resize-observer projection pipeline.
- `Canvas` as primary cause: rejected. Canvas may add some paint cost, but it does not own the dominant dense-grid resize cascade.
- containment-only fix: rejected. The grid already has containment-mode styling; containment alone is not sufficient.

## Chosen Strategy

### Decision

Implement a unified `resize-session freeze` for the dense `Reference Grid` runtime:

1. keep divider movement live,
2. detect when any relevant shell or right-rail divider is actively being dragged,
3. while a dense grid is present, suspend the expensive resize-triggered grid recompute path during the drag session,
4. resume with one authoritative recompute when the drag ends,
5. persist vertical shell width only after the drag ends rather than on every drag tick.

### Why this is the best fit

- It fixes the owning seam rather than adding a workaround.
- It matches the symptom shape: dense grid work is the differentiator.
- It uses an existing repo pattern: runtime suspension already exists and can be extended instead of inventing a parallel model.
- It preserves live divider interaction better than a ghost-divider-only strategy.
- It is lower risk than quantizing layout math or rewriting virtualization behavior.

## Rejected Alternative Strategies

### Alternative 1: ghost divider, commit only on release

Why rejected as the first-choice plan:

- largest behavior change risk
- more likely to feel like a new divider interaction instead of a performance fix
- unnecessary if a preserve-behavior freeze solves the issue

Fallback rule:

- only escalate to this if the chosen resize-session freeze cannot reach acceptable smoothness without visible regressions

### Alternative 2: quantized live recompute

Why rejected as the first-choice plan:

- more subtle correctness risk in row/column/scroll-anchor math
- easier to introduce “almost right” bugs in virtual metrics
- harder to reason about autonomously than a simple suspend-and-resync model

### Alternative 3: more memoization or `startTransition` only

Why rejected:

- parent shell rerenders are not the dominant seam
- the main cost is layout-driven grid runtime churn, not ordinary React rerender noise

## Preserve-Behavior Invariants

Non-negotiable implementation rules:

- Keep current divider affordances, live drag semantics, labels, keyboard behavior, and layout structure.
- Do not change the meaning of `Quick Slot Inventory`, `Reference Grid`, `Canvas`, or `Styles`.
- Do not change restore authority, archive behavior, visible item ordering, or quick-slot ordering.
- Do not change media loading authority, preview security, or autoplay correctness outside the active drag window.
- Do not change small-project behavior except for shared signal plumbing needed to support the dense-session fix.

## Build Plan

## Phase 0: Freeze The Contract And Capture Baseline

Goal:

- lock the exact preserve-behavior contract and baseline proof before code changes

Actions:

1. Reconfirm the current owning seam before editing.
2. Capture current divider-lag truth using the best available local audit path.
3. Define a single dense-session gate for this lane.
4. Treat current UX as canonical except for lag removal.

Likely files to inspect before editing:

- [frontend/features/ai-studio/components/AiStudioPageContent.tsx](../../frontend/features/ai-studio/components/AiStudioPageContent.tsx)
- [frontend/features/ai-studio/components/ReferenceGrid.tsx](../../frontend/features/ai-studio/components/ReferenceGrid.tsx)
- [frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts)

Exit condition:

- dense-session threshold and proof method are fixed, and implementation can proceed without reopening architecture

## Phase 1: Unify Resize Session Signals

Goal:

- expose one authoritative “divider drag is active” signal for both divider families

Actions:

1. Keep shell divider `isResizing` as the vertical source of truth.
2. Extend [useReferenceGridHorizontalSplit.ts](../../frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts) to expose `isResizing` for:
   - `railCanvasSplit`
   - `horizontalSplit`
   - `stylesSplit`
3. Create one merged right-rail resize session signal inside [ReferenceGrid.tsx](../../frontend/features/ai-studio/components/ReferenceGrid.tsx).
4. Pass shell-resize state from [AiStudioPageContent.tsx](../../frontend/features/ai-studio/components/AiStudioPageContent.tsx) into the reference-grid contract so the grid knows when vertical shell drag is active.
5. Update prop equality surfaces so the new signal does not create accidental rerender churn beyond the intended resize session.

Primary owner files:

- [frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts](../../frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts)
- [frontend/features/ai-studio/hooks/useAiStudioShellResize.ts](../../frontend/features/ai-studio/hooks/useAiStudioShellResize.ts)
- [frontend/features/ai-studio/components/AiStudioPageContent.tsx](../../frontend/features/ai-studio/components/AiStudioPageContent.tsx)
- [frontend/features/ai-studio/hooks/useAiStudioReferenceGridProps.ts](../../frontend/features/ai-studio/hooks/useAiStudioReferenceGridProps.ts)
- [frontend/features/ai-studio/reference-grid/referenceGridTypes.ts](../../frontend/features/ai-studio/reference-grid/referenceGridTypes.ts)
- [frontend/features/ai-studio/reference-grid/logic/referenceGridPropsEquality.ts](../../frontend/features/ai-studio/reference-grid/logic/referenceGridPropsEquality.ts)

Exit condition:

- there is one clear `isRailResizing` or equivalent signal available to the `ReferenceGrid` surface for both shell and internal rail drag sessions

## Phase 2: Suspend The Owning Dense-Grid Resize Cascade

Goal:

- stop dense-grid resize churn from rebuilding the full grid runtime during an active divider drag

Actions:

1. Add a dense-session-aware suspension gate at the `ReferenceGrid` / runtime-scaffold boundary.
2. Reuse and extend the existing suspension model rather than inventing a second performance-control path.
3. During active resize and dense-session only:
   - suppress `ResizeObserver`-driven virtual-metric commits,
   - suppress downstream viewport-projection churn indirectly by keeping metrics stable,
   - suppress visible-card and card-node churn indirectly by keeping projection stable,
   - continue using the existing suspension path for hydration queue, autoplay selection/budget, and visual telemetry.
4. Preserve non-dense behavior and non-resize behavior.

Primary owner files:

- [frontend/features/ai-studio/components/ReferenceGrid.tsx](../../frontend/features/ai-studio/components/ReferenceGrid.tsx)
- [frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts)
- [frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts)

Implementation rule:

- prefer suspending metric commits at the controller boundary over rewriting projection or card-render math deeper in the stack

Why this boundary:

- it is the earliest shared choke point after DOM resize observation and before the expensive fanout

Exit condition:

- active resize no longer drives repeated dense-grid metric/projection/card rebuilds every drag tick

## Phase 3: Resync Cleanly On Drag End

Goal:

- make the grid catch up once, correctly, when the drag session ends

Actions:

1. Trigger one authoritative metric resync when resize suspension lifts.
2. Trigger any required autoplay budget recompute once the surface is live again.
3. Ensure scroll anchor, visible window, and card geometry all reconcile to the final divider position.
4. Avoid duplicate resync paths.

Primary owner files:

- [frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts)
- [frontend/features/ai-studio/components/ReferenceGrid.tsx](../../frontend/features/ai-studio/components/ReferenceGrid.tsx)

Exit condition:

- the grid lands in the correct final layout after drag end without stale geometry, stale autoplay state, or stale loading visuals

## Phase 4: Vertical Shell Persistence Cleanup

Goal:

- remove secondary vertical-divider overhead that is safe to eliminate inside the same lane

Actions:

1. Stop writing shell width to `localStorage` on every drag tick.
2. Persist final width only after the drag session completes.
3. Preserve initial restore, keyboard resize behavior, and explicit programmatic width resets.

Primary owner file:

- [frontend/features/ai-studio/hooks/useAiStudioShellResize.ts](../../frontend/features/ai-studio/hooks/useAiStudioShellResize.ts)

Exit condition:

- vertical shell persistence remains correct, but drag does not perform synchronous storage writes every width change

## Phase 5: Divider-Drag Proof And Regression Validation

Goal:

- prove the fix and prevent regressions in the same seam

Actions:

1. Add or extend targeted tests for:
   - shell resize persistence timing
   - horizontal split `isResizing` session behavior
   - resize-session suspension and resync behavior
2. If implementation proof still feels weak, add a narrow divider-drag audit path to the existing AI Studio perf runtime rather than inventing a new harness.
3. Validate both:
   - vertical shell divider under dense grid
   - right-rail horizontal divider under dense grid

Suggested test and audit surfaces:

- [frontend/features/ai-studio/hooks/__tests__/useAiStudioShellResize.test.ts](../../frontend/features/ai-studio/hooks/__tests__/useAiStudioShellResize.test.ts)
- [frontend/features/ai-studio/hooks/__tests__/useReferenceGridHorizontalSplit.test.ts](../../frontend/features/ai-studio/hooks/__tests__/useReferenceGridHorizontalSplit.test.ts)
- [frontend/features/ai-studio/components/__tests__/ReferenceGrid.canvasSplit.test.tsx](../../frontend/features/ai-studio/components/__tests__/ReferenceGrid.canvasSplit.test.tsx)
- [frontend/features/ai-studio/hooks/useAiStudioPerfAuditRuntime.ts](../../frontend/features/ai-studio/hooks/useAiStudioPerfAuditRuntime.ts)
- [frontend/features/ai-studio/logic/perfAuditGates.ts](../../frontend/features/ai-studio/logic/perfAuditGates.ts)

Exit condition:

- the lane has narrow regression proof and a repeatable divider-drag verification path

## Dense-Session Rule

Default implementation rule:

- only activate resize-session freeze when the grid is in a dense session

Suggested gate:

- start with the same `40+ active outputs` threshold already used elsewhere in AI Studio performance logic, unless stronger implementation evidence requires a slightly different count or a combined `all-refs + curated` rule

Reason:

- this matches the proven symptom split between sparse and dense projects and reduces risk to simple sessions

## Validation Matrix

Run the narrowest validation that proves this lane:

- `npm -C frontend run test -- useAiStudioShellResize`
- `npm -C frontend run test -- useReferenceGridHorizontalSplit`
- `npm -C frontend run test -- ReferenceGrid.canvasSplit`
- `npm -C frontend run type-check:touched`

If touched-file type-checking is not sufficient, escalate to:

- `npm -C frontend run build`

Recommended manual or audit proof:

- dense seeded or real heavy project drag of vertical shell divider
- dense seeded or real heavy project drag of right-rail horizontal divider
- post-drag check that final grid geometry, quick-slot visibility, and canvas section layout reconcile correctly

Production proof boundary:

- use `https://www.shortpulse.ai` only when an authenticated production session is available
- do not block implementation correctness on production proof if the environment is auth-gated and the local owner seam is already strongly proven

## Regression Checklist

Before closing the lane, verify:

- quick-slot reorder and drag/drop still behave normally
- archived outputs and restore actions still work
- canvas section still expands/collapses correctly
- styles section split still works
- visible card loading states recover after drag end
- autoplay settles correctly after drag end
- no stale grid geometry remains after resize end

## Autonomous Execution Notes

If you continue from this plan later:

1. Start at `Phase 0`.
2. Do not reopen architecture unless the chosen suspension seam proves unsafe.
3. If `Phase 2` works cleanly, continue directly through `Phase 5` and stop.
4. If `Phase 2` fails because suspension cannot preserve acceptable live behavior, stop and reopen only the fallback choice between:
   - quantized live recompute
   - ghost divider / commit-on-release
5. Do not branch into unrelated latency work once this lane is complete.
