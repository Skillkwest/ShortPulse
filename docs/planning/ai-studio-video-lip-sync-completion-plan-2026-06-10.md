# AI Studio Video Lip Sync Completion Plan

Purpose: finish the partially built AI Studio Video Lip Sync lane from the
current repo state, with enough detail for autonomous implementation without
further product clarification.

Status: superseded for remediation by
`docs/planning/ai-studio-video-lip-sync-remediation-plan-2026-06-10.md`
Owner/lane: Program 4, Workflows And Product Surfaces, with Program 1 pricing
and generation-runtime proof requirements
Created: 2026-06-10
Source request: Lip Sync baseline audit and follow-on implementation planning
thread, June 2026
Supersedes for remaining work:
`docs/planning/ai-studio-video-lip-sync-implementation-plan-2026-06-08.md`

## Done Definition

Lip Sync is complete enough for this lane when all of these are true:

- Video -> Lip Sync accepts one character image and one voice audio input from
  the supported app-owned surfaces.
- Local audio files chosen from the file picker or dropped onto the Lip Sync
  audio slot are converted into provider-reachable URLs before submit.
- Media Library / Reference Grid / Canvas audio sources still work and are not
  broken by local-file handling.
- Generate is blocked with clear product-language copy when required inputs are
  missing, audio upload is not ready, upload failed, or audio exceeds the
  provider limit for the selected resolution.
- Provider payloads contain only the supported upstream Lip Sync fields:
  `image_url`, `audio_url`, `resolution`, optional `prompt`, optional
  `turbo_mode`, plus ShortPulse sidecars stripped before upstream dispatch.
- The Lip Sync UI looks intentional in the current Video panel: no raw browser
  buttons, no default checkbox, no crushed label/helper text, and no provider
  names in customer-facing UI.
- Targeted tests, route/catalog checks, pricing checks, docs checks, and the
  Generate CTA contract pass.
- Any remaining proof gap is explicitly named as production deployment/manual
  validation, not silently treated as complete.

## Current Baseline

Already implemented and locally passing:

- Hidden model id: `fal-ai/bytedance/omnihuman/v1.5`.
- Hidden runtime label: `Lip Sync`.
- Model catalog entry, generated Fal submit/status wrappers, route inventory,
  submission adapter metadata, and model-selection policy.
- Lip Sync mode tab in `VideoPropertiesPanel`.
- Required character image and voice audio guardrails for missing inputs.
- Payload construction for image/audio/resolution/prompt/turbo.
- Pricing strategy at `$0.16` per second and duration context sidecars when
  duration is known.
- Canvas tear-out target for Lip Sync audio.
- Focused tests for panel rendering, model policy, payload shape, view-model
  missing-input guardrails, and video handler routing.

Known gaps to close:

- Local audio file selection now stages local audio into provider-reachable
  temporary media before submit.
- Audio duration limits are now enforced in Generate guardrails and submit-time
  validation when duration is known.
- Lip Sync-specific controls now have scoped panel styling for the audio card,
  empty state, resolution segmented buttons, clear action, and faster-generation
  switch.
- The implementation files are already large:
  `VideoPropertiesPanel.tsx`, `videoHandlers.ts`,
  `useAiStudioViewModel.ts`, and `ai-studio-video-theme.css`; add only narrow
  logic or extract focused helpers when that reduces risk.
- Production URL proof remains outstanding until the finished work is deployed
  to `https://www.shortpulse.ai`.

## Source Of Truth

Repo authority:

- `AGENTS.md`
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- `frontend/AGENTS.md`
- `docs/AGENTS.md`
- `docs/sops/sop_video_generation.md`
- `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`
- `docs/api/api-fal-omnihuman-v1-5.md`
- `docs/sops/sop_model_api_contract_reverification.md`
- `docs/sops/sop_new_model_ingestion.md`

Provider authority:

- Fal OmniHuman v1.5 API page:
  `https://fal.ai/models/fal-ai/bytedance/omnihuman/v1.5/api`
- Required upstream fields: `image_url`, `audio_url`.
- Optional upstream fields: `prompt`, `mask_url`, `turbo_mode`, `resolution`.
- Allowed resolutions: `720p`, `1080p`.
- Audio limits: under `30s` for `1080p`, under `60s` for `720p`.
- Output: `video.url`; provider may also return `duration`.

Product-language boundary:

- Customer UI may say `Lip Sync`, `Character image`, `Voice audio`, `720p`,
  `1080p`, and `Faster generation`.
- Customer UI must not say `Fal`, `OmniHuman`, `Bytedance`, raw model ids,
  route slugs, `image_url`, `audio_url`, `mask_url`, or `turbo_mode`.

## Scope

In scope:

- Local audio upload/provider-reachable staging for Lip Sync.
- Audio duration guardrails.
- Focused Lip Sync UI polish inside the existing Video panel.
- Tests and docs needed to prove the completed feature.
- Preservation of Standard Video, Motion Control, Seedance, Kling, Reference
  Grid, Quick Slot Inventory, and Canvas authority.

Out of scope:

- Mask editing.
- Provider/model picker exposure.
- New providers or fallback providers.
- Broad Video panel redesign.
- Billing conversion policy changes.
- Right-rail state forks.
- Supabase policy/storage architecture changes beyond reusing existing upload
  paths.
- Commit, push, deploy, or production release unless explicitly requested in
  the implementation turn.

## Implementation Sequence

### Batch 0: Freshness, Provider, And Worktree Gate

Before implementation edits:

1. Confirm local branch is `production`.
2. Confirm `git config --local shortpulse.allowedBranch` is `production`.
3. Run workspace safety check for generated backup/artifact directories before
   broad commands.
4. Re-open the Fal source URL from `modelCatalog.ts` and verify the required
   fields, optional fields, resolution enum, audio-duration limits, and output
   shape still match this plan.
5. Run `git status --short`; identify unrelated dirty files and preserve them.
6. Read the current working-tree versions of every file that will be edited.

Stop if provider docs changed in a way that invalidates the payload or pricing
contract; create a provider-contract update lane first.

### Batch 1: Local Audio Becomes Provider-Reachable

Goal: a user-selected local audio file must not reach provider submit as
`blob:` or another browser-local URL.

Preferred implementation path:

1. Add a small audio-local-source predicate near the video submit upload helpers
   or in a focused shared utility:
   - true for `blob:` URLs,
   - true for `data:audio/*`,
   - true for non-http(s) audio URLs,
   - true for local/private hostnames if this helper handles absolute URLs.
2. Update `prepareKieInputUrl` in
   `frontend/features/ai-studio/hooks/taskSubmission/videoHandlers.ts` so
   `mediaKind === "audio"` local sources route through
   `uploadSourceUrlToKieTemporaryFile`.
3. Reuse the existing binary upload path already present in the handler:
   `uploadSourceUrlToKieTemporaryFile` -> `uploadBlobToKieTemporaryFile` with
   `mediaKind: "audio"`.
4. Keep the existing URL-upload path for already provider-reachable Media
   Library / Reference Grid / Canvas audio URLs.
5. Add deterministic user-facing error copy if the local blob cannot be read:
   `Local voice audio is no longer available. Re-add the audio file and try
   again.`

Do not create a second upload route unless the existing video-handler upload
path proves incapable of handling audio blobs. If that happens, reuse
`frontend/features/ai-studio/utils/audioUpload.ts` and `/api/upload-audio`
instead of adding a new route.

Tests:

- `videoHandlers.test.ts`: local `blob:` audio is fetched, uploaded through the
  binary upload path as audio, and the final provider payload receives the
  uploaded URL.
- `videoHandlers.test.ts`: existing https audio URL still uses the existing URL
  upload/prep path.
