# Staging Preview UI Properties Extraction Plan (2026-04-04)

Purpose: define the remaining product-only extraction strategy for the AI Studio UI/properties delta that still exists between current `staging-preview` and `origin/codex/full-unified-layers`.

## Current Posture

- Active integration target: `staging-preview`
- Current shared checkpoint: `50441c2cc`
- Source branch for comparison only: `origin/codex/full-unified-layers`
- Branch-level merges are no longer the right unit for the remaining UI work.

## Final Re-Baseline After `50441c2cc`

Current conclusion:
- the remaining product-only lanes identified in this plan are now absorbed locally on `staging-preview`
- no further UI properties extraction is planned from `origin/codex/full-unified-layers`
- any new work should begin from current `staging-preview` requirements instead of continuing this extraction plan by source-branch momentum

## What Is Left

The remaining UI delta falls into two materially different buckets:

1. routing/session-hydration/view-model behavior
2. large visual/panel/style churn

The first bucket is small enough to extract safely. The second is still too mixed to take as one lane.

## Next Recommended Lane

### Lane UI-1: routing and restored-session posture

Goal:
- land the remaining product-state changes that affect tool routing, restored session interpretation, and small hook/type contracts without pulling the larger visual redesign surface.

Primary files:
- `frontend/features/ai-studio/logic/propertiesPanelRouting.ts`
- `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`
- `frontend/features/ai-studio/hooks/useAiStudioSessionSnapshotController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioViewModel.ts`
- `frontend/features/ai-studio/hooks/useAiStudioWorkflowSettings.ts`
- `frontend/features/ai-studio/types.ts`

Primary tests:
- `frontend/features/ai-studio/logic/__tests__/propertiesPanelRouting.test.ts`
- `frontend/features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioPanelProps.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.killSwitch.test.tsx`

Why this lane is next:
- it is product-visible but still bounded
- it does not require the large panel CSS/design surface
- it aligns routing and restored-session behavior with the runtime lanes that are already landed

Expected changes in scope:
- support Sound child tools as first-class restored tool ids
- add `text-to-speech` as a distinct properties panel kind while keeping Sound child tools grouped under the Sound surface
- carry `sourceRef` and expanded queue state through restored outputs where needed
- normalize unresolved restored outputs into queue-waiting or server-recovery posture
- add the minimal hook/type updates required to keep those behaviors coherent

## Explicitly Deferred From UI-1

Do not include in the next lane:

- `frontend/features/ai-studio/components/SoundPropertiesPanel.tsx`
- `frontend/features/ai-studio/components/TextToSpeechPropertiesPanel.tsx`
- `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`
- `frontend/features/ai-studio/components/EditPropertiesPanel.tsx`
- `frontend/styles/ai-studio-reference-properties.css`
- `frontend/styles/ai-studio-sound-properties.css`
- `frontend/styles/ai-studio-tts-properties.css`
- `frontend/styles/ai-studio-video-theme.css`
- broad page/container surface churn in:
  - `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
  - `frontend/features/ai-studio/components/AiStudioToolbar.tsx`
  - `frontend/features/ai-studio/components/ReferenceMediaStep.tsx`
  - `frontend/features/ai-studio/components/ReferenceVideoSettingsStep.tsx`

Reason:
- these files belong to the larger visual/panel redesign surface and would expand the lane beyond a safe product-only extraction.

## Lane UI-2 Candidate

Only after UI-1 is stable:
- evaluate a second product-only lane for remaining panel wiring and visual redesign
- continue excluding docs and `skills/` collateral from source commits such as `a57630d0b` and `b55a631a2`

## Re-Baseline Audit After `8f231fa01`

Current conclusion:
- the original UI-1 routing/session-hydration goal is materially present on local `staging-preview`
- the only concrete upstream remainder still found inside that lane is the `activeOutput` video-panel prop thread, which crosses into `frontend/features/ai-studio/hooks/useAiStudioVideoPanelProps.ts`
- that remainder should not be pulled opportunistically while the lane definition still excludes the video-panel hook

Remaining source delta now clusters into three different follow-on buckets:

1. runtime submission and polling alignment
2. reference-video / Kling advanced-panel visual copy and control polish
3. small safety/authority cleanups around style intake, reference download, and stale-output cleanup

## Next Recommended Lane From Current Branch Truth

### Lane RT-1: video submission and polling alignment

Goal:
- extract the bounded runtime delta that improves KIE Kling payload shaping, queued submission `sourceRef` carry-through, and server-lifecycle-first polling behavior without reopening the deferred panel/style surface

Primary files:
- `frontend/features/ai-studio/hooks/taskSubmission/videoHandlers.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/videoPayloads.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/outputLifecyclePatches.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/queueStatusPolling.ts`
- `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
- `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts`
- `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`

