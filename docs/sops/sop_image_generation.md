# SOP: Image Generation (Text-to-Image) Workflows

This SOP documents how ShortPulse generates images from text prompts, how the UI and API interact, and how to maintain and improve the flow.
See `docs/sops/sop_ai_studio_index.md` for shared primitives, model defaults, and cross-vertical coordination.
For Create properties panel, model-selector, and submission wiring details, see `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`.

## Scope
- Image generation in AI Studio’s Create → Image flow.
- Model selection and cost estimation for image runs.
- Reference handling (drag/drop), prompt capture, and output book-keeping.
- Text/describe flows are covered in `docs/sops/sop_text_generation.md`; this SOP focuses on text-to-image and image-to-image/video behaviors.

## Key components

| Component | Role |
| --- | --- |
| `frontend/features/ai-studio/hooks/useAiStudioState.ts` + `frontend/features/ai-studio/hooks/useAiStudioStateEffects.ts` | Shared workspace state/actions and output/reference collections; state effects enforce aspect/resolution/reference compatibility guardrails. |
| `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts` + `useAiStudioGenerationPromptComposer.ts` + `useAiStudioTaskSubmission.ts` + `hooks/taskSubmission/*` | Generation preflight/invariants, prompt+reference composition, provider submit routing, and queued status polling lifecycle. |
| `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx` | Create properties UI (mode toggle, aspect/model/resolution selectors, prompt input, Generate CTA with estimated credits). |
| `frontend/features/ai-studio/components/StudioPreview.tsx` | Shows latest output/reference preview and allows drag/drop to seed regeneration; accepts dropped image files. |
| `frontend/features/ai-studio/components/ReferenceGrid.tsx` | Reference grid (draggable cards) and file drop surface for seeding references. |
| `frontend/features/ai-studio/logic/*` | Pricing (`pricing.ts`), prompt/token estimates, drag/drop utilities, and provider clients (Fal). |
| `frontend/pages/ai-studio.tsx` | Orchestrates panels, wires cost display, and renders the error banner. |
| `frontend/features/ai-studio/logic/promptGeneration.ts` | Client helper for prompt refinement (Agent 1) that can precede image generation. |

## Environment prerequisites

1. Image models rely on Fal provider keys; provider submission does not route through legacy prompt-generation endpoints.
2. `OPENAI_API_KEY` is still required for separate text/describe workflows documented in `docs/sops/sop_text_generation.md`; in chat-enabled Create sessions, generated image prompts may originate from agent output before provider submit.
3. Credits: generation debit/refund is server-authoritative through API submit routes; `useCredits` reads balance only.

## Image generation workflow (Create → Image)

1. User selects mode “Image” in CreatePropertiesPanel and chooses aspect + model (Fal options filtered by shared model-selection policy).  
2. In advanced mode (`beginnerMode` off), user can choose model-specific image resolution from the dedicated resolution step card (same control style as video settings).
3. User enters a prompt (optionally informed by previously described prompts).  
4. Generate CTA shows estimated credits via `computeCostForModel(model, { aspect, resolution })`; disabled until a model is selected or the user lacks sufficient credits.  
5. On click:  
   - `CreatePropertiesPanel.onGenerate` routes through `useAiStudioGenerationController.handlePrimarySubmit`, which runs start invariants/preflight and delegates prompt composition to `useAiStudioGenerationPromptComposer`.
   - `useAiStudioTaskSubmission` creates/reconciles optimistic output state, resolves `taskSubmission` handler route by model id, and submits provider payloads (including aspect/resolution/reference mappings).
   - Fal submit routes reserve credits before provider submission (no immediate debit posted).
   - Submit admission control may reject over-limit requests with `429` (`code: GENERATION_ADMISSION_LIMIT`) and `Retry-After`; denied requests release reservations immediately.
   - Fal success captures reservation into a debit; failed submit/status outcomes release reservation.
   - Task polling updates status; success stores `resultUrls`, sets `previewUrl`, and clears errors. Failures set `errorMessage` and stop polling.  
