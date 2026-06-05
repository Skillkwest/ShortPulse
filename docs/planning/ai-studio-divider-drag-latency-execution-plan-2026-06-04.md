# AI Studio Large-Project Divider Drag Latency Plan

Status: owner-accepted/closed for queue selection; retained as proof context and regression checklist
Owner: Latency
Last updated: 2026-06-05
Supersedes: the earlier freeze-first plan in this file

2026-06-05 closeout note: the implementation lane was accepted complete by the owner after local validation and production deployment attempts. Remaining production perf-audit runtime proof was not available from the deployed diagnostic surface at closeout, so do not use this retained plan to reopen generic divider/right-rail work unless new current evidence shows divider lag recurring.

## Objective

Eliminate the severe lag when dragging:

- the vertical divider between the workflow/properties panel and the right rail
- the horizontal dividers inside the right rail between `Canvas`, `Quick Slot Inventory`, `Reference Grid`, and `Styles`

The fix must preserve current UI, UX, layout, styling, right-rail ownership, project restore, autosave, media visibility, preview security, quick-slot behavior, archive behavior, and canvas behavior. The only intended user-facing change is that divider drag becomes smooth in medium and large projects.

## Planning Stop Condition

This planning lane is complete when:

- the current repo-backed lag seams are ranked by confidence and ROI
- multiple solution approaches are compared and the best approach is selected
- the exact owner files and implementation packets are named
- validation, proof gates, rollback boundaries, and implementation stop conditions are explicit
- a self-audit confirms the plan can be followed autonomously without inventing new scope

Once those conditions are met, stop planning. Do not implement in this planning lane.

## Implementation Stop Condition

The future implementation lane is complete only when:

- dense-project divider drag is visibly smooth for the vertical shell divider and all right-rail horizontal dividers
- the implementation proves that divider pointermove no longer triggers repeated full-project `Reference Grid` projection or selector work
- the final post-drag grid layout reconciles correctly once per completed drag session
- no blocking regression remains in `Reference Grid`, `Quick Slot Inventory`, `Canvas`, `Styles`, project restore, autosave, media visibility, preview security, quick-slot ordering, archive actions, or autoplay/hydration behavior
- targeted tests and a divider-drag performance proof pass are complete, or any remaining proof gap is explicitly production-auth-only

Stop and report instead of continuing when:

- the next candidate would require a visible UI/UX/behavior/layout/styling change
- the next candidate forks the global right rail instead of fixing the canonical shared surface
- measurement proves a different in-scope owner seam dominates after this packet
- validation exposes a restore, autosave, quick-slot, media, canvas, or security regression
- production proof is unavailable and only deploy/auth state blocks it after local implementation proof is strong

## Source Of Truth

Primary references:

- [shortpulse-latency-launch-plan-2026-07-07.md](./shortpulse-latency-launch-plan-2026-07-07.md)
- [ADR 0083: Create-Mode Global Right-Rail Authority](../adr/0083-create-mode-global-right-rail-authority.md)
- [Latency SOP](../agents/latency/standard-operating-procedure.md)

Primary owner files:

- [useReferenceGridOutputCollections.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputCollections.ts)
- [projections.ts](../../frontend/features/ai-studio/reference-projections/projections.ts)
- [aiStudioOutputStore.ts](../../frontend/features/ai-studio/hooks/aiStudioOutputStore.ts)
- [useReferenceGridRuntimeScaffold.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts)
- [useReferenceGridViewportProjectionController.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridViewportProjectionController.ts)
- [useReferenceGridOutputViewModels.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputViewModels.ts)
- [useReferenceGridVirtualMetricsController.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts)
- [useAiStudioShellResize.ts](../../frontend/features/ai-studio/hooks/useAiStudioShellResize.ts)
- [useReferenceGridHorizontalSplit.ts](../../frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts)
- [ReferenceGrid.tsx](../../frontend/features/ai-studio/components/ReferenceGrid.tsx)
- [AiStudioPageContent.tsx](../../frontend/features/ai-studio/components/AiStudioPageContent.tsx)
- [AiStudioShellFrame.tsx](../../frontend/features/ai-studio/components/AiStudioShellFrame.tsx)
- [useAiStudioProjectWorkspacePersistenceController.ts](../../frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts)
- [useAiStudioPerfAuditRuntime.ts](../../frontend/features/ai-studio/hooks/useAiStudioPerfAuditRuntime.ts)
- [freezeInvestigationTelemetry.ts](../../frontend/features/ai-studio/logic/freezeInvestigationTelemetry.ts)