Primary tests:
- `frontend/features/ai-studio/hooks/taskSubmission/__tests__/videoHandlers.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskOrchestration.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioTasks.test.ts`

Why this lane is next:
- it is product-visible and runtime-correctness oriented
- the source delta is internally coherent and already comes with focused test coverage
- it avoids the broad deferred CSS/panel redesign files that made the old UI lane hard to slice safely

Expected changes in scope:
- carry queued `sourceRef` through submission lifecycle patching instead of relying only on later hydration
- support richer KIE Kling payload shaping for multi-shot and element inputs
- prefer server lifecycle hints over raw provider success/failure heuristics during task polling handoff
- keep the lane centered on runtime behavior and hook tests, not panel copy/layout

## RT-1 Re-Slice After Runtime Audit

Current conclusion:
- the hook/runtime half of RT-1 is independently landable on current `staging-preview`
- the remaining KIE Kling multi-shot and element payload parity is not independently hook-scoped because current submit validation and provider contract files still constrain that payload surface

Split the lane this way:

### Lane RT-1A: queue/sourceRef and polling authority

Goal:
- land the runtime-authority changes that are fully compatible with current `staging-preview` contracts

Included behavior:
- preserve queued `sourceRef` during submission patching and queue-status handoff
- use dispatch-handoff initial polling delay consistently for direct non-queued submissions
- trust lifecycle-authored success/failure authority before raw provider state heuristics
- keep raw terminal provider states on the recovery path instead of forcing local success
- add the contract-safe KIE Kling standard submit fields already supported locally: `mode`, `sound`, and `multi_shots`

### Lane RT-1B: advanced KIE Kling payload contract expansion

Goal:
- finish source parity for KIE Kling multi-shot and element payload shaping only if the server contract surface is intentionally admitted

Additional files required:
- `frontend/lib/model-runtime/modelCatalog.ts`
- `frontend/lib/server/providerIntegration/kieModelContracts.ts`
- related submit-contract tests under `frontend/lib/server/`

Reason for the split:
- without those server-side files, the remaining multi-shot/element payload fields are blocked by current allowed-field and provider normalization contracts on `staging-preview`

## Explicitly Defer Again After Re-Baseline

Still do not mix RT-1 with:
- `frontend/features/ai-studio/components/ReferenceKlingAdvancedSteps.tsx`
- `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`
- `frontend/features/ai-studio/components/useReferencePropertiesDerivedState.ts`
- `frontend/features/ai-studio/components/__tests__/ReferenceVideoSettingsStep.test.tsx`
- `frontend/features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx`

Reason:
- those files form a separate visual/panel follow-on lane and are no longer the highest-ROI next step from the current branch state

## Validation Bundle For UI-1

Run at minimum:

```bash
cd frontend
npm run test -- features/ai-studio/logic/__tests__/propertiesPanelRouting.test.ts features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts features/ai-studio/hooks/__tests__/useAiStudioPanelProps.test.ts features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.killSwitch.test.tsx
npm run type-check
npm run build
```

## Stop Rule

If UI-1 requires pulling the deferred visual/panel files to compile or test cleanly, stop and re-slice instead of expanding scope by momentum.
