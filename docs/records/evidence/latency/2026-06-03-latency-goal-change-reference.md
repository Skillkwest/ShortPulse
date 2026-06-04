# ShortPulse Latency Goal Change Reference 2026-06-03

Purpose: rollback and debugging reference for the latency-goal work performed toward the July 7 2026 launch performance floor.

Scope note: the worktree contained many unrelated modified, deleted, and untracked files during this goal. This document lists the latency-goal changes that were made, validated, or explicitly audited in this lane. Do not treat this as a complete dirty-worktree inventory.

## Source Of Truth

- Active plan: `docs/planning/shortpulse-latency-launch-plan-2026-07-07.md`
- Indexed from:
  - `docs/README.md`
  - `docs/planning/README.md`
- Goal constraint added during this lane: no UI changes, no UX changes, no visual redesign, no major behavior changes, and no speculative patches without clear latency ROI.

## Shared Payload Changes

### Global CSS import reduction

Files:

- `frontend/styles/globals.css`

Change:

- Removed global imports for:
  - `ai-studio-voice-changer-properties.css`
  - `ai-studio-tts-properties.css`
  - `workspace-profile.css`
  - `performance-core.css`
  - `performance-detail.css`
  - `performance-responsive.css`
  - `auth.css`

Why:

- Reduce app-wide CSS loaded through `_app.tsx`.
- Keep unrelated route styles out of the universal global stylesheet where possible.

Rollback symptom:

- Voice changer, text-to-speech, profile, performance, or auth route styling may look incomplete if those routes did not already load replacement CSS modules or route-specific styles.

Debug check:

- Inspect impacted routes visually before reverting.
- Confirm whether the affected route imports CSS modules or route-owned style helpers.

Remaining risk:

- `globals.css` still imports about 1.07 MiB of raw CSS. The next high-ROI CSS lane is route/feature CSS splitting, but that is a dedicated visual-regression-sensitive lane.

## AI Studio Startup And Hidden Panel Deferral

### Lazy-loaded hidden AI Studio panels

Files:

- `frontend/features/ai-studio/components/AiStudioPageContent.tsx`

Change:

- Converted heavy panel imports to `React.lazy` with `Suspense` fallbacks.
- Deferred panel code for Expert Edit, Character, Styles, Presets, Video, Music, Sound, Sound Effects, Voices, Elements, and Media Library until the relevant panel renders.

Why:

- Reduce initial AI Studio startup work and JavaScript loaded before the first usable shell.

Rollback symptom:

- A properties panel may show a loading fallback briefly before appearing.
- A panel may fail to render if its lazy import path or named export is wrong.

Debug check:

- Open each AI Studio panel listed above.
- Confirm no panel is stuck at `Loading panel...` or `Loading Media Library...`.

### Lazy-loaded Projects modal

Files:

- `frontend/features/ai-studio/components/AiStudioPageShell.tsx`

Change:

- Converted `ProjectsModal` to `React.lazy` so the modal code is not loaded until needed.

Why:

- Avoid loading project modal code during first shell render when the modal is closed.

Rollback symptom:

- Projects modal fails to open or remains on its fallback.

Debug check:

- Open the Projects modal from AI Studio and verify project list/create/open flows still work.

## Protected Startup Request Deferral

### Deferred model pricing policy load

Files:

- `frontend/features/ai-studio/hooks/useAiStudioPageBaseRuntime.ts`
- `frontend/features/ai-studio/hooks/useActiveModelPricingPolicy.ts`
- `frontend/features/ai-studio/hooks/__tests__/useActiveModelPricingPolicy.test.ts`

Change:

- Added an idle/fallback delay before enabling `useActiveModelPricingPolicy`.
- Kept model pricing policy behavior available after initial startup.

Why:

- Avoid blocking first usable AI Studio shell on pricing policy fetch when pricing is not immediately required.

Rollback symptom:

- Model pricing metadata may be unavailable slightly later than before in the first moments after load.

Debug check:

- Confirm generation submit and billing policy still use authoritative pricing before charge-sensitive actions.

### Deferred media autosave preference until outputs exist

Files:

- `frontend/features/ai-studio/hooks/useAiStudioPageBaseRuntime.ts`
- `frontend/features/ai-studio/hooks/useMediaAutosavePreference.ts`
- `frontend/features/ai-studio/hooks/__tests__/useMediaAutosavePreference.test.ts`

Change:

- Added an `enabled` option to media autosave preference loading.
- AI Studio only enables the preference hook when outputs exist.
- Local fallback storage was made user-scoped.

Why:

- Avoid user preference fetch/sync work before autosave can apply to generated outputs.

Rollback symptom:

- Autosave preference appears loading or defaults until generated outputs exist.
- If broken, autosave preference may not persist per user.

Debug check:

- Generate or load outputs, toggle autosave, reload, and confirm the preference persists for that user.

