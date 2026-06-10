# AI Studio Video Lip Sync Remediation Plan

Purpose: fix the broken Lip Sync upload, preview, persistence, and Generate
failure behavior shown in the June 2026 screenshots without adding patchwork on
top of the partially built lane.

Status: implemented locally; production URL proof pending deploy
Owner/lane: Program 4, Workflows And Product Surfaces, with Program 1 pricing
and generation-runtime proof requirements
Created: 2026-06-10
Source request: Lip Sync broken upload/generate audit and autonomous
implementation-plan request, June 2026
Supersedes for this remediation lane:
`docs/planning/ai-studio-video-lip-sync-completion-plan-2026-06-10.md`

## Objective

Make Video -> Lip Sync usable and production-ready enough for the existing
hidden Fal OmniHuman v1.5 lane by fixing the canonical root issues:

- selected voice-audio preview must stay visually contained in the Lip Sync
  audio slot;
- local voice-audio files must become durable/app-owned and provider-reachable
  before Generate can submit;
- stale browser-local `blob:`/`data:` audio URLs must not be persisted,
  restored, or saved into workflow reload metadata as if durable;
- Generate failures must use product-safe Lip Sync copy and should not surface
  raw `Failed to fetch` when the app knows the problem is local-audio
  preparation;
- existing provider contract, pricing, right-rail authority, Standard Video,
  Motion Control, and customer-facing product language must remain intact.

## Source Of Truth

Operational authority:

- `AGENTS.md`
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- `frontend/AGENTS.md`
- `docs/AGENTS.md`

Product/runtime authority:

- `docs/sops/sop_video_generation.md`
- `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`
- `docs/adr/0083-create-mode-global-right-rail-authority.md`
- `docs/api/api-fal-omnihuman-v1-5.md`
- `frontend/lib/model-runtime/modelCatalog.ts`
- `frontend/lib/model-runtime/falModelIds.ts`
- `frontend/features/ai-studio/logic/lipSyncDuration.ts`

Provider authority to re-check before implementation:

- Fal OmniHuman v1.5 API page:
  `https://fal.ai/models/fal-ai/bytedance/omnihuman/v1.5/api`

Current provider contract expected by this plan:

- Model id: `fal-ai/bytedance/omnihuman/v1.5`
- Required upstream fields: `image_url`, `audio_url`
- Optional upstream fields used by ShortPulse: `prompt`, `resolution`,
  `turbo_mode`
- Optional upstream field intentionally out of scope: `mask_url`
- Resolutions: `720p`, `1080p`
- Audio limits: under `30s` for `1080p`, under `60s` for `720p`
- Output: `video.url`, plus `duration` when returned
- Pricing: `$0.16` per audio/output second

Stop before implementation if the provider docs no longer match those
assumptions.

## Current Findings

The screenshots map to these code-level causes:

- The large blue/dim preview overlay is caused by `ReferenceAudioPlayer`
  rendering `.reference-card-audio-shell`, which is absolutely positioned for
  Reference Grid cards. Lip Sync currently renders it inside
  `.video-lip-sync-audio-preview`, which is not a positioned/overflow-hidden
  frame.
- The `160s` audio guard is correct behavior, not a bug. The active
  `lipSyncDuration` helper enforces the provider limits.
- The Generate error `Voice audio preparation failed: Failed to fetch` comes
  from late local-audio preparation in `videoHandlers.ts`. Local file selection
  stores only a browser-local object URL and duration, then submit tries to
  fetch and upload that URL at Generate time.
- `LipSyncAudioState` is too thin: it only stores `{ url, durationMs }`. It
  has no source kind, upload status, storage path, readiness state, or
  product-safe preparation error.
- The durable session snapshot serializer strips `blob:`/`data:` workspace
  media, but workflow settings, hydration, and workflow reload still accept
  Lip Sync audio URLs too broadly and need explicit durable-only treatment.
- The existing plan allowed the Kie-named temporary upload helper for local
  audio, but this remediation should prefer app-owned storage-first readiness
  because the repo already uses that architecture for local audio/video in
  Voice Changer and local reference-image ingestion.

## Approved Scope

In scope:

- Focused Lip Sync audio preview containment and selected-audio UI states.
- Local file picker/drop audio staging for Lip Sync.
- Readiness-aware Lip Sync audio state and Generate guardrails.
- Durable-only persistence, hydration, and workflow reload for Lip Sync audio.
- Product-safe error copy for local-audio read/upload/preparation failure.
- Focused tests, docs updates, and validation required to prove the fixed lane.
- Preservation of Media Library, Reference Grid, Quick Slot Inventory, Canvas,
  Standard Video, Motion Control, Seedance, Kling, and existing hidden provider
  routing.

Out of scope:

- Mask editing.
- New providers, fallback providers, or backup submit paths.
- Exposing Fal, OmniHuman, Bytedance, raw model ids, route slugs, `image_url`,
  `audio_url`, `mask_url`, or `turbo_mode` in customer-facing UI.
- Broad Video panel redesign.
- Right-rail state forks.
- Billing conversion policy changes.
- Supabase policy or storage architecture changes beyond reusing existing
  canonical upload/staging services.
- Commit, push, deploy, or production release unless explicitly requested in
  the implementation turn.
- Fixing unrelated dirty files or unrelated shared-file failures.

## Implementation Rules

- Fix the canonical path. Do not layer a CSS-only or error-copy-only patch over
  a broken audio lifecycle and call the lane done.
- Prefer existing upload/readiness patterns before adding routes. If a new route
  is required, document why existing routes are insufficient and keep the new
  route Lip Sync scoped.
- Treat local `blob:` and `data:` audio URLs as same-session preview details,
  not durable generation inputs.
- Generate can stay visually ready per the repo CTA contract, but must be
  validation-blocked when Lip Sync audio is missing, uploading, failed, stale, or
  duration-invalid.
- Do not run localhost/manual browser proof as production proof under the
  pre-launch policy.

## Batch 0: Freshness And Worktree Gate

Goal: start implementation from current authority instead of stale planning
language.

Steps:

1. Confirm local branch is `production`.
2. Confirm `git config --local shortpulse.allowedBranch` is `production`.
3. Run the generated-artifact safety check before broad commands.
4. Re-open the Fal OmniHuman v1.5 source URL and verify required fields,
   optional fields, resolution enum, duration limits, output shape, and pricing
   assumptions still match this plan.
5. Run `git status --short`.
6. For every dirty file that must be edited, inspect its current diff and
   preserve unrelated work.
7. Read the current working-tree versions of all files that will be edited.

Stop if provider docs changed, the worktree has inseparable conflicts in the
required files, or implementing the plan would require an out-of-scope route,
provider, billing, storage-policy, branch, deploy, or right-rail decision.

Proof:

- Branch/allowed-branch values recorded in closeout.
- Dirty-worktree boundary recorded in closeout.
- Provider-contract check result recorded in closeout.

## Batch 1: Contain The Audio Preview

Goal: selected voice audio must not spill out of the Lip Sync audio slot.

Preferred path:

1. Keep the fix scoped to Lip Sync. Do not change the global Reference Grid
   audio-card positioning unless a current audit proves all callers need it.
2. Add a contained frame around `ReferenceAudioPlayer` in the Lip Sync audio
   slot or add a small `ReferenceAudioPlayer` variant that makes the caller
   choose card-contained vs inline-contained behavior.
3. Ensure the Lip Sync wrapper provides stable dimensions, `position: relative`,
   `overflow: hidden`, and a panel-appropriate preview height.
4. Keep play/pause controls usable and do not block the file/dropzone clear
   action.
5. Confirm labels remain product-only.

Files likely touched:

- `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`
- `frontend/features/ai-studio/components/shared/ReferenceAudioPlayer.tsx`
  only if a variant is cleaner than wrapper-only containment
- `frontend/styles/ai-studio-video-theme.css`

Proof:

- `VideoPropertiesPanel.test.tsx` keeps Lip Sync product-only rendering and
  selected-audio rendering.
- Visual/code review confirms `.reference-card-audio-shell` is contained by a
  positioned/overflow-hidden Lip Sync frame.

## Batch 2: Make Lip Sync Audio Readiness-Aware

