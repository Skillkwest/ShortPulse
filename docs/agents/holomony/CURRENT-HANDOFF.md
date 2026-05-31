# Holomony Current Handoff

Owner: Holomony
Status: Active
Created on: 2026-05-30

## Lane

Media-display and right-rail aspect-correction follow-through after GPT Image 2 exact-size payload work and shared generated-output dimension hydration.

## What Was Already Fixed Outside Holomony's Lane

These shared data-integrity fixes are complete and should be treated as upstream inputs, not open presentation work:

- generated-output hydration now carries canonical `width` / `height` from `media_files` through `generatedMediaAuthority`
- shared generated-output merge keeps hydrated `width` / `height`
- session snapshot save/restore now persists and restores output `width` / `height`

Primary files already updated:

- `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
- `frontend/features/ai-studio/logic/generatedOutputHydration.ts`
- `frontend/features/ai-studio/logic/sessionSnapshot.ts`
- `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
- `frontend/features/ai-studio/types.ts`

## User-Visible Symptom

Some media-display and right-rail presentation surfaces can still size or label generated images from stale/requested aspect tokens instead of the real pixel dimensions now available on `StudioOutput`.

The concrete example already proven in this lane:

- requested aspect token may say `16:9`
- real output pixels may actually be `1536x1024` (`3:2`)
- detail/presentation surfaces should display and size from the real dimensions when available

## Confirmed Boundary

This handoff is inside Holomony ownership because it is media display / detail-modal / right-rail presentation behavior, not upstream generation or pricing.

Relevant Holomony owner paths from the command indexes:

- detail modal authority:
  - `frontend/features/ai-studio/components/DetailModal.tsx`
- right-rail Canvas media surface:
  - `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
  - `frontend/features/ai-studio/components/canvas/useAiStudioCanvasWorkspaceState.ts`
  - `frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts`
- Reference Grid drag/display authority:
  - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx`
  - `frontend/features/ai-studio/utils/dragDrop.ts`

## Remaining Work For Holomony

### 1. Right-rail Canvas media sizing fallback

Current gap:

- `resolveCanvasResolutionFromOutput(...)` only uses drag-supplied `width` / `height`
- it does not fall back to `output.width` / `output.height`

Owner path:

- `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`

Why it matters:

- generated images/videos dropped into Canvas can still lose correct presentation sizing when drag payload dimensions are missing even though the output itself now knows the real dimensions

Recommended fix shape:

- keep current drag-payload dimensions highest priority
- fall back to `output.width` / `output.height`
- preserve existing non-media Canvas behavior and generic Canvas editing contracts

### 2. Reference Grid drag artifact dimension handoff

Current gap:

- Reference Grid creates `composerImageArtifact` without proactively passing hydrated `currentOutput.width` / `currentOutput.height`

Owner path:

- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx`
- `frontend/features/ai-studio/utils/dragDrop.ts`

Why it matters:

- drag-to-Canvas and other internal reference handoffs are more robust when real dimensions travel with the artifact instead of depending on browser-measured image state

Recommended fix shape:

- add `width` / `height` to the `composerImageArtifact` payload when available
- leave media identity, signing, and drag-origin semantics unchanged

### 3. Any remaining detail/presentation surfaces that still trust `output.aspect`

Current status:

- `DetailModal` was already tightened to prefer real dimensions
- no similarly high-value mismatch was confirmed in Reference Grid card rendering or Media Library masonry layout during this pass

Recommended Holomony sweep:

- audit only user-visible media-display surfaces in Holomony scope
- check for any remaining labels or layout ratios that still trust `output.aspect` over `width` / `height`
- stop if no additional concrete mismatch is found

## Things Not To Re-open In This Handoff

- GPT Image 2 pricing, billed credits, or admin workbook
- provider payload sizing / quality mapping
- upstream generation persistence beyond already-landed shared dimension hydration
- broad Canvas redesign or generic editing UX

## Proof Already Available

Local proof from the completed shared-data lane:

- `npx vitest run features/ai-studio/logic/__tests__/generatedMediaAuthority.test.ts`
- `npx vitest run features/ai-studio/logic/__tests__/generatedOutputHydration.test.ts`
- `npx vitest run features/ai-studio/components/__tests__/DetailModal.test.tsx`
- `npx vitest run features/ai-studio/components/__tests__/DetailModal.fullQuality.test.tsx`
- `npx vitest run features/ai-studio/logic/__tests__/sessionSnapshot.test.ts`
- `npx vitest run features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts`

## Best Next Move

Holomony should take the smallest next fix with the best ROI:

1. right-rail Canvas media sizing fallback in `useAiStudioPageMediaReferenceRuntime.ts`
2. Reference Grid drag artifact width/height handoff
3. stop after those unless a fresh media-display audit finds another concrete `output.aspect` mismatch