## Current Repo Truth

User-observed symptom shape:

- sparse or new projects drag smoothly
- medium and large projects with many persisted `Reference Grid` items drag poorly
- visible card count can still be only about 12 to 16 cards
- lag affects both the vertical workflow/right-rail divider and the right-rail horizontal dividers

Repo-backed interpretation:

- The lag is not explained by visible DOM count alone.
- Virtualization limits rendered cards after the grid has already computed full All Refs and Quick Slot projections.
- The current AI Studio path uses store-backed reference-grid props via `useAiStudioReferenceExperienceRuntime` with `readOutputsFromStore: true`, so giant output arrays are not the main shell prop payload.
- The store-backed path still does full-project work in `useReferenceGridOutputCollections`.
- `selectVisibleAllRefsProjection` filters the full output list.
- `selectQuickSlotProjection` builds a `Map` from the full output list before selecting quick-slot items.
- The previous resize-freeze strategy started too late because `useReferenceGridOutputCollections` runs before dense resize suspension is calculated in `useReferenceGridRuntimeScaffold`.
- `useReferenceGridViewportProjectionController` is mostly O(visible window) once it receives `outputIds`, so it is not the first owner seam to optimize.
- `useReferenceGridOutputViewModels` is mostly visible/near-visible ID based and is lower-risk follow-up territory.
- CSS containment already exists for dense reference cards and virtual spacers, so containment-only work is unlikely to solve the root issue.
- `useAiStudioProjectWorkspacePersistenceController` has output-count-dependent snapshot build, compose, signature, and autosave candidate-selection work. This can explain broader large-project lag if it overlaps interaction, but it is a separate proof lane unless measurement shows it fires during divider drag.

## Ranked Root Causes

### Rank 1: full-project reference projections before virtualization

Confidence: high
ROI: highest
Primary files:

- [useReferenceGridOutputCollections.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputCollections.ts)
- [projections.ts](../../frontend/features/ai-studio/reference-projections/projections.ts)
- [aiStudioOutputStore.ts](../../frontend/features/ai-studio/hooks/aiStudioOutputStore.ts)

Why it fits:

- Cost grows with project size even when only a small visible window is rendered.
- Both All Refs and Quick Slot derivation materialize or scan the full output list.
- The work happens before the previous resize suspension gate, so the attempted freeze could not fully solve it.

### Rank 2: selector-store notification and selector recompute cost

Confidence: high
ROI: high
Primary file:

- [aiStudioOutputStore.ts](../../frontend/features/ai-studio/hooks/aiStudioOutputStore.ts)

Why it fits:

- `useOutputSelector` recomputes selectors on notifications and `getSnapshot`.
- If full-list projection selectors are subscribed, large projects can pay repeated O(project-size) selector cost even when selected visible cards do not change.
- The output store already has narrow visible-window helpers, so the canonical direction is to make projection selectors similarly narrow or memoized.

### Rank 3: resize-session metric/layout churn

Confidence: medium-high
ROI: high after Rank 1
Primary files:

- [useReferenceGridRuntimeScaffold.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts)
- [useReferenceGridVirtualMetricsController.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts)
- [useAiStudioShellResize.ts](../../frontend/features/ai-studio/hooks/useAiStudioShellResize.ts)
- [useReferenceGridHorizontalSplit.ts](../../frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts)

Why it fits:

- Divider pointermove updates shell width or split ratio on every drag tick.
- Resize observers and virtual metric sync can fan out into projection/window/card work.
- The earlier local fix reduced some of this, but because projection work remained upstream, it was insufficient.

### Rank 4: project persistence and autosave global lag

Confidence: medium
ROI: high if measurement shows overlap
Primary file:

- [useAiStudioProjectWorkspacePersistenceController.ts](../../frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts)

Why it fits:

- Snapshot building, JSON serialization, restore signatures, unlock signatures, and autosave candidate selection scale with active/archived output count.
- This can create general app main-thread pressure in large projects even outside divider drag.
- It should not be mixed into the first divider packet unless measurement proves it overlaps the drag interaction.

### Rank 5: CSS/layout/paint cost from dense cards

Confidence: low-medium
ROI: lower as first move
Primary file:

- [ai-studio-canvas.css](../../frontend/styles/ai-studio-canvas.css)

Why it fits less well:

- The grid already has `content-visibility` and containment modes for dense cards.
- Only 12 to 16 cards may be visible during the lag.
- CSS improvements may help residual paint, but they are unlikely to explain full project-size scaling by themselves.

## Approaches Considered

### Approach A: containment and DOM optimization only

Decision: reject as primary.

Reason:

- The repo already has dense card containment and virtualization.
- The symptom follows total project size more than visible card count.
- This can be a residual polish lane only after projection and resize churn are proven lower.

### Approach B: freeze visual work during resize only

Decision: keep as a secondary guard, not the primary fix.

Reason:

- This is the previously attempted direction and it did not remove the user-visible lag.
- The current code calculates output collections before the dense resize suspension gate.
- It remains useful after projection optimization to prevent layout/paint churn during active drag.

### Approach C: ghost divider and commit on release

Decision: reject unless preserve-behavior options fail.

Reason:

- It changes the feel of the divider interaction.
- The user explicitly wants no UI/UX behavior changes besides lag removal.
- Use only if the browser cannot repaint live panel resize smoothly after all data work is removed.

### Approach D: throttled or quantized live resize

Decision: reject as first implementation.

Reason:

- It risks subtle layout and scroll-anchor behavior changes.
- It hides the symptom without addressing full-project work.
- It is harder to validate than removing O(project-size) work from the hot path.

### Approach E: memoized store-level projection selectors

Decision: chosen as the core fix.

Reason:

- It directly targets the project-size dependency.
- It preserves the global right-rail contract.
- It fits the existing output selector store architecture.
- It allows virtualization to start from stable ID lists without reconstructing full output object arrays on every relevant render.

### Approach F: broad normalized output-state architecture rewrite

Decision: defer.

Reason:

- It may be a good future direction, but it is too broad for this no-UX-change divider-lag lane.
- The current store architecture is close enough to fix the hot path with narrower projection/index work.

## Chosen Strategy

Use a two-layer preserve-behavior strategy:

1. Remove repeated O(project-size) projection work from the Reference Grid hot path.
2. Then keep dense resize sessions from triggering unnecessary metric/layout/background visual churn while the divider is actively dragged.

This order matters. Projection optimization is the core fix. Resize freezing is the interaction guard after the main data cost is removed.

## Implementation Plan

### Packet 0: Measurement And Proof Harness

Goal:

- prove the current hot-path costs and create a repeatable divider-drag benchmark before changing implementation code

Actions:

- Extend existing dev/audit instrumentation rather than inventing a separate harness.
- Add counters/timing for `referenceGrid.outputCollections` projection recomputes, selector recomputes, full output scans, quick-slot projection scans, viewport projection recomputes, virtual metric commits, and resize-session start/end.
- Add or extend a synthetic large-project divider audit through [useAiStudioPerfAuditRuntime.ts](../../frontend/features/ai-studio/hooks/useAiStudioPerfAuditRuntime.ts) or the existing freeze investigation telemetry.
- Measure counts such as 20, 40, 60, 100, 300, and an owner-supplied real large project when authenticated proof is available.
- Record both vertical shell divider and right-rail horizontal divider behavior.

Exit condition:

- the benchmark shows whether divider drag currently triggers repeated full-project projection or selector work, and captures a baseline for comparison.

Stop if:

- measurement shows projection is not active during drag and another owner seam dominates.

### Packet 1: Store-Level Projection Cache

Goal:

- make All Refs and Quick Slot ID derivation stable and cheap unless output data or projection inputs actually change

Actions:

- Add store-backed projection helpers to [aiStudioOutputStore.ts](../../frontend/features/ai-studio/hooks/aiStudioOutputStore.ts) or a focused adjacent module.
- Cache `visibleAllRefsOutputIds` by `outputOrder`, `outputById`, `removedFromAllRefsIds`, and hidden-output identity/version.
- Cache `quickSlotOutputIds` by `curatedReferenceIds`, `outputById`, and hidden-output identity/version.
- Avoid `snapshot.outputOrder.map(...).filter(...)` inside `useReferenceGridOutputCollections` when store-backed mode is active.
- Avoid `new Map(outputs.map(...))` in the quick-slot hot path when `snapshot.outputById` already exists.
- Preserve the direct `outputsProp` path for tests and isolated consumers, but keep the AI Studio canonical path store-backed.
- Reuse existing array equality so unchanged projected ID arrays retain identity.

Primary files:

- [aiStudioOutputStore.ts](../../frontend/features/ai-studio/hooks/aiStudioOutputStore.ts)
- [useReferenceGridOutputCollections.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputCollections.ts)
- [projections.ts](../../frontend/features/ai-studio/reference-projections/projections.ts)

Exit condition:

- store-backed `useReferenceGridOutputCollections` no longer materializes full output object arrays just to derive All Refs or Quick Slot IDs on stable data.

Stop if:

- preserving exact All Refs, hidden-output, removed-output, and Quick Slot ordering semantics requires a broader projection authority change.

### Packet 2: Resize Hot-Path Isolation

Goal:

- ensure active divider drag does not invalidate large Reference Grid data projections

Actions:

- Keep the vertical shell divider and horizontal right-rail divider signals unified as one resize-session signal.
- Ensure dense resize suspension is computed early enough to protect downstream runtime work.
- Keep output projection caches stable during pointermove when output data and projection inputs have not changed.
- Suppress virtual metric commits during dense active resize and resync once on release.
- Keep shell width persistence deferred until drag end.
- Do not change keyboard resize behavior or persisted width restore.

Primary files:

- [useAiStudioShellResize.ts](../../frontend/features/ai-studio/hooks/useAiStudioShellResize.ts)
- [useReferenceGridHorizontalSplit.ts](../../frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts)
- [AiStudioPageContent.tsx](../../frontend/features/ai-studio/components/AiStudioPageContent.tsx)
- [ReferenceGrid.tsx](../../frontend/features/ai-studio/components/ReferenceGrid.tsx)
- [useReferenceGridRuntimeScaffold.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts)
- [useReferenceGridVirtualMetricsController.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts)

Exit condition:

- active dense resize does not repeatedly commit virtual metrics or recompute full grid projections, and final release performs one correct layout reconciliation.

Stop if:

- the only way to make drag smooth is to stop live layout movement or change divider interaction semantics.

### Packet 3: Visible-Window And Media Work Confirmation

Goal:

- verify that remaining rendered work is bounded to visible/near-visible items

Actions:

- Audit [useReferenceGridViewportProjectionController.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridViewportProjectionController.ts) after Packet 1 to confirm it stays O(visible window) for visible IDs, near-viewport IDs, and rendered sets.
- Audit [useReferenceGridOutputViewModels.ts](../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridOutputViewModels.ts) to confirm media/view-model selectors stay visible/near-visible.
- Confirm signed URL, hydration, autoplay, and preview queues use visible, curated visible, near-viewport, and active IDs rather than all outputs.
- Add narrow tests only for any gap found.

Exit condition:

- the render/media path is proven bounded after projection cache changes.

Stop if:

- media or hydration work still scales with all outputs during resize; fix that specific owner seam before moving on.

### Packet 4: Global Large-Project Lag Audit

Goal:

- decide whether general app lag remains after divider hot-path work

Actions:

- Measure project persistence phases using existing `projectWorkspaceAutosavePerf` counters.
- Check whether `baseSessionSnapshotBuild`, `sessionSnapshotCompose`, `candidateSelection`, `resolveProjectAutosaveUnlockSignature`, or JSON serialization run during drag or other interactions.
- If persistence overlaps interactions, plan a separate preserve-behavior packet to defer, memoize, or move autosave snapshot selection out of interactive frames.
- Keep autosave correctness and restore safety as hard blockers.