6. Reference Grid prepends the new output card; Studio Preview shows the latest image.  
7. On success, outputs are auto-saved to the Media Library as `source = ai_studio`, and audit events are logged. Save/Media Library buttons remain available for manual re-save and downstream use.

## Reference Grid re-roll (image cards)

- Re-roll is a card-level action in the Reference Grid all-refs surface.
- Re-roll is shown only when all conditions are true:
  - card is an image preview,
  - `mediaSource` is `generated`,
  - output has a valid `generationReplay` snapshot.
- Re-roll submits a new generation using output-scoped replay settings:
  - model id,
  - display/submission prompt pair,
  - effective aspect,
  - effective image resolution intent,
  - replay reference inputs captured from preflight-prepared provider-ready URLs,
  - character context metadata.
- Re-roll does not reuse current panel state and does not replace retry-status behavior:
  - `Retry status` polls an existing task id.
  - `Re-roll image` starts a new task.
- Re-roll fails fast when replay settings are missing/invalid or references are local-only (`blob:`/`data:`) and surfaces a deterministic UI notice.
- Legacy cards without replay snapshots do not render the reroll action in v1.

## Create startup model default (session restore)

- Source of truth: `frontend/features/ai-studio/logic/modelSelectionPolicy.ts`.
- Restore precedence in `useAiStudioWorkflowSettings`:
  1. Preserve saved Create model when it is still valid for current mode.
  2. For Create + Image with missing/invalid saved model, resolve to `fal-ai/bytedance/seedream/v4.5/text-to-image`.
  3. Keep `null` only when no valid/default model exists for the current mode.

## Character Mode (Create workflow)

- Scope: applies only to Create workflow when Character Mode is enabled in `CreatePropertiesPanel`.
- Model policy:
  - Create/Image model list is restricted to:
    - `fal-ai/bytedance/seedream/v4.5/edit`
    - `fal-ai/bytedance/seedream/v5/lite/edit`
    - `fal-ai/nano-banana-2/edit`
    - `fal-ai/nano-banana-pro/edit`
  - Toggle remap is paired and deterministic:
    - OFF -> ON maps paired text-to-image models to edit variants (fallback `seedream/edit`).
    - ON -> OFF maps paired edit variants back to text-to-image (fallback `seedream/text-to-image`).
  - Image resolution remains user-selectable per selected model (no forced Character Mode resolution override).
- Hidden prompt composition:
  - Provider-facing prompt prepends character description (when present), then appends user prompt.
  - UI-visible prompt (output cards, modals, saved prompt text) remains the user prompt only.
- Character Sheet references:
  - References are resolved from Character Manager active preset metadata (`character_sheet_presets_v1`) in canonical zone order (`portrait`, `close_up`, `front_shot`, `back_shot`).
  - If active preset zones are empty, the client falls back to legacy `character_sheet_assignments` slot mapping.
  - Character draft is refreshed before each Create/Text submit so preset switches and zone updates are applied immediately.
  - Resolved URLs are deduped and capped by provider limits.
  - Selected character id is persisted in browser local storage and restored on reload so Character Mode defaults to the user's latest explicit selection when available.
- Submission invariants:
  - Character Mode ON requires at least one Character Sheet image reference.
  - Missing character references blocks submit with explicit UI error (no description-only fallback submit).
  - A second safety-net invariant in task submission also blocks any selected image-to-image model when references are missing.
  - Pre-submit stages are deadline-bound:
    - Character bundle refresh deadline: 10s.
    - Reference URL preparation deadline: 10s.
    - On deadline expiry, generation fails fast with: `"Preparation timed out before generation started. Please retry."`
  - Submit-start invariant:
    - UI placeholder is only allowed to remain loading if provider submit produces a real `request_id` and polling starts.
    - If submit route resolves without starting polling, output is marked failed immediately with: `"Generation failed to start. Please retry."`

## Reference handling

- Users can drag existing reference cards (images) or drop external image files into the Reference Grid or Studio Preview; dropped files become `StudioOutput` entries with object URLs.
- For image-to-image/video modes, the primary reference is required; for pure text-to-image, references are optional.  
- Drag/drop is hardened to ignore non-image payloads and prefer real URLs over blobs when available.

## Prompt handling