### Deferred Expert Edit preset runtime

Files:

- `frontend/features/ai-studio/hooks/useAiStudioPageBaseRuntime.ts`
- `frontend/features/ai-studio/hooks/useExpertEditSystemPresetCatalog.ts`
- `frontend/features/ai-studio/hooks/useExpertEditPresetPanelPreference.ts`
- `frontend/features/ai-studio/hooks/__tests__/useExpertEditSystemPresetCatalog.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useExpertEditPresetPanelPreference.test.ts`

Change:

- Added `enabled` gating for Expert Edit preset catalog and preference sync.
- Runtime loads when the selected tool enters an Edit workflow.

Why:

- Avoid Expert Edit catalog/preference startup fetches when AI Studio opens outside Edit.

Rollback symptom:

- Expert Edit presets may not load after entering Edit, or may load later than expected.

Debug check:

- Open Edit workflow and confirm system/custom presets populate and preference changes persist.

## Runtime Churn Reduction

### Credit snapshot polling throttling

Files:

- `frontend/features/ai-studio/hooks/useCredits.ts`
- `frontend/features/ai-studio/hooks/__tests__/useCredits.test.ts`

Change:

- Reduced idle credit snapshot refresh frequency.
- Guarded background refresh while the document is hidden.

Why:

- Reduce idle protected-route request churn.

Rollback symptom:

- Credit balance may refresh less aggressively while idle or hidden.

Debug check:

- Confirm balance refreshes after generation, explicit refresh, or visible activity.

### Generated output maintenance gating

Files:

- `frontend/features/ai-studio/hooks/useAiStudioGeneratedOutputMaintenance.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioGeneratedOutputMaintenance.test.tsx`

Change:

- Added document-visibility gating for generated output sync and audio/poster maintenance.
- Scheduled poster repair work through idle callback or short fallback timeout.

Why:

- Avoid reconciliation and poster repair work while the tab is hidden or startup is busy.

Rollback symptom:

- Poster or companion art repair may happen later, especially after returning to a hidden tab.

Debug check:

- Load outputs with missing poster/companion art, keep tab visible, and confirm repairs still occur.

### Task orchestration hidden-tab guard

Files:

- `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskOrchestration.test.ts`

Change:

- Added visibility-aware gating around visible-generation watchdog work.

Why:

- Reduce hidden-tab orchestration churn while preserving active visible generation checks.

Rollback symptom:

- Generation status may not reconcile while the tab is hidden.

Debug check:

- Start generation, hide/show tab, and confirm visible state reconciles when returning.

### Reference Grid and Media Library pressure sampling gates

Files:

- `frontend/features/ai-studio/hooks/useReferenceGridPerfWatchdog.ts`
- `frontend/features/ai-studio/hooks/__tests__/useReferenceGridPerfWatchdog.test.ts`
- `frontend/features/media-library/hooks/useMediaAdaptivePressure.ts`
- `frontend/features/media-library/hooks/__tests__/useMediaAdaptivePressure.test.ts`

Change:

- Added document-visibility state and disabled pressure sampling while hidden.

Why:

- Stop memory/long-task sampling loops from running in hidden tabs.

Rollback symptom:

- Adaptive preview quality may recover or degrade only after tab visibility resumes.

Debug check:

- Open heavy grid/media surfaces, hide and show tab, confirm adaptive state remains stable and resumes.

### Character option silent refresh visibility guard

Files:

- `frontend/features/ai-studio/hooks/useAiStudioCharacterModeLifecycle.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioCharacterModeLifecycle.test.ts`

Change:

- Added visibility checks before silent character option refresh.

Why:

- Avoid refreshing signed avatar options while the tab is hidden.

Rollback symptom:

- Character signed URLs may refresh only after tab becomes visible again.

Debug check:

- Open character mode, wait through refresh interval, and confirm options remain valid after returning to the tab.

## Heavy Project And Media Changes

### Media list signed seed reduction

Files:

- `frontend/pages/api/media/list.ts`
- `frontend/tests/api/media-list.test.ts`

Change:

- Reduced initial signed preview seed count for panel surfaces from 5 to 2.

Why:

- Make media list responses return sooner by warming only the earliest visible previews.

Rollback symptom:

- Some first-row media cards may wait for client visibility signing instead of arriving pre-signed.

Debug check:

- Open Media Library, Elements media panel, and Character media panel. Confirm first visible previews still appear and additional previews sign as they enter visibility.

### Serialized media signed URL chunks

Files:

- `frontend/lib/mediaSignedUrlCache.ts`
- `frontend/lib/__tests__/mediaSignedUrlCache.test.ts`

Change:

- Reduced default batch signing chunk concurrency from 2 to 1.
- Added a test proving signing chunks serialize as 60, 60, 10 for 130 paths.

Why:

- Avoid bursty signed URL requests during media-heavy opens.

