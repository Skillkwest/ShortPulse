# SOP: Video Generation Workflows

This SOP documents how ShortPulse generates videos from text prompts or image references, how the UI and API interact, and how to maintain and improve the flow.
See `docs/sops/sop_ai_studio_index.md` for shared primitives, model defaults, and coordination across AI Studio verticals.
For Create properties panel, model-selector, and submission wiring details, see `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`.

## Scope

- Video generation in AI Studio’s Create → Video flow (text-to-video and image-to-video models).
- Model selection and cost estimation for video runs.
- Reference handling (drag/drop) and output book-keeping.
- Text/describe flows are covered in `docs/sops/sop_text_generation.md`; this SOP focuses on video behaviors.

## Active Kie video note

- Active public ShortPulse video scope is Kie-only.
- Active Kie video lanes are `kie-ai/veo-3.1-fast-i2v`, `kie-ai/kling-3.0`, `kie-ai/seedance-2`, and `kie-ai/seedance-2-fast`.
- Seedance 2.x uses the Kling-pattern video workspace UI while compiling to Seedance-specific Kie payloads.
- Lip Sync is the sole hidden-provider exception: the customer sees only the `Lip Sync` Video mode, while submission uses internal model id `fal-ai/bytedance/omnihuman/v1.5` through the generated Fal queue wrappers.

## Key components