- Prompt textarea is bound to shared `prompt` state; Save Prompt creates a text `StudioOutput` card.  
- When Image-to-Text mode is off, typed prompt text is used as the provider submit prompt unless a chat-originated canonical prompt is explicitly applied first.  
- Improvement: consider auto-filling the image prompt from the last describe result when switching from describe → image to reduce friction.

## Error handling & UX

- Prominent dismissible error banner surfaces API/flow failures (missing reference in describe mode, upstream errors).  
- Reference Grid cards show failure chips for failed tasks; Studio Preview shows status/error text.  
- Admission-limited submits should render deterministic retry guidance from the Fal client (`Too many active generations...retry in N seconds`).
- Generated placeholders without a provider task id now fail fast using submit-start timeout semantics instead of persisting spinner-only cards.
- Generate is disabled when required inputs are missing (e.g., model not chosen) or the credit balance is lower than the computed cost, so the banner can remind users to top up before retrying.

## Model usage

- Defaults: `gpt-5-nano` for text/vision calls (prompt refinement/describe); image models are chosen from the picker (Fal) and submit through provider-specific handler routes.
- Aspect normalization is provider/model-specific (see `pricing.ts` and `hooks/taskSubmission/{imageHandlers,defaultHandlers}.ts`).
- Cost computation: `computeCostForModel` uses aspect + selected image resolution where applicable (Nano Banana 2/Pro + Seedream tiers) for estimate display; generation charging happens server-side in submit APIs.
- Local reference ingestion: blob/data image inputs are uploaded through `/api/upload-image` and replaced with signed HTTPS URLs before submit; provider submit routes should receive URL payloads, not base64 bodies.

## Image resolution controls

- Temporary policy note: beginner mode is currently globally force-disabled by runtime flags (`NEXT_PUBLIC_SHORTPULSE_BEGINNER_MODE_FORCE_OFF=true`, toggle hidden), so AI Studio runs in expert mode by default across sessions.
- The image resolution step card appears only when `beginnerMode` is off.
- The card is shown in both `CreatePropertiesPanel` (text-to-image) and `EditPropertiesPanel` (image-to-image).
- Resolution options are model-driven from `modelRegistry.ts` (`allowedResolutions` + `defaultResolution`):
  - FLUX models / Nano Banana: `model_default` (no separate resolution enum exposed in current UI payload mapping).
  - Nano Banana 2 + Nano Banana 2 Edit: `0.5K`, `1K`, `2K`, `4K`.
  - Nano Banana Pro + Nano Banana Pro Edit: `1K`, `2K`, `4K`.
  - Seedream 4.5 + Seedream 4.5 Edit: `model_default`, `auto_2K`, `auto_4K`.
- Seedream 5 Lite + Seedream 5 Lite Edit: `auto_2K`, `auto_3K`.

## Expert Edit properties panel behavior