Goal: a local audio file must not stay as a bare browser-local URL until
Generate.

Preferred architecture:

1. Expand `LipSyncAudioState` from `{ url, durationMs }` to a small explicit
   state object:
   - `url: string | null`
   - `durationMs: number | null`
   - `status: "empty" | "uploading" | "ready" | "failed"`
   - `sourceKind: "local" | "library" | "reference" | "canvas" | null`
   - `storagePath?: string | null`
   - `mimeType?: string | null`
   - `size?: number | null`
   - `error?: string | null`
   - optional same-session `previewUrl?: string | null` if durable URL and
     local preview need to be different
2. Local file picker/drop should:
   - create a same-session preview URL only for immediate playback;
   - read duration;
   - set status to `uploading`;
   - stage/upload the audio through the canonical app-owned path;
   - set status to `ready` with durable URL/path on success;
   - set status to `failed` with product-safe copy on failure.
3. Reuse `frontend/features/ai-studio/utils/audioUpload.ts` and
   `/api/upload-audio` if it is sufficient for this lane.
4. If `/api/upload-audio` is not sufficient for production-quality Lip Sync
   staging, mirror the existing browser-direct prepare/stage pattern used by
   Voice Changer, but only after documenting why the existing audio adapter is
   insufficient.
5. Media Library, Reference Grid, and Canvas audio inputs should become
   `ready` immediately only when they provide a durable/trusted URL or storage
   path. Same-session local references must be restaged rather than trusted as
   durable.

Files likely touched:

- `frontend/features/ai-studio/types.ts`
- `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`
- a focused helper/component if needed, for example
  `frontend/features/ai-studio/logic/lipSyncAudioState.ts` or
  `frontend/features/ai-studio/components/VideoLipSyncAudioControls.tsx`
- `frontend/features/ai-studio/utils/audioUpload.ts` only if product-safe error
  copy or metadata return shape needs a narrow extension

Proof:

- Local file selection/drop sets uploading state before durable URL is known.
- Successful upload stores a durable URL/path and allows Generate.
- Failed upload keeps Generate blocked and displays product-safe copy.
- Library/reference/canvas durable audio remains accepted.

## Batch 3: Guard Generate With Audio Readiness

Goal: Generate should be blocked for missing, uploading, failed, stale, or
duration-invalid Lip Sync audio before submit begins.

Steps:

1. Update the Lip Sync view-model guard to account for `lipSyncAudio.status`.
2. Preserve existing missing-character and missing-audio copy.
3. Add product-safe copy for:
   - audio still uploading;
   - audio upload failed;
   - stale/non-durable audio;
   - over-limit duration for selected resolution.
4. Keep the submit-time duration guard as a defensive backstop.
5. Keep the Generate CTA contract intact: do not add busy labels/spinners or
   disable only because a generation is already in flight.

Files likely touched:

- `frontend/features/ai-studio/hooks/useAiStudioViewModel.ts`
- `frontend/features/ai-studio/logic/lipSyncDuration.ts` only if helper copy or
  status helper belongs there
- `frontend/features/ai-studio/hooks/taskSubmission/videoHandlers.ts`

Proof:

- `useAiStudioViewModel.test.ts` covers uploading, failed, ready, missing, and
  duration-limit states.
- `check:generate-cta-contract` passes after Generate-surface edits.

## Batch 4: Submit Only Durable Provider-Reachable Audio

Goal: submit should no longer depend on reading a local `blob:` URL at Generate
time.

Steps:

1. Update the Fal OmniHuman submit adapter to require Lip Sync audio status
   `ready` and a non-local audio URL before provider prep.
2. Keep provider payload limited to `image_url`, `audio_url`, `resolution`,
   optional `prompt`, optional `turbo_mode`, plus ShortPulse sidecars that route
   wrappers strip before upstream dispatch.
3. Keep already provider-reachable durable audio on the existing URL prep path.
4. Keep a defensive local-audio catch only as a safety net, with product-safe
   stale-audio copy. Do not treat that catch as the primary lifecycle.
5. Consider renaming or wrapping Kie-named media-prep helpers only if it reduces
   confusion without broad refactor. Do not perform a route/helper rename as
   part of this lane unless required for correctness.