| Component                                                                                                                                                                     | Role                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontend/features/ai-studio/hooks/useAiStudioState.ts` + `frontend/features/ai-studio/hooks/useAiStudioStateEffects.ts`                                                      | Shared workspace state/actions and output/reference collections; state effects enforce compatibility guardrails as tool/mode/model change. |
| `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts` + `useAiStudioGenerationPromptComposer.ts` + `useAiStudioTaskSubmission.ts` + `hooks/taskSubmission/*` | Generation preflight/invariants, prompt+reference composition, provider submit routing, and queued status polling lifecycle.               |
| `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`                                                                                                            | Create properties UI for text/image create modes; it routes generate events into the shared generation controller used across verticals.   |
| `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`                                                                                                             | UI for Video (reference drops, prompt textarea, aspect/model picker, Generate CTA).                                                        |
| `frontend/features/ai-studio/components/StudioPreview.tsx`                                                                                                                    | Shows latest output/reference preview and allows drag/drop to seed regeneration; accepts dropped image files for image-to-video.           |
| `frontend/features/ai-studio/components/ReferenceGrid.tsx`                                                                                                                    | Reference grid (draggable cards) and file drop surface for seeding references; renders inline video previews when outputs are mp4s.        |
| `frontend/features/ai-studio/logic/*`                                                                                                                                         | Pricing (`pricing.ts`), token estimates, drag/drop utilities, and provider clients (Fal).                                                  |
| `frontend/pages/ai-studio.tsx`                                                                                                                                                | Orchestrates panels, wires cost display, renders the error banner, and disables Generate when credits are insufficient.                    |

## Environment prerequisites

1. Video models rely on Fal provider keys; provider submission for video flows does not route through legacy prompt-generation endpoints.
2. `OPENAI_API_KEY` is still required for separate text/describe workflows documented in `docs/sops/sop_text_generation.md`; chat-enabled sessions can still source prompt text from agent output before submit.
3. Credits: generation charging is server-authoritative in submit APIs; `useCredits` reads `ai_credit_balance` and does not write ledger rows.

## Video generation workflow (Create → Video)

1. User selects Create → Video; `VideoPropertiesPanel` renders with aspect + model (video-capable options filtered by mode).
   - Resolution control is rendered only when the selected model declares `allowedResolutions` in the runtime model catalog; models without declared resolution support hide the selector.
2. User enters a prompt (and optionally prepares an image reference if the model requires/accepts it).
3. Generate CTA shows the admin-pricing grid `Billed credits` amount for the selected model/configuration; if the canonical billed row or pricing policy is unavailable, Generate fails closed with a pricing-unavailable guardrail instead of falling back to runtime pricing math.
4. On click:
   - Generate events route through `useAiStudioGenerationController.handlePrimarySubmit`, which runs start invariants/preflight and delegates prompt/reference composition.
   - `useAiStudioTaskSubmission` creates/reconciles optimistic output state, resolves `taskSubmission` handler route by model id, and submits Fal/Kie payloads (including aspect/duration/resolution/audio/reference mappings).
   - Fal submit routes reserve credits before provider submission (no immediate debit posted).
   - Submit admission control may reject over-limit requests with `429` (`code: GENERATION_ADMISSION_LIMIT`), `Retry-After`, and limiter metadata (`admissionScope`, `admissionReason`); denied requests release reservations immediately.
   - Fal success captures reservation into a debit; failed submit/status outcomes release reservation.
   - Task polling updates status; success stores `resultUrls`, sets `previewUrl` (video URL), and clears errors. Failures set `errorMessage` and stop polling.
5. Reference Grid prepends the new output card; Studio Preview shows the latest video thumbnail/preview if available.
6. On success, outputs are auto-saved to the Media Library as `source = ai_studio`, and audit events are logged. Save/Media Library buttons remain available for manual re-save and downstream use.

### Control-plane reliability notes

- Hosted/default `POST /api/internal/generation-recovery/run` invocations execute the primary queue-dispatch + recovery loop by default. Explicit `{"runMode":"rescue"}` is now reserved for bounded/manual recovery-only passes.
- Observation inbox processing is lease-claimed before execution; concurrent hosted control-plane runs should not process the same pending observation row simultaneously under normal operation.
- Recovery autosave/persistence fail-closes untrusted provider-returned media URLs. Recovery execution will not server-fetch arbitrary external result URLs outside trusted provider hosts or the explicit trusted media host policy.

### Model picker policy (Create → Video)

- Model chips are ordered deterministically by provider + workflow priority in the modal.
- The video model modal title is constant: `Video`.
- Standard Video mode (`reference-video` context) surfaces image-to-video models in this order:
  1. `kie-ai/veo-3.1-fast-i2v`
  2. `kie-ai/kling-3.0`
  3. `kie-ai/seedance-2`
  4. `kie-ai/seedance-2-fast`
- Standard Video mode is Kie-only.
- With no frame references present, Standard mode defaults to Kie Veo text-to-video behavior.
- The modal still allows manual selection of `kie-ai/kling-3.0`, `kie-ai/seedance-2`, and `kie-ai/seedance-2-fast` in that state; once Kling is selected, the first-frame dropzone becomes required and Generate remains disabled until the first frame is populated.
- Adding a last frame inside Standard Video must not force a model switch. Standard keeps the user-selected compatible model (`kie-ai/veo-3.1-fast-i2v`, `kie-ai/kling-3.0`, `kie-ai/seedance-2`, or `kie-ai/seedance-2-fast`) and submission derives the correct first-frame / first-last payload shape from the prepared inputs.
- Keyframe-style Veo generation is handled through `kie-ai/veo-3.1-fast-i2v` by switching Kie generation type based on the number of prepared frame references, not by forcing Standard into a separate hidden Veo-only mode.
- Kie Seedance 2 and 2 Fast use the Kling-pattern panel shell for `Single` and `Multi` prompt authoring plus linked Character/Element slots, but compile into Seedance-native prompt, frame, and multimodal reference fields.
- Seedance Elements mode maps to the provider's multimodal reference scenario. It overrides the Keyframes slot state: first/last frame images may remain visible in the inactive Keyframes UI, but they must not warn, block Generate, or be submitted while Elements mode is active.
- Seedance Elements slots accept saved Characters/Elements and direct single-image references from local upload, Reference Grid, Quick Slot Inventory, or Canvas tear-out.
- Saved Characters/Elements remain linked subjects: their media contributes to Seedance multimodal references and their names/descriptions may be compiled into prompt context. Saved Character slots may bind a specific Character look; that look's description and reference images drive the linked-subject media/prompt context for the Video run without changing the Character Manager active look. Direct single-image slots use `sourceKind = "reference-image"` and submit only as Seedance `reference_image_urls`; they are not draggable prompt tokens and must not add linked-subject prompt context.
- Seedance `Single` and `Multi` use Seedance-specific hidden prompt instructions, not the Kling hidden prompt strings.

### Lip Sync mode

- The Video mode toggle exposes `Standard`, `Motion Control`, and `Lip Sync`.
- `Lip Sync` does not expose a model picker chip or provider/model-specific labels.
- The left panel requires a `Character image` and `Voice audio`, and exposes `720p` / `1080p` through the shared video-settings resolution dropdown.
- `Faster generation` / turbo mode remains wired internally but is hidden from users for the July 7 launch; do not expose it until a future launch lane completes the product behavior.
- Prompt text is optional; empty prompt is valid when required image/audio inputs are present.
- Local voice-audio file picker/drop inputs use `/api/media/prepare-upload` -> browser direct upload -> `/api/media/finalize-upload` into app-owned durable audio storage and must reach a ready state before submit; already reachable Media Library / Reference Grid / Canvas audio URLs remain accepted when durable.
- Audio duration guardrails are enforced before provider submit: `1080p` requires audio under `30s` and `720p` requires audio under `60s`.
- Before Fal OmniHuman submit, the Lip Sync adapter stages the selected character image and voice audio through `/api/fal/upload-url` so upstream `image_url` and `audio_url` values are freshly verified Fal CDN URLs. App-owned media must stage from caller-owned storage paths when storage authority is known; signed/display URLs and existing Fal CDN URLs are re-staged as URL-only media with explicit `mediaKind` so OmniHuman receives image/audio MIME-compatible files. Client-side staging requests and server-side Fal CDN initiate/upload calls must be timeout-bounded; a staging timeout fails the optimistic output before provider submit rather than leaving a spinning placeholder. The server submit proxy rejects OmniHuman requests before billing/provider dispatch when either final URL is not on the Fal CDN. Do not recreate removed legacy source-intake adapters, and do not route Lip Sync provider staging through `/api/kie/upload-url`.
- The submit adapter sends only provider-supported fields upstream (`image_url`, `audio_url`, `resolution`, optional `prompt`, optional `turbo_mode`) plus ShortPulse sidecars that generated route wrappers strip before provider dispatch.
- Billing uses shared pricing policy at `$0.16` per audio/output second, with duration carried in `shortpulse_context` for server-authoritative debit.

### Kling 3.0 Standard shot modes

- Kie Kling Standard exposes two product shot modes in the panel:
  - `Single`
  - `Multi`
- These are app-level workflow modes. They do not map to three separate Kie provider endpoints.
- `Single` and `Multi` both submit through the documented Kie standard video route:
  - `model = kling-3.0/video`
  - top-level `prompt`
  - `multi_shots = false`
- Restored legacy custom state is no longer a separate submit path. It is normalized to the current visible `Multi` mode:
  - `model = kling-3.0/video`
  - top-level `prompt`
  - `multi_shots = false`

#### Shot mode behavior

- `Single`
  - One primary prompt box.
  - Sends the primary prompt to Kling as the top-level `prompt`.
  - Submit compilation prepends hidden shot-mode direction that constrains the provider prompt to one continuous shot with no cuts or additional setups.
  - First frame is required for Kling Standard.
  - Last frame is optional; when present it is sent as the second image reference on the standard single-shot path.
- `Multi`
  - One primary prompt box.
  - Uses the same standard single-shot Kling route as `Single`.
  - Submit compilation prepends hidden shot-mode direction that explicitly asks for a multi-shot sequence with distinct shot changes from the one authored prompt.
  - Elements can be referenced inline with `@ElementName` notation and are resolved through `kling_elements`.
  - First frame is required for Kling Standard.
  - Last frame is optional; when present it is sent as the second image reference on the standard single-shot path.
- Legacy/restored custom state
  - Displays as `Multi` in the current panel.
  - Submits the primary prompt through the same top-level `prompt` path as `Multi`.
  - Does not submit stale multiple shot prompt boxes or set `multi_shots = true`.

#### Kling Standard payload rules

- `Single` and `Multi` send:
  - primary prompt
  - hidden shot-mode prompt composition
  - selected video settings (`aspect_ratio`, `duration`, `resolution`, audio/sound flags, and other supported Kling controls)
  - first frame
  - optional last frame, only when populated
  - `kling_elements` when present
- Legacy/restored custom state is normalized before submit and sends the same payload shape as current `Multi`.
- Motion Control remains separate and uses the Kie motion-control route (`model = kling-3.0/motion-control`) with one character image, one provider-facing MP4/MOV motion video, `mode=720p|1080p`, the Motion audio setting, and optional linked Character/Element references through the same `kling_elements` contract as Standard Kling. Motion does not submit standard-video `aspect_ratio` or `duration`; text direction is optional once both motion inputs are present. Submit compilation rewrites missing inline `@elementN` tokens into the Motion prompt when linked elements are attached, but does not prepend Standard `Single`/`Multi` hidden shot-mode instructions. Local character-image files selected in the Motion slot stage through the canonical reference-image upload contract first, then `/api/kie/upload-url` applies the explicit `kie_motion_control_character_image` admission profile before Kie temp upload so provider-facing character images are JPEG/JPG/PNG, under 10 MB, at least 341 px on both sides, and within Kie's 2:5 to 5:2 aspect bounds.
- Local or recorded Motion Control clips stage through `POST /api/media/prepare-motion-reference-video-upload` -> browser direct upload -> `POST /api/media/stage-motion-reference-video`, then enter the slot as the canonical `{ url, path, size }` motion-reference contract. Oversized local clips are first browser-prestaged into a smaller MP4/WebM candidate so raw over-cap camera files do not hit Supabase storage before normalization. MP4, MOV, and WebM are intake formats only: the finalize route enforces the 3-30 second provider duration window, normalizes every motion-reference clip to canonical provider-facing MP4, rejects normalized output over Kie's 100 MB provider cap, and checks dimensions/aspect when ffmpeg exposes them before returning the Motion slot URL. The recorder modal also auto-stops at 30 seconds and uses the normalized MP4 result for both `Use clip` and `Export clip`.

## Reference-based video workflow (Create → Video, image-to-video models)

1. User opens the Video tool (`VideoPropertiesPanel`) and selects aspect + model.
2. User drops/uploads two reference frames (required): **First frame** (primary dropzone) and **Last frame** (second primary dropzone). Extra secondary dropzones are hidden in this flow.
3. User enters or drops a prompt into the prompt textarea.
4. Generate CTA shows estimated credits; disabled if either frame or the model is missing or credits are insufficient.
5. On click, the flow mirrors Create → Video: server-side charge, submit with the two reference frames, poll, and render the output in Reference Grid/Studio Preview.

## Reference handling

- Users can drag existing reference cards (images) or drop external image files into the Reference Grid or Studio Preview; dropped files become `StudioOutput` entries with object URLs.
- Image-to-video models require at least one reference image; Create → Video may be text-only unless a specific model demands an image.
- Drag/drop ignores non-image payloads and prefers real URLs over blobs when available.
- Image-input video submit prep shares the same reference-preflight runtime as image/edit flows (dynamic budget + abortable local fetch/upload/signed-refresh stages). On timeout, submit fails fast with: `"Preparation timed out before generation started. Please retry."`
- Seedance direct image slots selected from local files, canvas tear-outs, or external drops stage through the canonical reference-image upload contract before entering slot state. The staged URL is registered with its storage ref so generated Video workflow reload can restore the same direct image slot after project restore.
- Before Seedance 2 / Seedance 2 Fast provider submit, all Seedance image inputs (`first_frame_url`, `last_frame_url`, direct image slots, and linked Character/Element image references) are staged through `/api/kie/upload-url` with `admissionProfile="kie_seedance_reference_image"`. This provider-facing admission preserves the original ShortPulse media asset while resizing/encoding Kie-bound bytes so still images meet Kie's `300..6000` px width/height, `0.4..2.5` aspect-ratio, and under-`30 MB` image constraints without using Supabase image transformations.
- Generated Video outputs store manual workflow reload metadata in `workflow_reload`. The Video payload includes a `videoReferences` sidecar for first frame, last frame, Seedance multimodal image/video/audio references, and Kling/Seedance linked or direct element media. Reference Grid workflow reload must hydrate those slots from the sidecar when present, with legacy flat `referenceInputs`/Seedance/Kling arrays used only for older outputs that do not have the sidecar.

## Result ingestion & previews

- Status polling (`hooks/useAiStudioTasks.ts` with `hooks/taskPolling/*`) normalizes provider responses and extracts video URLs from multiple shapes: `video.url`, `video_url`, or `videos[]` (and their nested `data/output/result` variants). For Fal OmniHuman Lip Sync, result settlement is model-aware: `image_url`, `audio_url`, and other echoed input fields are ignored, and only generated video fields may create a completed output card.
- When a video URL is present, it is stored as `previewUrl` and rendered as an autoplaying muted loop in both Reference Grid cards and Studio Preview; images still use CSS backgrounds.
- If a completed task returns a URL but no card appears, verify the URL shape matches the handled keys above and that the dev server has been restarted after code changes.

## Prompt handling

- Prompt textarea is bound to shared `prompt` state; Save Prompt creates a text `StudioOutput` card.
- Prompt text is sent to the chosen video model through submission handlers; when chat output is explicitly applied first, that canonicalized text becomes the submitted prompt.
- For Kling Standard:
  - `Single` and `Multi` use the primary prompt textarea as the display prompt, while submit compilation adds canonical hidden shot-mode prompt composition before provider submit.
  - Legacy/restored custom state is normalized to the visible `Multi` mode before submit and does not use the persisted shot list (`klingMultiPrompts`) for provider payloads.
  - Seedance 2 and Seedance 2 Fast use Seedance-specific hidden `Single` vs `Multi` shot-mode prompt composition before compiling into Seedance-native prompt and multimodal reference fields.
- For Kling Motion Control:
  - The primary prompt remains optional once the required character image and motion reference video are populated.
  - Linked Character/Element slots use the same token rewrite and `kling_elements` payload contract as Kling Standard.
  - Motion Control does not use Standard hidden shot-mode prompt composition.
- Improvement: consider reusing the last describe result as a starting prompt when switching from describe → video.

## Error handling & UX

- Prominent dismissible error banner surfaces API/flow failures (missing reference for reference-required video models, upstream errors).
- Reference Grid cards show failure chips for failed tasks; Studio Preview shows status/error text.
- Admission-limited submits should render deterministic retry guidance from the Fal client (`Too many active generations...retry in N seconds`).
- Kie Kling submit preflight now fail-closes invalid media URLs before provider dispatch with deterministic `400 code=KIE_MEDIA_INPUT_INVALID` (invalid URL/protocol, unsupported extension, or signed URL token expiring too soon).
- Kie Kling submit preflight also rejects media URLs that fail remote fetch preflight (`non-2xx`) or return incompatible content types, reducing opaque upstream `422 file format not support` failures.
- Kie Kling linked elements fail before provider submit when the element shape violates Kie's element contract: image elements require `2-4` image URLs, video elements require exactly one video URL, image/video references cannot be mixed in the same element, and a task may include at most `3` elements.
- Generate is disabled when required inputs are missing (e.g., model or reference image for reference-required models) or when the credit balance is below the computed cost.

## Contract Boundary

- Video submit routes now enforce a canonical ingress contract before billing/provider submit:
  - alias normalization at ingress (`camelCase` -> canonical `snake_case` where supported),
  - strict unknown top-level field rejection (fail-closed),
  - deterministic alias-collision rejection when both alias and canonical keys are present with different values.
- Queue payloads for video submissions are stored with the versioned `video_submit_payload` v2 envelope.
- Queue dispatch requires that canonical envelope and rejects raw video payloads deterministically.
- Character-scoped media is blocked for video submissions:
  - payloads containing character metadata/path fields or media URLs with `/characters/` are rejected pre-submit and pre-dispatch.
- There are no runtime rollout knobs for video submit canonicalization. Canonical mode is the only supported mode.

## Model usage

- Video models are selected from the picker as Kie-only video entries.
- Aspect normalization is provider/model-specific (see `pricing.ts` and `hooks/taskSubmission/{videoHandlers,defaultHandlers}.ts`).
- Cost display and server charging resolve the same admin-pricing grid `Billed credits` row for the selected model/configuration and fail closed when that row is unavailable. Prompt-refine/describe flows currently report usage but are not debited. Video submit payloads are built by provider handlers after prompt selection is finalized in UI state.
- Resolution is treated as unsupported only for models with no declared `allowedResolutions`; Kling submit handlers pass selected resolution for Kie Kling standard and Motion Control lanes.

## Supported video models (current)

| Provider | Model id                                      | Allowed aspects (examples)                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | --------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kie      | `kie-ai/veo-3.1-fast-i2v`                     | 16:9 default (allowed: 16:9, 9:16)                      | Unified Kie Veo lane via `/api/fal/kie-veo-submit` + `/api/fal/kie-veo-status`. Prompt-only generates `TEXT_2_VIDEO`; one frame generates `FIRST_AND_LAST_FRAMES_2_VIDEO` with one image; two frames generate `FIRST_AND_LAST_FRAMES_2_VIDEO` with first/last references. Pricing displays and debits the admin-pricing grid `Billed credits` row for the resolved Veo configuration.                                                                                                   |
| Kie      | `kie-ai/kling-3.0`                            | 16:9 default (allowed: 16:9, 9:16, 1:1)                 | Standard Kling routes through `/api/fal/kie-kling-submit` + `/api/fal/kie-kling-status` and requires image input. `Single` and `Multi` use standard single-shot submit with top-level `prompt`; restored legacy custom state is normalized to the visible `Multi` path before submit. Motion Control also routes through this model and normalizes to Kie motion-control submit shape (`model=kling-3.0/motion-control`, `input_urls` + `video_urls`, one image + one video, `mode=720p | 1080p`, optional audio). Motion uses the same admin-pricing billed-row cost display as other Video lanes. |
| Kie      | `kie-ai/seedance-2`, `kie-ai/seedance-2-fast` | 16:9 default (allowed: 1:1, 21:9, 4:3, 3:4, 16:9, 9:16) | Active Seedance 2 lanes via `/api/fal/kie-seedance-2-submit                                                                                                                                                                                                                                                                                                                                                                                                                             | status`and`/api/fal/kie-seedance-2-fast-submit                                                            | status`. Panel UX follows the Kling-pattern shot workspace and linked Character/Element surfaces, but submit compiles into Seedance-native prompt, frame, and multimodal reference payloads (`first*frame_url`, `last_frame_url`, `reference*\*\_urls`). Video settings expose duration `4-15`seconds; Seedance 2 supports`480p/720p/1080p`, Seedance 2 Fast supports `480p/720p`; audio defaults on; `return_last_frame`and`web_search` default off. |

## Maintenance rules

1. Keep prompt templates in `frontend/lib/agentPromptsConfig.ts` for text/describe helper routes only; do not introduce separate video-only prompt template files.
2. When adding video models, update the canonical model catalog lifecycle/surface metadata, pricing strategies (`frontend/lib/model-runtime/*`), and aspect constraints; picker visibility and admin pricing visibility should come from catalog surfaces. Ensure estimator/server charge metadata parity and update the table above.
3. Align SOP defaults with code (credit gating, charging behavior, model filtering).
4. Run `npm run lint` after changes; smoke-test Create → Video with text-only and reference-required models (prompt entry, generate, output appears, credit debited, no errors).

## Known gaps / improvements

- Add a lightweight video preview/thumbnail in Studio Preview for quick validation.
- Show both estimated and actual debits in Reference cards when provider usage is returned.
- Add retry affordance on failed video cards and clearer messaging when a required reference is missing.
- Consider pre-validating aspect/model combinations per provider to avoid submission errors.

## Upcoming flows / additions

- Additional image-to-video providers: document whether a primary reference is mandatory, the default duration/audio/resolution from `modelRegistry.ts`, and the charging behavior before enabling in UI.
- If a text-to-video provider requires image/context inputs, surface that requirement in the Generate disabled copy and add it to this table when live.
- Video-to-Video: plan to ingest a source clip (drag/drop + file picker), respect model defaults for aspect/duration/audio from `modelRegistry.ts`, and clarify pricing (per-second of output vs. input). Document trim/segment support and whether references beyond the source video are allowed before enabling.