Rollback symptom:

- Media-heavy opens may sign previews slightly more slowly but should put less burst pressure on the app/server.

Debug check:

- Open a large Media Library and verify previews continue to resolve without request storms.

### Project workspace restore/autosave cost reduction

Files:

- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioProjectWorkspacePersistenceController.test.ts`

Change:

- Skips recomputing the actual restore-visibility signature once bootstrap visibility has already been applied.
- Moved autosave snapshot candidate selection into memoized helper logic.
- Added test coverage to ensure prepared snapshot work does not rerun after bootstrap when unchanged.

Why:

- Reduce repeated heavy snapshot preparation and restore-visibility work during large project load/switch.

Rollback symptom:

- Restore visibility or autosave snapshot selection could become stale if memoization dependencies are wrong.

Debug check:

- Open a heavy project, switch projects, and confirm restore visibility, autosave, and generated/media references persist correctly.

## Audited But Not Patched

### Pulse built-ins catalog

Files inspected:

- `frontend/features/ai-studio/hooks/useCreatePulseBuiltInCatalog.ts`
- `frontend/features/ai-studio/hooks/createPulsePageRuntime/useCreatePulsePresetPageRuntime.ts`
- `frontend/features/ai-studio/components/create/CreatePulsePreferenceProvider.tsx`
- `frontend/features/ai-studio/components/create/PulseCreatePanelView.tsx`
- `frontend/features/ai-studio/components/UnifiedPresetsLibraryPanel.tsx`

Conclusion:

- No patch made. The page runtime already gates built-in catalog loading to Create plus Pulse mode.
- Provider fallbacks are mounted inside Pulse-specific or presets-library surfaces, not proven app-wide startup.

### Voice and audio routes

Files inspected:

- `frontend/features/ai-studio/hooks/useAiStudioAudioGeneration.ts`
- `frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx`
- `frontend/features/ai-studio/hooks/useSharedVoicesGrid.ts`

Conclusion:

- No patch made. Generation routes are user-submit paths, not background startup.
- Voices fetch appears panel-owned and generation-enabling, not a safe app-wide deferral.

### Global CSS route splitting

Files inspected:

- `frontend/styles/globals.css`
- `frontend/pages/_app.tsx`

Conclusion:

- No further patch made. This remains a high-ROI lane, but safe route splitting requires dedicated visual validation and likely CSS Module or route-owned architecture work.

## Validation Run During This Goal

Passed:

- `npm -C frontend run latency:ai-studio-inventory`
- Focused tests for runtime churn:
  - `features/ai-studio/hooks/__tests__/useCredits.test.ts`
  - `features/ai-studio/hooks/__tests__/useAiStudioTaskOrchestration.test.ts`
  - `features/ai-studio/hooks/__tests__/useAiStudioGeneratedOutputMaintenance.test.tsx`
  - `features/ai-studio/hooks/__tests__/useReferenceGridPerfWatchdog.test.ts`
  - `features/media-library/hooks/__tests__/useMediaAdaptivePressure.test.ts`
- Focused eslint for the same runtime churn files.
- `git diff --check` for the validated runtime churn files.

Failed or blocked:

- `npm -C frontend run check:size-budget` failed on pre-existing size-budget offenders:
  - `frontend/features/ai-studio/hooks/useAiStudioState.ts`
  - `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`
  - `frontend/features/ai-agent/useCreateAgentStateCore.ts`
- `npm -C frontend run build` failed on an existing TypeScript error:
  - `frontend/features/ai-studio/hooks/useAiStudioCreatePanelRuntime.ts`
  - `restartCurrentPulse` is not a known property on `UsePulseChatThreadsParams`.
- Production protected-route timing was blocked because `SHORTPULSE_STAGING_BEARER_TOKEN` was empty.

## Suggested Debug Order If Something Breaks

1. If a panel does not render, check the lazy imports in `AiStudioPageContent.tsx` and `AiStudioPageShell.tsx`.
2. If media previews load slowly or incompletely, check `pages/api/media/list.ts` and `lib/mediaSignedUrlCache.ts`.
3. If generated video posters, companion art, or generation status feel stale after tab visibility changes, check the visibility gates in generated-output maintenance and task orchestration.
4. If Expert Edit presets are missing, check the enabled gates in `useAiStudioPageBaseRuntime.ts`, `useExpertEditSystemPresetCatalog.ts`, and `useExpertEditPresetPanelPreference.ts`.
5. If autosave or restore looks stale on project load/switch, check `useAiStudioProjectWorkspacePersistenceController.ts`.
6. If route styling is missing, check removed `globals.css` imports first.

## Current Stopping Boundary

The next likely high-ROI lane is shared CSS route/feature splitting. Do not continue it as a quick cleanup. Treat it as a dedicated latency lane with source-size measurement, build proof if available, and visual smoke checks for every affected route or panel.