- Expert Edit is now the default Edit-workflow panel in expert mode.
- Legacy Edit panel remains the beginner fallback path and is preserved unchanged.
- Runtime kill switch: `NEXT_PUBLIC_ENABLE_EXPERT_EDIT_UI=false` reverts Edit to legacy panel.
- Expert Edit panel contracts:
  1. One primary edit drop zone + exactly three secondary drop zones.
  2. Inline prompt/composer row includes model/aspect/resolution selectors and inline Generate button.
  3. Generate remains disabled until primary reference image exists.
  4. Chat mode UI is hidden/off for Expert Edit.
  5. Inpaint editing can paint anywhere inside the primary drop zone (including outside the visible image bounds).
  6. Inpaint submit exports only the visible image-area mask window (`imageRect`) so FLUX Fill mask pixels remain aligned with flattened base-image dimensions.
  7. `Remove Background` submits the currently selected layer image only, routes regenerate through hidden Bria RMBG (`fal-ai/bria/background/remove`) with prompt-optional submit policy, and is a free action (no credit debit).
  8. Manual `Flatten Layers` action uses stage-faithful 1:1 flattening (square output, transparent uncovered pixels, current layer transforms/z-order), while provider submission flattening remains on the existing provider-oriented compose path.
  9. Layer stack uses a permanent foundation `layer 1` (clearable, never removable), all non-foundation layers are content-backed only, and primary image ingress inserts a new populated layer above the selected layer while preserving panel-top = visual-top z-order.
  10. Crop tool uses explicit aspect selection: no ratio is selected by default, ratio chips are toggleable, Crop mode renders a centered max-fit guide for the selected ratio, and `Crop` applies only to the active layer using stage-accurate pixels (including current move/resize/rotate) before resetting that layer transform. Crop selection does not change the global generation aspect selector.
  11. Styles selector is a right-rail panel (not a modal): the shared Styles control is available in Expert Edit and Expert Create, toggles a Styles section below Reference Grid, keeps a selected-style preview in the left Styles button, and keeps the panel open after style selection. Right-rail section visibility follows panel-header toggles, style-selection indicators are workflow-themed (Create blue, Edit amber, Video violet, Canvas cream), and the Styles helper text is hidden in expert mode.
  12. `Shortcuts -> Presets` opens a primary left-panel Presets Library populated from the full Expert Edit preset catalog (with overrides applied), keeps the right rail visible, and supports click-to-edit preset name/prompt in a modal.
  13. Submit-scoped model overrides (`modelIdOverride` or `inpaintOverride.modelId`) must not persistently mutate the selected model in panel state; they apply to that submit only.
  14. Hidden-output primary-reference replacement is intentionally scoped to remove-background (Bria RMBG) hidden outputs and must not trigger for arbitrary hidden image outputs.
  15. Inpaint lock uses shared constants from `frontend/features/ai-studio/logic/inpaintSubmission.ts` (`INPAINT_FLUX_FILL_MODEL_ID`, `INPAINT_FLUX_FILL_MODEL_LABEL`) for UI lock label and submit model identity.
- Prompt guard policy for Edit submit is model-capability driven (`editPromptPolicy`); unknown capability defaults to prompt required.

## Supported image models (current)

