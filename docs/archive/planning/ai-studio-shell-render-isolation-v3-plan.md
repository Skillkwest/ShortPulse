# AI Studio Shell Render-Isolation v3 Plan

> Archived on 2026-04-27 during docs cleanup because the baseline selector-store and shell-boundary isolation work is already implemented and the document now serves as historical performance-hardening context.

Status: complete

## Status
Implemented baseline architecture and rollout controls on February 18, 2026.

## Goal
Eliminate non-grid shell rerender coupling at 50-60 active references by moving from broad output-array props to selector-subscribed output reads, then isolating shell sections behind stable boundaries.

## Problem Summary
- The page orchestrator previously fanned out `outputs` into many non-grid hooks/callbacks.
- `AiStudioPageContent` remained a large render root, so parent updates could invalidate toolbar/properties/preview even when reference-grid data changed.
- Poll/status updates still created frequent UI churn outside the grid.

## Decision
Adopt a custom selector-subscribed output store (`useSyncExternalStore`) and route non-grid consumers to id/index selectors instead of full output arrays. Pair this with shell boundary components and explicit shell performance counters/gates.

## Delivered Phases

### Phase 0: Instrumentation Upgrade
- Extended shell audit scenarios to `20 / 50 / 60 / 100 / 300`.
- Added section-level render counters for:
  - toolbar rail
  - properties rail
  - reference rail
  - preview rail
- Added section commit and non-grid rerender-per-status-tick reporting in `runStudioShellAudit`.

### Phase 1: Output Selector Store
- Added `frontend/features/ai-studio/hooks/aiStudioOutputStore.ts`.
- Store snapshot shape:
  - `outputOrder`
  - `outputById`
  - `archivedOutputOrder`
  - `archivedOutputById`
  - `indexes` (`inFlightIds`, `failedIds`, `activeCount`, `archivedCount`)
- Added hooks:
  - `useOutputSelector`
  - `useOutputById`
  - `useOutputCounts`
  - `useVisibleOutputWindow`
- Integrated snapshot publishing into `useAiStudioState` output writes.

### Phase 2: Page Orchestrator Decoupling
- Migrated non-grid lookups from broad arrays to id-based selectors/getters:
  - `useAiStudioReferenceAssetActions`
  - `useAiStudioAgentComposer`
  - `useAiStudioAgentOrchestration`
- Added `useAiStudioState` APIs:
  - `getOutputById`
  - `subscribeOutputs`
  - `getOutputSnapshot`

### Phase 3: Shell Boundary Split
- Split shell into isolated components:
  - `AiStudioShellFrame`
  - `AiStudioToolbarRail`
  - `AiStudioPropertiesRail`
  - `AiStudioReferenceRail`
  - `AiStudioPreviewRail`
  - existing `AiStudioAlertsStack` retained
- Moved dense-shell count source from `referenceCanvasProps.outputs.length` to selector-store count.

### Phase 4: Callback Dependency Hardening
- Removed output-array dependencies from agent/reference hooks where id lookup is sufficient.
- Added selector-callback rollout flag path to page orchestration.

### Phase 5: Poll/Status Update Impact Reduction
- Added `NEXT_PUBLIC_AI_STUDIO_RAF_STATUS_FLUSH` for RAF-based queued status flushes.
- Routed non-urgent status churn through `startTransition` in `useAiStudioTasks`.

### Phase 6: Dense-Shell Cost Controls
- Tuned dense-shell CSS to reduce transition/filter/shadow work on toolbar/properties surfaces while preserving readability.

### Phase 7: Rollout and Fallback
- Added feature flags:
  - `NEXT_PUBLIC_AI_STUDIO_OUTPUT_SELECTOR_STORE`
  - `NEXT_PUBLIC_AI_STUDIO_SHELL_BOUNDARY_SPLIT`
  - `NEXT_PUBLIC_AI_STUDIO_SELECTOR_CALLBACKS`
  - `NEXT_PUBLIC_AI_STUDIO_RAF_STATUS_FLUSH`

## Acceptance Gates (Shell)
- `toolbar_switch_p95_ms_at_60 <= 120`
- `panel_interaction_p95_ms_at_60 <= 140`
- `tool_switch_visual_commit_p95_ms_at_60 <= 180`
- `long_task_p95_ms_during_shell_actions <= 120`
- `max_input_stall_ms_during_shell_actions <= 1000`
- `non_grid_*_rerenders_per_output_status_tick <= 1` for toolbar/properties rails

## Verification Commands (Browser Console)
```js
await window.__shortpulseAiStudioPerf?.runReferenceGridAudit();
await window.__shortpulseAiStudioPerf?.runStudioShellAudit();
```