- `videoHandlers.test.ts`: missing/unreadable local audio returns product-safe
  error copy.
- `submissionPayloadMatrix.test.ts`: Lip Sync payload shape remains limited to
  provider-supported fields plus allowed ShortPulse sidecars.

### Batch 2: Duration Guardrails

Goal: provider-invalid audio length is rejected before submit with clear
product copy.

Implementation:

1. Add one helper such as `resolveLipSyncAudioLimitSeconds(resolution)` in a
   focused logic file or near the existing Lip Sync view-model guard:
   - `1080p`: `30`
   - `720p`: `60`
2. Add a companion helper to check `durationMs` against the selected resolution.
3. Update `useAiStudioViewModel.ts` generation guardrails:
   - no character + no audio: existing copy stays valid,
   - no character: existing copy stays valid,
   - no audio: existing copy stays valid,
   - over limit: block Generate with product copy such as
     `Use voice audio under 30 seconds for 1080p Lip Sync, or switch to 720p
     for audio up to 60 seconds.`
4. Add a submit-time defensive check in `videoHandlers.ts` before provider
   submit. The view model owns UX, but submit should still fail closed if a
   stale UI path bypasses the guard.
5. Do not block unknown duration unless the provider or repo contract requires
   it; allow submit when duration cannot be read, but keep billing fallback
   behavior explicit in closeout if unverified.

Tests:

- `useAiStudioViewModel.test.ts`: `1080p` rejects known audio duration over
  30s.
- `useAiStudioViewModel.test.ts`: `720p` accepts audio over 30s and under 60s.
- `useAiStudioViewModel.test.ts`: `720p` rejects known audio duration over 60s.
- `videoHandlers.test.ts`: submit fails closed for over-limit known duration.
- Existing missing-input Lip Sync tests continue to pass.

### Batch 3: Focused Lip Sync UI Polish

Goal: make the Lip Sync panel look like a designed ShortPulse control surface,
not a first-pass debug form.

Implementation:

1. Prefer extracting the audio card into a small component if the edit would
   otherwise grow `VideoPropertiesPanel.tsx` further:
   `frontend/features/ai-studio/components/VideoLipSyncAudioControls.tsx`.
   Keep extraction behavior-preserving first, then polish.
2. Keep the left panel structure:
   - Video mode segmented control,
   - Character image slot,
   - Voice audio card,
   - resolution segmented control,
   - Faster generation toggle,
   - existing Generate summary and CTA.
3. Style only the Lip Sync-specific selectors in
   `frontend/styles/ai-studio-video-theme.css` unless a shared control class
   already exists.
4. Add or reuse styles for:
   - audio card background/border/radius consistent with nearby panel cards,
   - empty audio state with clear stacked title/helper,
   - drag-active state,
   - selected audio preview spacing,
   - `Clear` action as a small app-styled button,
   - `720p` / `1080p` as a segmented control, not raw white buttons,
   - `Faster generation` as an app-styled switch/toggle, not a default checkbox,
   - disabled/error/helper text that fits on narrow panels.
5. Keep labels product-only and short. Avoid tutorial text inside the app.
6. Do not alter Standard or Motion Control layout except where the shared mode
   segmented control must accommodate three tabs.

Tests:

- `VideoPropertiesPanel.test.tsx`: product-only Lip Sync text still renders.
- `VideoPropertiesPanel.test.tsx`: provider/model names do not render.
- `VideoPropertiesPanel.test.tsx`: resolution selection invokes the existing
  resolution setter.
- `VideoPropertiesPanel.test.tsx`: faster-generation toggle invokes the
  existing Lip Sync turbo setter.
- Add a class/assertion smoke test only where useful; do not overfit tests to
  cosmetic class names.

Visual proof:

- During the current pre-launch policy, do not claim local browser proof as
  production validation.
- If implementation is performed before deploy, final closeout may say visual
  proof is code/test-reviewed but production visual proof remains pending.
