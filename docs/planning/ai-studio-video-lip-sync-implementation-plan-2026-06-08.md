# AI Studio Video Lip Sync Implementation Plan

Purpose: define the active implementation source for adding Lip Sync mode to
the AI Studio Video properties panel while keeping provider/model details hidden
from the customer-facing UI.

Status: active
Owner/lane: Program 4, Workflows And Product Surfaces, with Program 1 pricing
and generation-runtime proof requirements
Source request: current thread Lip Sync Video panel buildout request, June 8,
2026

## Objective

Add a third Video mode toggle, `Lip Sync`, beside `Standard` and `Motion
Control`. When selected, the Video properties panel must guide the user through
creating a speaking-character video from one human image and one audio clip,
then submit through the internal queued video provider path and return a normal
AI Studio video output.

The customer-facing product surface must not show Fal.ai, OmniHuman,
`fal-ai/bytedance/omnihuman/v1.5`, provider names, or model-specific labels.
The only visible mode/model indication for this feature is `Lip Sync`. Internal
catalog ids, route slugs, docs, tests, server logs, admin-only model inventory,
and implementation comments may name the provider/model when needed.

## Approved Scope

In scope:

- Add `Lip Sync` to the Video mode segmented toggle.
- Add Lip Sync-specific left-panel setup for required human image, required
  audio clip, resolution, and optional speed/quality control if the existing UI
  pattern can support it cleanly.
- Reuse the existing Video composer as an optional direction field with
  Lip Sync-appropriate placeholder/help text.
- Add internal model catalog, route inventory, pricing, payload validation,
  submit handler, queue polling, output parsing, reload metadata, and snapshot
  support needed for the hidden provider model.
- Price Lip Sync at `$0.16` per audio/output second through shared pricing
  policy and server-authoritative billing.
- Add guardrails for required image/audio and documented audio duration limits:
  `1080p` allows audio under `30s`; `720p` allows audio under `60s`.
- Update docs, route inventory docs, and tests required for the new behavior.

Out of scope:

- Exposing a model picker chip or model-specific label for Lip Sync.
- Showing Fal.ai, OmniHuman, Bytedance, or raw model ids in customer-facing UI.
- Redesigning the Video panel beyond the required Lip Sync mode.
- Changing Standard or Motion Control UX beyond compatibility needed for the
  new third toggle.
- Changing launch posture, branch policy, commit/push/deploy state, billing
  conversion policy, auth policy, Supabase policy, right-rail authority, or
  existing Kie video behavior.
- Adding fallback providers, duplicate submit paths, hidden backup routes,
  temporary bypasses, or compatibility shims that are not canonical.
- Implementing mask editing unless the base Lip Sync lane is complete and the
  user explicitly approves mask support as part of the same product surface.

## Source Of Truth

Use these sources while implementing:

- `AGENTS.md`, `docs/dev-ground-rules.md`, `docs/conventions.md`, and
  `docs/agent-playbook.md` for repo operating rules.
- `docs/sops/sop_new_model_ingestion.md` for model ingestion order.
- `docs/sops/sop_video_generation.md` for Video workflow behavior.
- `docs/sops/sop_ai_studio_create_properties_generation_wiring.md` for model
  selection, generation, and reload wiring.
- `docs/adr/0076-model-inventory-operator-only-and-server-allowlisted.md` for
  catalog/server allowlist authority.
- `skills/skill-pricing-audit/SKILL.md` and
  `skills/skill-pricing-wiring/SKILL.md` for pricing/debit alignment.
- API source from the current thread attachment:
  `/Users/worldbuilder/.codex/attachments/270c2760-641c-41f4-9fae-0fd6ac40cc64/pasted-text.txt`.

Provider contract to implement internally:

- Model id: `fal-ai/bytedance/omnihuman/v1.5`
- Submit: `POST https://queue.fal.run/fal-ai/bytedance/omnihuman/v1.5`
- Status: `GET https://queue.fal.run/fal-ai/bytedance/requests/$REQUEST_ID/status`
- Result: `GET https://queue.fal.run/fal-ai/bytedance/requests/$REQUEST_ID`
- Auth: `FAL_KEY`, server-side only
- Required provider inputs: `image_url`, `audio_url`
- Optional provider inputs: `prompt`, `mask_url`, `turbo_mode`, `resolution`
- Resolutions: `720p`, `1080p`; default provider resolution is `1080p`
- Output: `video.url`, plus `duration` when returned
- Pricing: `$0.16` per audio/output second