| Provider | Model id | Allowed aspects (examples) | Notes |
| --- | --- | --- | --- |
| Fal | `fal-ai/flux-2/klein/9b` | Uses `falSizeForAspect` (maps 1:1, 9:16, 16:9, etc.) | Text-to-image; fixed at 1 credit per run (exception to 5-credit rounding); safety checker off by default. |
| Fal | `fal/flux-2` | Uses `falSizeForAspect` (maps 1:1, 9:16, 16:9, etc.) | Text-to-image; defaults guidance 15, steps 41; outputs PNG; safety checker off by default. |
| Fal | `fal/flux-2/edit` | Uses `falSizeForAspect` (maps 1:1, 9:16, 16:9, etc.) | Image-to-image/edit; requires `image_urls`; safety checker off; per-MP pricing (same as FLUX.2); proxied through `/api/fal/flux2-edit-*`. |
| Fal | `fal/flux-2-pro` | Uses `falSizeForAspect` (maps 1:1, 9:16, 16:9, etc.) | Text-to-image; least-restrictive safety (checker off, tolerance 5); debits per tiered MP cost; outputs PNG. |
| Fal | `fal/flux-2-pro/edit` | Uses `falSizeForAspect` (maps 1:1, 9:16, 16:9, etc.) | Image-to-image/edit; requires `image_urls`; least-restrictive safety (checker off, tolerance 5); pricing matches FLUX.2 Pro text-to-image; proxied through `/api/fal/flux2pro-edit-*`. |
| Fal | `fal-ai/nano-banana` | 1:1 default (allowed: 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16) | Text-to-image via the Fal queue; flat per-image pricing ($0.039 -> 5 credits with 5-credit rounding) and PNG outputs, proxied through `/api/fal/nano-banana-*`. |
| Fal | `fal-ai/nano-banana/edit` | `auto` default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16) | Image-to-image/edit; requires `image_urls` references; flat per-image pricing (5 credits), proxied through `/api/fal/nano-banana-edit-*`. |
| Fal | `fal-ai/nano-banana-2` | `auto` default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16) | Text-to-image via the Fal queue; base per-image pricing starts at $0.08 with resolution multipliers (`0.5K x0.75`, `2K x1.5`, `4K x2`) and optional web-search surcharge, proxied through `/api/fal/nano-banana-2-*`. |
| Fal | `fal-ai/nano-banana-2/edit` | `auto` default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16) | Image-to-image/edit; requires `image_urls` references; pricing mirrors Nano Banana 2 text-to-image with resolution multipliers and optional web-search surcharge, proxied through `/api/fal/nano-banana-2-edit-*`. |
| Fal | `fal-ai/nano-banana-pro` | 4:5 default (wide/portrait variants allowed via the allowed list) | Text-to-image via the Fal queue with flat per-image pricing (4K doubles cost, web-search adds a surcharge) and PNG outputs; proxied through `/api/fal/nano-banana-pro-*`. |
| Fal | `fal-ai/nano-banana-pro/edit` | `auto` default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16) | Image-to-image/edit; requires `image_urls` references; flat per-image pricing (15 credits; 4K doubles; web_search adds 1.5 credits), proxied through `/api/fal/nano-banana-pro-edit-*`. |
| Fal | `fal-ai/bytedance/seedream/v4.5/text-to-image` | 1:1 default (allowed: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9) | Uses native `image_size` enums for core ratios and exact custom `{width,height}` payloads for non-native ratios (`5:4`, `4:5`, `3:2`, `2:3`, `21:9`); for `auto_2K`/`auto_4K`, the client now sends explicit aspect-locked dimensions (no ambiguous auto enum pass-through); safety checker off by default. |
| Fal | `fal-ai/bytedance/seedream/v4.5/edit` | 1:1 default (allowed: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9) | Image-to-image/edit; requires `image_urls`; uses native + exact custom `image_size` mapping like text-to-image, including explicit aspect-locked dimensions for `auto_2K`/`auto_4K`; safety checker off by default; proxied through `/api/fal/seedream-edit-submit` + `/api/fal/seedream-status`. |
| Fal | `fal-ai/bytedance/seedream/v5/lite/text-to-image` | 1:1 default (allowed: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9) | Text-to-image; supports `auto_2K`/`auto_3K` and custom `{width,height}` sizing; safety checker off by default; proxied through `/api/fal/seedream-v5-lite-submit` + `/api/fal/seedream-status`; pricing uses fixed `$0.035` base (5 billed credits after rounding). |
| Fal | `fal-ai/bytedance/seedream/v5/lite/edit` | 1:1 default (allowed: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9) | Image-to-image/edit; requires `image_urls` (up to 10); supports `auto_2K`/`auto_3K` and custom `{width,height}` sizing; safety checker off by default; proxied through `/api/fal/seedream-v5-lite-edit-submit` + `/api/fal/seedream-status`; pricing mirrors Seedream 5 Lite text-to-image. |

## Maintenance rules

1. Keep prompts in `frontend/lib/agentPromptsConfig.ts` (single source) and avoid duplicating in docs.  
2. Align SOP defaults with code (model defaults, server-side charging behavior).  
3. When adding models, update `modelOptions`, `pricing.ts`, and any aspect constraints; ensure the cost estimator and debit memo are correct.  
4. Run `npm run lint` after changes; smoke-test create/image flow (model select, prompt entry, generate, output appears, credit debited, no errors).

## Known gaps / improvements

- Credit UX: consider showing both estimated and actual debits (when available) in the Reference card or banner.  
- Error surfacing: add per-card retry affordance and friendlier inline messaging on the prompt form.  
- Caching: consider reusing the last refined prompt when switching from text → image to reduce duplicate API calls.  
- Accessibility: ensure drag/drop surfaces have keyboard equivalents (e.g., “Choose file” button focusable with Enter/Space).

## Upcoming flows (prepare ahead)
- Image-to-Image: will require at least one reference image; reuse the same Reference Grid/Studio Preview ingestion path and cost/debit rules as text-to-image. Confirm aspect clamping using the model’s `allowedAspects` from `modelRegistry.ts` and document any reference count limits here.
- Image-to-Video: align with the video SOP defaults (duration/audio/aspect from `modelRegistry.ts`), require a primary reference image, and surface the per-model reference requirement in the Generate disabled state copy. Update this section when the flow is wired.