- After deploy, validate on `https://www.shortpulse.ai` with the same surface
  shown in the original screenshot.

### Batch 4: Pricing, Billing, And Metadata Confirmation

Goal: keep displayed credits, submit sidecars, and server billing aligned.

Implementation:

1. Confirm `computeOmniHumanV15PerSecondCost` still uses duration and the active
   pricing policy.
2. Confirm `useAiStudioTaskSubmission.ts` passes both
   `lip_sync_audio_duration_*` and generic `audio_duration_*` sidecars.
3. Confirm `generationBilling/pricingParams.ts` reads those duration fields.
4. If duration remains unknown, do not invent a fake provider duration. Let the
   current default/fallback behavior stand and name the residual limitation in
   closeout.
5. If tests reveal displayed cost and server debit can diverge for known
   duration, fix the canonical pricing param path instead of adding local
   component math.

Tests/checks:

- Existing pricing display drift script.
- Existing model catalog parity script.
- Add a focused pricing test only if current coverage does not prove
  `audio_duration_seconds` flows into the server pricing params.

### Batch 5: Docs And Index Updates

Goal: make the final behavior discoverable without bloating docs.

Required updates if implementation changes behavior:

- `docs/sops/sop_video_generation.md`: update known state from planned to
  implemented for local audio staging and duration guardrails.
- `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`: mention the
  local-audio provider-reachable staging and Generate guard behavior if needed.
- `docs/api/api-fal-omnihuman-v1-5.md`: update only if provider contract or
  ShortPulse defaults changed.
- `docs/planning/ai-studio-video-lip-sync-completion-plan-2026-06-10.md`:
  mark completed batches if the implementation pass is also asked to maintain
  the plan.

No route docs update is required unless routes are added, removed, or renamed.

### Batch 6: Validation Order

Run targeted checks first:

```bash
npm -C frontend run test -- features/ai-studio/components/__tests__/VideoPropertiesPanel.test.tsx features/ai-studio/hooks/taskSubmission/__tests__/videoHandlers.test.ts features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts features/ai-studio/logic/__tests__/modelSelectionPolicy.test.ts features/ai-studio/hooks/__tests__/useAiStudioViewModel.test.ts
node scripts/check_model_catalog_parity.js
npm -C frontend run fal:routes:check
node scripts/check_ai_studio_pricing_display_drift.js
npm -C frontend run check:generate-cta-contract
```

Then run broader checks when targeted checks pass:

```bash
npm -C frontend run lint
npm -C frontend run build
npm -C frontend run docs:check
```

If a command fails:

- Identify whether the failure is in touched Lip Sync scope or pre-existing
  unrelated scope.
- Fix touched-scope failures.
- Do not absorb unrelated failures unless they block this feature and the fix is
  lower risk than stopping.

## Autonomous Decision Rules

Proceed without asking the user when:

- The change is one of the in-scope batches above.
- The code path is one of the named owning seams.
- The fix preserves customer-facing product language.
- The fix reuses existing upload, pricing, route, or UI patterns.
- The fix reduces a known functional or UI readiness gap from this plan.

Stop and report instead of continuing when:

- Provider docs no longer match the current model catalog/API doc.
- A required fix would expose provider/model names in customer-facing UI.
- A required fix would require a new provider, fallback provider, route family,
  billing policy change, storage policy change, or right-rail architecture
  change.
- Local dirty changes in an implementation file cannot be safely separated.
- Remaining proof requires commit/push/deploy or production account access not
  granted in the current task.
- Remaining work is optional mask support, broad design redesign, or adjacent
  cleanup.

## Expected Final Closeout For Implementation

When this plan is implemented, report:

- Files changed.
- Which batches are complete.
- Validation commands and results.
- Whether any provider/model language is visible to customers.
- Whether local audio, Media Library audio, and Canvas/Reference Grid audio were
  each tested or remain unproven.
- Whether production URL proof is complete or still pending deploy.