## Current Surface Map

Primary UI seam:

- `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`

State and panel prop seams:

- `frontend/features/ai-studio/hooks/useAiStudioReferenceSelectionState.ts`
- `frontend/features/ai-studio/hooks/useAiStudioVideoPanelProps.ts`
- `frontend/features/ai-studio/hooks/useAiStudioWorkflowSettings.ts`
- `frontend/features/ai-studio/hooks/useAiStudioCreationState.ts`
- `frontend/features/ai-studio/hooks/useAiStudioStateRuntimeControllers.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPageBaseRuntime.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPageGenerationRuntime.ts`
- `frontend/features/ai-studio/types.ts`

Model policy and catalog seams:

- `frontend/features/ai-studio/logic/modelSelectionPolicy.ts`
- `frontend/features/ai-studio/hooks/useAiStudioAllowedModelOptions.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPageDerivations.ts`
- `frontend/features/ai-studio/hooks/useAiStudioStateEffects.ts`
- `frontend/lib/model-runtime/falModelIds.ts`
- `frontend/lib/model-runtime/modelCatalog.ts`
- `frontend/lib/model-runtime/submissionAdapterMetadata.ts`

Submission and polling seams:

- `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/types.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/routeDispatch.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/videoHandlers.ts`
- `frontend/features/ai-studio/hooks/taskSubmission/videoPayloads.ts`
- `frontend/features/ai-studio/logic/stateParsers.ts`
- `frontend/lib/falClient.ts`
- `scripts/lib/fal_route_inventory.js`
- generated `frontend/pages/api/fal/*` wrappers from route sync

Pricing and billing seams:

- `frontend/lib/model-runtime/pricingTypes.ts`
- `frontend/lib/model-runtime/pricingStrategies.ts`
- `frontend/lib/model-runtime/modelPricingStrategyLabel.ts`
- `frontend/features/ai-studio/logic/clientPricingDisplay.ts`
- `frontend/features/ai-studio/hooks/useAiStudioViewModel.ts`
- `frontend/lib/server/api/generationBilling.ts`
- `frontend/lib/server/api/generationBilling/pricingParams.ts`

Media/audio reuse seams:

- `frontend/features/ai-studio/utils/audioUpload.ts`
- `frontend/features/ai-studio/components/shared/ReferenceAudioPlayer.tsx`
- `frontend/lib/internalReferenceDragPayload.ts`
- `frontend/features/ai-studio/logic/referenceSource/internalReferenceSource.ts`
- `frontend/features/ai-studio/logic/referenceGridMedia.ts`
- `frontend/features/ai-studio/logic/mediaLibraryDragPayload.ts`
- `frontend/features/ai-studio/logic/aiStudioDropSnapshot.ts`

Restore/reload seams:

- `frontend/features/ai-studio/logic/sessionSnapshot.ts`
- `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
- `frontend/features/ai-studio/logic/workflowReload.ts`
- `frontend/features/ai-studio/hooks/useAiStudioSessionSnapshotController.ts`
- `frontend/features/ai-studio/logic/projectWorkspaceSnapshot.ts`

## Product UX Contract

Video mode toggle:

- Show exactly three choices: `Standard`, `Motion Control`, `Lip Sync`.
- `Lip Sync` uses the same visual language as the existing segmented toggle.
- Switching to Lip Sync selects the internal Lip Sync-capable model
  automatically.
- Switching away restores the previous compatible Standard/Motion selection
  when available.

Left panel:

- Replace Standard/Motion setup with Lip Sync setup.
- Required image slot label should be product-language only, for example
  `Character image`.
- Required audio slot label should be product-language only, for example
  `Voice audio`.
- Resolution control should expose `720p` and `1080p`.
- Any speed/quality control should be labeled generically, for example
  `Faster generation`, not `turbo_mode`.
- Do not show model families, provider badges, provider names, route names, raw
  API field names, or model-specific chips.

Composer:

- Prompt text is optional in Lip Sync.
- Empty composer is valid when required image/audio inputs are present.
- Placeholder/help copy should describe optional direction such as expression,
  framing, body movement, or mood.
- Existing style behavior should not be changed unless implementation proof
  shows it creates incorrect Lip Sync submissions.

Generate CTA:

- Preserve the repo's Generate CTA contract: no busy spinner, busy label, or
  disabling purely because another generation is in flight.
- Disable only for existing credit/guardrail reasons and missing Lip Sync
  requirements.
- Credit display must use shared pricing display, not local component pricing.

Model presentation:

- The customer-facing modal should not show the hidden provider/model as a
  selectable chip.
- In Lip Sync mode, the panel can behave as if Lip Sync is the selected mode
  rather than a visible model selection.
- Admin/operator-only inventory can still include the actual internal model id.

## Implementation Batches

### Batch 0: Re-Audit And Dirty Worktree Guard

Before editing implementation files, re-run a narrow re-audit because this repo
currently has unrelated dirty changes in Video, modal, payload, docs, and style
files.

Required checks:

- Confirm branch is `production`.
- Confirm `git config --local shortpulse.allowedBranch` is `production`.
- Review `git status --short` and identify implementation files already dirty.
- For any dirty file that must be edited, read the current working tree version
  and preserve unrelated changes.
- Do not revert, overwrite, or normalize unrelated Kie/GPT Image changes.

### Batch 1: Internal Catalog, Route, And Pricing Authority

Add the hidden model through the canonical model-runtime path.

Required work:

- Add the internal Fal model id constant.
- Add a catalog entry with Video capability, internal submission adapter key,
  queued execution mode, allowed resolutions, payload validation, route slug,
  and internal provider metadata.
- Keep user-facing display labels generic or hidden for customer surfaces.
- Add a pricing strategy for `$0.16` per second.
- Add pricing labels and pricing coverage so the shared client display and
  server debit agree.
- Add route inventory for `omnihuman-v15` and run the Fal route sync generator.
- Ensure generated wrapper routes are committed only as generated output from
  route sync, not hand-authored one-offs.

Guardrails:

- Provider payload validation should allow only provider contract fields and
  ShortPulse metadata sidecars that generated routes strip before upstream
  submit.
- Duration used for billing should travel through `shortpulse_context`, not as
  an extra upstream provider field.

### Batch 2: First-Class Lip Sync Mode State

Add `lip-sync` as a first-class Video reference mode.

Required work:

- Extend Video mode unions, workflow settings, restore parsers, and runtime
  controllers.
- Add Lip Sync state for required image and required audio URL.
- Store audio duration metadata when available.
- Add reload/snapshot metadata so manual reload returns the user to Video →
  Lip Sync with image/audio/resolution restored where safely available.
- Keep Reference Grid, Quick Slot Inventory, and Canvas global; do not fork
  right-rail state.

Guardrails:

- Do not reuse Motion Control's reference-video state for audio.
- Do not use Seedance audio arrays as Lip Sync state.
- Do not create a separate top-level route or separate Video panel.

### Batch 3: Video Panel UI

Wire the visible Lip Sync product surface.

Required work:

- Add the third `Lip Sync` toggle to `VideoPropertiesPanel`.
- Add a focused Lip Sync input component if it keeps `VideoPropertiesPanel`
  safer than expanding existing Standard/Motion components.
- Support image input from existing app-owned image references and file drops.
- Support audio input from Media Library/reference-grid audio payloads and local
  audio files.
- Use `ReferenceAudioPlayer` or existing audio preview primitives for selected
  audio.
- Add resolution selection and optional faster-generation toggle only if they
  can use existing panel patterns without broad styling churn.
- Update disabled/guardrail copy for missing image, missing audio, and
  duration-limit violations.

Guardrails:

- User-visible text should say `Lip Sync`, `Character image`, `Voice audio`,
  `720p`, `1080p`, and similarly generic product terms.
- Do not show `Fal`, `OmniHuman`, `Bytedance`, `turbo_mode`, `image_url`,
  `audio_url`, `mask_url`, route slugs, or raw model ids.
- Avoid broad CSS redesign. Add only scoped styles needed to fit the existing
  Video panel language.

### Batch 4: Model Selection And Compatibility Effects

Make model selection deterministic without exposing the hidden model.

Required work:

- Add a Lip Sync lane to model selection policy.
- Make Lip Sync mode resolve only to the hidden internal model.
- Prevent the hidden model from appearing in Standard or Motion Control picker
  contexts.
- Preserve existing Standard Kie-only and Motion Control behavior.
- Add enter/exit behavior so prior compatible model selections are restored
  after leaving Lip Sync.

Guardrails:

- Do not rely on a visible model picker chip for this workflow.
- Do not collapse Lip Sync into Standard mode during restore.
- Do not auto-switch Standard models when existing Standard first/last-frame
  behavior should remain selected.

### Batch 5: Submission Adapter And Queue Polling

Add the actual Lip Sync submit path through the Video handler family.

Required work:

- Add handler support for the internal model id.
- Require Lip Sync mode, image, and audio before submit.
- Stage local audio through the existing audio upload helper before provider
  submit.
- Prepare/stage image references through the existing video/image preparation
  path.
- Build clean provider payload:

```json
{
  "image_url": "<prepared image URL>",
  "audio_url": "<prepared audio URL>",
  "resolution": "720p or 1080p",
  "prompt": "<optional prompt when present>",
  "turbo_mode": true
}
```

- Include billing duration and replay/reload metadata in ShortPulse sidecars,
  not in the upstream provider payload.
- Add polling provider normalization and result URL extraction if current
  generic parsing is not enough.
- Persist normal video outputs into Reference Grid/Studio Preview/Media Library
  like other Video generations.

Guardrails:

- Do not send unsupported fields upstream.
- Do not expose provider errors raw if they include model/provider language;
  map user-visible errors to generic Lip Sync wording when practical while
  preserving detailed diagnostics internally.
- Keep character-scoped media blockers active for Lip Sync image/audio inputs.

### Batch 6: Docs And Tests

Update durable docs and targeted coverage.

Required docs:

- Add `docs/api/api-fal-omnihuman-v1-5.md` as an internal API reference.
- Link the API reference from the docs API index if current docs checks require
  it.
- Update `docs/sops/sop_video_generation.md` to include Lip Sync mode and note
  that Standard remains Kie-only while Lip Sync uses an internal hidden provider
  model.
- Update `docs/sops/sop_ai_studio_create_properties_generation_wiring.md` for
  mode/model-selection behavior.
- Update `docs/routes.md` and `README.md` only if generated routes or route
  docs checks require them.

Required tests should cover:

- Lip Sync toggle renders beside Standard and Motion Control.
- Lip Sync panel shows product-only labels and does not render provider/model
  names.
- Lip Sync requires image and audio, not prompt text.
- Duration guardrails reject known over-limit audio for selected resolution.
- Model policy hides the internal model from Standard/Motion and resolves it
  for Lip Sync.
- Submission payload sends `image_url`, `audio_url`, `resolution`, optional
  `prompt`, and optional `turbo_mode` only.
- Billing uses `$0.16/sec` and reads duration from ShortPulse billing context.
- Fal route inventory covers the hidden model and generated routes.
- Queue polling extracts `video.url`.
- Workflow reload restores Lip Sync mode and generation-critical controls.

## Validation Commands

Run targeted checks first:

```bash
npm -C frontend run fal:routes:sync
npm -C frontend run test -- VideoPropertiesPanel.test.tsx modelSelectionPolicy.test.ts videoHandlers.test.ts submissionPayloadMatrix.test.ts stateParsers.test.ts
node scripts/check_ai_studio_pricing_display_drift.js
node scripts/print_ai_studio_pricing_action_inventory.js
```

Then run broader checks when targeted tests pass:

```bash
npm -C frontend run lint
npm -C frontend run build
npm -C frontend run docs:check
```

If Generate CTA surfaces are touched, also run:

```bash
npm -C frontend run check:generate-cta-contract
```

Manual/browser proof:

- Local tests and build can validate implementation details.
- Because the repo is in pre-launch mode, production-facing manual proof belongs
  on `https://www.shortpulse.ai` after deploy. Do not treat localhost as
  production proof unless the user explicitly asks for local validation.

## Stop Conditions

Stop implementation when:

- Video → Lip Sync is implemented, hidden-provider model submission works, cost
  display/server debit are aligned, and targeted validation passes.
- The next step would expose provider/model names in customer UI.
- The next step would alter Standard, Motion Control, Kie video behavior,
  right-rail authority, billing policy, auth policy, branch policy, commit,
  push, deploy, or production release state outside this plan.
- Required proof depends on commit, push, deploy, production release, or account
  work outside the current lane.
- Existing dirty worktree changes conflict with required edits and cannot be
  safely separated.
- Validation reveals a blocker that makes further autonomous implementation
  unsafe.
- Remaining work is mostly cosmetic churn, broad refactor, or optional mask
  support rather than required Lip Sync functionality.

## Final Closeout Requirements

When implementation completes or stops, report:

- What is complete.
- Which source-of-truth plan was followed.
- What validation passed.
- What remains unproven.
- Whether any provider/model language is still visible to customers.
- The exact boundary for any deferred work.