Primary files:

- [useAiStudioProjectWorkspacePersistenceController.ts](../../frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts)
- [projectWorkspaceAutosavePerf.ts](../../frontend/features/ai-studio/logic/projectWorkspaceAutosavePerf.ts)
- [sessionAutosaveSerialization.ts](../../frontend/features/ai-studio/logic/sessionAutosaveSerialization.ts)

Exit condition:

- either global lag is proven resolved by divider/grid work, or a separate persistence/autosave implementation packet is opened with its own evidence and stop condition.

Stop if:

- no current measurement connects persistence work to user-visible interaction lag.

### Packet 5: Validation And Production Proof

Goal:

- prove the change and prevent regressions

Required local validation:

- `npm -C frontend run test -- useAiStudioShellResize`
- `npm -C frontend run test -- useReferenceGridHorizontalSplit`
- `npm -C frontend run test -- useReferenceGridOutputCollections`
- `npm -C frontend run test -- referenceGridPropsEquality`
- `npm -C frontend run test -- ReferenceGrid.canvasSplit`
- `npm -C frontend run type-check:touched`
- `git diff --check`

Required performance proof:

- synthetic dense project divider drag at 40, 60, 100, and 300 outputs
- real large project divider drag when an authenticated safe project is available
- counters proving projection recompute count and full-output scan count do not grow per pointermove
- long-task and input-stall comparison before and after
- final layout reconciliation after release for vertical and horizontal dividers

Production proof boundary:

- use `https://www.shortpulse.ai` for production claims after deployment/auth proof is available
- label local/static proof as local only
- do not block implementation correctness on production proof if auth state is the only missing piece

## Acceptance Targets

Use these as implementation gates, not as permission to change behavior:

- pointermove drag does not trigger repeated full-project All Refs or Quick Slot projection scans
- visible rendered card count remains bounded by the virtual window
- no more than one virtual-metric reconciliation is needed after dense drag release
- divider drag p95 frame/input latency improves materially at 100+ outputs
- no long-task spike remains tied to projection work during active drag
- small projects remain behaviorally unchanged

## Regression Checklist

Before closing implementation:

- Quick Slot add, remove, reorder, drag/drop, and persistence still work.
- All Refs ordering, hidden-output filtering, and removed-from-All-Refs filtering are unchanged.
- Canvas stays global and remains visible/collapsible under ADR 0083.
- Styles split and nested split behavior remain unchanged.
- Archive open, restore one, and restore all still work.
- Detail modal open/select still works from visible cards.
- Media preview URLs and signed storage URLs do not use Supabase image transformations.
- Hydration, loading visuals, and autoplay resume after drag end.
- Project restore and project autosave remain correct.

## Autonomous Execution Notes

Future implementation should proceed in this order:

1. Run Packet 0 and capture baseline.
2. If Packet 0 confirms projection cost, implement Packet 1 before any more resize-freeze work.
3. Implement Packet 2 only after projection cache proof exists.
4. Run Packet 3 to confirm visible-window/media bounds.
5. Run Packet 4 only if global large-project lag remains or measurement connects persistence to interaction stalls.
6. Run Packet 5 and stop at the implementation stop condition.

Do not reopen ghost-divider, throttle/quantize, CSS-only, or broad architecture approaches unless this plan's chosen preserve-behavior path fails with evidence.

## Self-Audit

Plan audit result: pass.

- The plan now targets the full-project projection seam that explains why large projects lag even when only 12 to 16 cards are visible.
- The previous freeze-only approach is demoted because it was applied after output collection derivation and was not enough in user testing.
- Multiple approaches are compared, with rejection reasons and fallback rules.
- The implementation order starts with proof, then fixes projection identity/cost, then isolates resize churn, then audits global persistence if needed.
- The plan preserves the global right-rail authority from ADR 0083.
- The plan avoids UI/UX behavior changes and names a stop condition if smoothness would require ghost-divider or commit-on-release behavior.
- The plan includes validation, performance proof, regression checks, production-proof boundaries, and autonomous stop rules.
