# AI Studio Passive Wheel Warning Audit

Purpose: retain the production audit for the user-reported `Unable to preventDefault inside passive event listener invocation` noise so a future agent can restart this lane without redoing the initial investigation.

## Surface

- AI Studio project load on `https://www.shortpulse.ai`
- same-session project switching inside AI Studio
- wheel-driven media inspection surfaces
- right-rail `Canvas`, `DetailModal`, and `Expert Edit` zoom plumbing

## Observed behavior

The user reported repeated passive-listener warnings appearing immediately on project load, without any deliberate gesture interaction.

The same user-supplied console export also contained image preview failures, which initially made it plausible that both issues were the same lane. The audit separated them.

## Likely hesitation or trust issue

When a core production workspace throws dense runtime noise on load, even if the visible UI still works, it teaches the operator:

- this workspace may not be stable
- media interactions may have hidden breakage
- future fixes may become patch-on-patch instead of source-level cleanup

That makes this a trust and maintainability issue, not just a cosmetic console detail.

## Supporting evidence

### User-side evidence

- On `2026-06-01` and `2026-06-02`, the user reported the warnings happen "immediately without doing anything, just loading a project."
- A user-supplied console export from the same lane contained:
  - `126` passive-listener warnings
  - `29` image `400` failures

That count mismatch matters. It breaks the theory that the gesture warning is only a one-for-one side effect of broken media previews.

### Production probe evidence

- `2026-06-01`, Chromium, fresh authenticated production opens across 5 real projects:
  - 4 projects produced `0` passive warnings, `0` page errors, and `0` `preventDefault()` calls on wheel/touch instrumentation.
  - `Zuri Kalu` reproduced immediate `/_next/image` `400` failures, but still `0` passive warnings.
  - The mounted-surface probe found `hasCanvas=false`, `hasDetailModal=false`, and `hasExpertEdit=false`.
- `2026-06-02`, Chromium, same-session project switch from `The One-Horned White Horse` to `Zuri Kalu` after intentionally opening the `Canvas` lane first:
  - image `400` failures reproduced again
  - passive warnings still stayed at `0`
  - mounted-surface probe again found `hasCanvas=false`, `hasDetailModal=false`, and `hasExpertEdit=false` after the switch
- `2026-06-02`, Firefox, direct authenticated production load of `Zuri Kalu`:
  - image `400` failures reproduced
  - passive warnings stayed at `0`
  - wheel/touch `preventDefault()` instrumentation stayed at `0`

### Runtime and code evidence

- The shipped React runtime treats delegated `wheel`, `touchstart`, and `touchmove` listeners as passive in `frontend/node_modules/react-dom/cjs/react-dom.development.js`.
- The only live application surfaces still calling `preventDefault()` on wheel in shipped AI Studio code are:
  - `frontend/features/ai-studio/components/DetailModal.tsx`
  - `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx`
  - `frontend/features/ai-studio/components/edit/useExpertEditStageViewportController.ts`
- The always-mounted chat panel is not a cause. `frontend/prefabs/agent/panels/AgentChatPanel.tsx` updates follow-state on wheel but does not call `preventDefault()`.
- Fresh project restore actively clears detail/output state in:
  - `frontend/features/ai-studio/logic/projectRestoreSnapshot.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioSessionSnapshotController.ts`
  - `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts`
- `detailOutputId` lives in a different authority seam than `activeOutputId` and is cached/restored in `frontend/features/ai-studio/hooks/useAiStudioReferenceSelectionState.ts`, while derived modal output selection is computed in `frontend/features/ai-studio/hooks/useAiStudioOutputDerivations.ts`.

### Audit gaps that remain

- No explicit test was found that proves `detailOutputId` authority restore behavior across same-session project/authority changes.
- The production probes above were headless and did not reproduce the warning, so a browser-profile-specific or interaction-timing-specific trigger remains possible.

## What this audit disproved

1. The passive warning is not currently proven to be a generic project-bootstrap bug.
2. The passive warning is not currently proven to be caused by the `/_next/image` preview failures.
3. `DetailModal` is not the strongest default theory anymore:
   - it opens by deliberate double click from the Reference Grid
   - once open, the modal backdrop blocks the normal Projects button path
   - fresh restore defaults still clear detail selection

## Current best inference

The strongest remaining explanation is a narrower same-session authority-restore or surface-restore path that was not exercised by the clean production probes, or a browser/profile-specific wheel stream that headless automation did not surface.

That makes this a real gesture-runtime lane, but not yet a proven project-load bootstrap defect.

## Recommended decision

Treat this as a separate lane from the signed-media `/_next/image` failures.

When this work resumes:

1. do not start with state-reset patches or speculative restore clears
2. do not blanket-remove `preventDefault()` calls across the app
3. if an implementation lane is opened before a perfect repro exists, prefer one canonical wheel-plumbing cleanup across:
   - `DetailModal`
   - `Canvas`
   - `Expert Edit`

The target shape should be one native non-passive wheel handling model for true zoom/pan surfaces, not more restore special cases.

## Follow-up metric

- a fresh interactive production run on the known affected project path yields `0` passive-listener warnings
- zoom and pan behavior remain unchanged on `DetailModal`, `Canvas`, and `Expert Edit`
- no surface needs a parallel fallback gesture path to stay functional

## Next-agent restart checklist

1. Start from this packet, not from the earlier media-preview lane.
2. Reproduce on `https://www.shortpulse.ai`, not localhost.
3. Compare:
   - fresh project open
   - same-session project switch
   - return to a previously visited project
4. Record whether `Canvas`, `DetailModal`, or `Expert Edit` was visibly open before the warning appears.
5. Inspect `useAiStudioReferenceSelectionState` restore coverage before changing any restore behavior.
6. If a concrete owner surface is proven, fix that canonical seam directly instead of layering a restore patch on top.