Files likely touched:

- `frontend/features/ai-studio/hooks/taskSubmission/videoHandlers.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/__tests__/videoHandlers.test.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts`

Proof:

- Local uploaded audio submits using the durable uploaded URL, not the local
  preview URL.
- Submit fails closed for non-ready or stale audio.
- Existing https durable audio path still works.
- Payload matrix remains limited to supported fields.

## Batch 5: Make Persistence And Reload Durable-Only

Goal: `blob:`/`data:` Lip Sync audio must not survive as trusted state through
workflow settings, hydration, session snapshots, or workflow reload.

Steps:

1. Keep session snapshot serialization sanitization for Lip Sync audio.
2. Add missing hydration sanitization for `workspace.lipSyncAudioUrl`.
3. Add workflow settings sanitization before save and before restore.
4. Add workflow reload payload normalization that rejects `blob:`, `data:`,
   non-http(s), localhost, and private-host audio URLs unless a future trusted
   internal media ref contract explicitly supports them.
5. Persist/restore durable URL, duration, status `ready`, and storage path when
   available.
6. Restore non-durable/stale audio as empty with a product-safe requirement to
   re-add audio, not as a selected audio object.

Files likely touched:

- `frontend/features/ai-studio/logic/sessionSnapshot.ts`
- `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
- `frontend/features/ai-studio/logic/workflowReload.ts`
- `frontend/features/ai-studio/hooks/useAiStudioWorkflowSettings.ts`
- `frontend/features/ai-studio/hooks/useAiStudioSessionSnapshotController.ts`
- related tests under `frontend/features/ai-studio/logic/__tests__/` and
  `frontend/features/ai-studio/hooks/__tests__/`

Proof:

- Snapshot tests prove local Lip Sync audio is stripped/null.
- Hydrator tests prove blob/data Lip Sync audio restores empty.
- Workflow settings tests prove blob/data Lip Sync audio is not persisted or
  restored.
- Workflow reload tests prove only durable Lip Sync audio reloads.

## Batch 6: UI Polish For Error And Readiness States

Goal: the fixed lifecycle should look intentional, not like a debug form.

Steps:

1. Show selected audio duration and status compactly inside the audio card.
2. Show uploading and failed states inside the Lip Sync audio card without
   overlaying the central prompt/composer area.
3. Keep `Clear` as a small app-styled action.
4. Keep `720p` / `1080p` as segmented buttons.
5. Keep `Faster generation` as a toggle/switch, not a raw checkbox.
6. Do not add tutorial text or provider/model names.

Files likely touched:

- `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`
- optional extracted Lip Sync audio component
- `frontend/styles/ai-studio-video-theme.css`

Proof:

- Component tests cover visible product text and interactions.
- Code review confirms scoped selectors do not affect Standard or Motion
  controls outside shared three-tab layout.

## Batch 7: Docs And Plan Closeout

Goal: update only durable docs that changed because of the implementation.

Required updates after implementation:

- `docs/sops/sop_video_generation.md`: confirm local audio staging is
  readiness-aware and durable before submit.
- `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`: confirm
  Generate guard behavior for uploading/failed/stale audio.
- This plan: mark completed batches and record any proof gap.

Conditional updates:

- `docs/api/api-fal-omnihuman-v1-5.md` only if provider contract changed.
- `docs/routes.md` and route indexes only if routes are added, removed, or
  renamed.
- ADR only if implementation requires a new durable upload architecture rather
  than reusing existing canonical upload/staging patterns.

Proof:

- `npm -C frontend run docs:check` passes or any unrelated docs failure is
  clearly bounded.

## Implementation Closeout Notes

Local implementation completed on the `production` branch against the current
provider contract. The buildout reused existing app-owned audio upload/storage
infrastructure and did not add routes, providers, billing-policy changes,
right-rail forks, commits, pushes, deploys, or production cutover work.

Completed batches:

- Batch 0: current branch, allowed branch, generated-artifact guard, dirty
  worktree boundary, and Fal OmniHuman v1.5 provider contract were refreshed.
- Batch 1: Lip Sync audio preview is contained by a scoped positioned frame.
- Batch 2: `LipSyncAudioState` is readiness-aware and local audio uploads into
  durable app-owned storage before becoming ready.
- Batch 3: Generate is blocked for missing, uploading, failed, stale, and
  duration-invalid Lip Sync audio with product-safe copy.
- Batch 4: submit requires ready durable audio and fails closed for stale local
  audio.
- Batch 5: session snapshots, hydration, workflow settings, and workflow reload
  treat Lip Sync audio as durable-only state.
- Batch 6: selected, uploading, and failed audio states render inside the Lip
  Sync audio card.
- Batch 7: SOP and plan status updates completed.

Proof completed:

- `npm -C frontend run test -- features/ai-studio/components/__tests__/VideoPropertiesPanel.test.tsx features/ai-studio/hooks/__tests__/useAiStudioViewModel.test.ts features/ai-studio/hooks/taskSubmission/__tests__/videoHandlers.test.ts features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts features/ai-studio/logic/__tests__/workflowReload.test.ts features/ai-studio/logic/__tests__/sessionSnapshot.test.ts features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts features/ai-studio/hooks/__tests__/useAiStudioSessionSnapshotController.test.ts`
  passed with 9 files and 299 tests.
- `node scripts/check_model_catalog_parity.js` passed.
- `npm -C frontend run fal:routes:check` passed.
- `node scripts/check_ai_studio_pricing_display_drift.js` passed.
- `npm -C frontend run check:generate-cta-contract` passed.
- `npm -C frontend run docs:check` passed.
- `npm -C frontend run lint` passed with existing unrelated warnings outside
  the Lip Sync lane.
- `npm -C frontend run build` passed.

Proof still required before release:

- Production URL manual/browser proof after deploy, because repo policy does not
  allow localhost proof to stand in for production behavior.

## Validation Order

Targeted tests first:

```bash
npm -C frontend run test -- features/ai-studio/components/__tests__/VideoPropertiesPanel.test.tsx features/ai-studio/hooks/__tests__/useAiStudioViewModel.test.ts features/ai-studio/hooks/taskSubmission/__tests__/videoHandlers.test.ts features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts features/ai-studio/logic/__tests__/workflowReload.test.ts features/ai-studio/logic/__tests__/sessionSnapshot.test.ts features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts
```

Contract checks:

```bash
node scripts/check_model_catalog_parity.js
npm -C frontend run fal:routes:check
node scripts/check_ai_studio_pricing_display_drift.js
npm -C frontend run check:generate-cta-contract
```

Broader checks after targeted proof passes:

```bash
npm -C frontend run lint
npm -C frontend run build
npm -C frontend run docs:check
```

Manual/production proof:

- Local tests and code inspection can prove implementation mechanics.
- Browser/manual validation that claims production behavior must target
  `https://www.shortpulse.ai` after deploy under the pre-launch policy.
- If commit/push/deploy is not in scope, closeout must say production proof is
  pending deploy.

## Autonomous Decision Rules

Proceed without asking when:

- the next step directly completes one of the batches above;
- the change stays in the named Lip Sync seams;
- the fix uses existing app-owned upload, state, persistence, pricing, or UI
  patterns;
- product-facing text stays provider-neutral;
- Standard Video, Motion Control, global right-rail state, branch policy,
  billing policy, and storage policy are preserved.

Stop and report when:

- provider docs invalidate the plan;
- implementation requires a new provider, fallback provider, broad storage
  architecture, billing policy change, right-rail fork, branch change, commit,
  push, deploy, or production release not approved in the current task;
- dirty work in a required file cannot be safely separated from this lane;
- validation blocks safe progress and the failure is not clearly in touched
  Lip Sync scope;
- the remaining work is mostly optional cosmetic churn, mask support, or broad
  refactor rather than fixing the screenshot-rooted failures.

## Implementation Closeout Requirements

When implementing this plan, close out with:

- source-of-truth plan path;
- batches completed;
- files changed;
- validation run and results;
- what remains unproven, especially production URL proof if not deployed;
- exact boundary for deferred work;
- whether any customer-facing provider/model language remains visible.
