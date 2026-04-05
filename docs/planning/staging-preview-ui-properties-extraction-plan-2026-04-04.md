# Staging Preview UI Properties Extraction Plan (2026-04-04)

Purpose: define the remaining product-only extraction strategy for the AI Studio UI/properties delta that still exists between current `staging-preview` and `origin/codex/full-unified-layers`.

## Current Posture

- Active integration target: `staging-preview`
- Current shared checkpoint: `9eff46c68`
- Source branch for comparison only: `origin/codex/full-unified-layers`
- Branch-level merges are no longer the right unit for the remaining UI work.

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
