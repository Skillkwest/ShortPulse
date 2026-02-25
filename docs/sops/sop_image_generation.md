# SOP: Image Generation (Text-to-Image) Workflows

This SOP documents how ShortPulse generates images from text prompts, how the UI and API interact, and how to maintain and improve the flow.
See `docs/sops/sop_ai_studio_index.md` for shared primitives, model defaults, and cross-vertical coordination.

## Scope
- Image generation in AI Studio’s Create → Image flow.
- Model selection and cost estimation for image runs.
- Reference handling (drag/drop), prompt capture, and output book-keeping.
- Text/describe flows are covered in `docs/sops/sop_text_generation.md`; this SOP focuses on text-to-image and image-to-image/video behaviors.

## Key components

| Component | Role |
| --- | --- |
| `frontend/features/ai-studio/hooks/useAiStudioState.ts` | Central state/actions: handles prompt, aspect, model selection, submits generation, polls task status, and manages outputs/reference images. |
| `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx` | UI for Text flow (mode toggle, aspect, model picker, prompt textarea, Generate CTA showing estimated credits). |
| `frontend/features/ai-studio/components/StudioPreview.tsx` | Shows latest output/reference preview and allows drag/drop to seed regeneration; accepts dropped image files. |
| `frontend/features/ai-studio/components/ReferenceGrid.tsx` | Reference grid (draggable cards) and file drop surface for seeding references. |
| `frontend/features/ai-studio/logic/*` | Pricing (`pricing.ts`), prompt/token estimates, drag/drop utilities, and provider clients (Fal). |
| `frontend/pages/ai-studio.tsx` | Orchestrates panels, wires cost display, and renders the error banner. |
| `frontend/features/ai-studio/logic/promptGeneration.ts` | Client helper for prompt refinement (Agent 1) that can precede image generation. |

## Environment prerequisites

1. Image models rely on Fal provider keys; no agent prompts are involved in this flow.  
2. `OPENAI_API_KEY` is still required for the separate text/describe workflows documented in `docs/sops/sop_text_generation.md`; this SOP does not depend on those prompts.  
3. Credits: generation debit/refund is server-authoritative through API submit routes; `useCredits` reads balance only.

## Image generation workflow (Create → Image)

1. User selects mode “Image” in CreatePropertiesPanel and chooses aspect + model (Fal options filtered by shared model-selection policy).  
2. In advanced mode (`beginnerMode` off), user can choose model-specific image resolution from the dedicated resolution step card (same control style as video settings).
3. User enters a prompt (optionally informed by previously described prompts).  
4. Generate CTA shows estimated credits via `computeCostForModel(model, { aspect, resolution })`; disabled until a model is selected or the user lacks sufficient credits.  
5. On click:  
   - `useAiStudioState.submitTask` builds a `StudioOutput` with `taskState: "pending"` and submits to the provider (Fal) with aspect-mapped sizing; no agent prompts are involved.
   - Fal submit routes reserve credits before provider submission (no immediate debit posted).
   - Submit admission control may reject over-limit requests with `429` (`code: GENERATION_ADMISSION_LIMIT`) and `Retry-After`; denied requests release reservations immediately.
   - Fal success captures reservation into a debit; failed submit/status outcomes release reservation.
   - Task polling updates status; success stores `resultUrls`, sets `previewUrl`, and clears errors. Failures set `errorMessage` and stop polling.  
6. Reference Grid prepends the new output card; Studio Preview shows the latest image.  
7. On success, outputs are auto-saved to the Media Library as `source = ai_studio`, and audit events are logged. Save/Media Library buttons remain available for manual re-save and downstream use.

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
- When Image-to-Text mode is off, the typed prompt is sent as-is to the image model (no auto-describe and no agent prompts).  
- Improvement: consider auto-filling the image prompt from the last describe result when switching from describe → image to reduce friction.

## Error handling & UX

- Prominent dismissible error banner surfaces API/flow failures (missing reference in describe mode, upstream errors).  
- Reference Grid cards show failure chips for failed tasks; Studio Preview shows status/error text.  
- Admission-limited submits should render deterministic retry guidance from the Fal client (`Too many active generations...retry in N seconds`).
- Generated placeholders without a provider task id now fail fast using submit-start timeout semantics instead of persisting spinner-only cards.
- Generate is disabled when required inputs are missing (e.g., model not chosen) or the credit balance is lower than the computed cost, so the banner can remind users to top up before retrying.

## Model usage

- Defaults: `gpt-5-nano` for text/vision calls (prompt refinement/describe); image models are chosen from the picker (Fal) and use provider-specific clients without agent prompts.  
- Aspect normalization is provider/model-specific (see `pricing.ts` and submit logic in `useAiStudioState`).
- Cost computation: `computeCostForModel` uses aspect + selected image resolution where applicable (Nano Banana Pro + Seedream tiers) for estimate display; generation charging happens server-side in submit APIs.
- Local reference ingestion: blob/data image inputs are uploaded through `/api/upload-image` and replaced with signed HTTPS URLs before submit; provider submit routes should receive URL payloads, not base64 bodies.

## Image resolution controls

- The image resolution step card appears only when `beginnerMode` is off.
- The card is shown in both `CreatePropertiesPanel` (text-to-image) and `EditPropertiesPanel` (image-to-image).
- Resolution options are model-driven from `modelRegistry.ts` (`allowedResolutions` + `defaultResolution`):
  - FLUX models / Nano Banana: `model_default` (no separate resolution enum exposed in current UI payload mapping).
  - Nano Banana Pro + Nano Banana Pro Edit: `1K`, `2K`, `4K`.
  - Seedream 4.5 + Seedream 4.5 Edit: `model_default`, `auto_2K`, `auto_4K`.

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
| Fal | `fal-ai/nano-banana-pro` | 4:5 default (wide/portrait variants allowed via the allowed list) | Text-to-image via the Fal queue with flat per-image pricing (4K doubles cost, web-search adds a surcharge) and PNG outputs; proxied through `/api/fal/nano-banana-pro-*`. |
| Fal | `fal-ai/nano-banana-pro/edit` | `auto` default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16) | Image-to-image/edit; requires `image_urls` references; flat per-image pricing (15 credits; 4K doubles; web_search adds 1.5 credits), proxied through `/api/fal/nano-banana-pro-edit-*`. |
| Fal | `fal-ai/bytedance/seedream/v4.5/text-to-image` | 1:1 default (allowed: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9) | Uses native `image_size` enums for core ratios and exact custom `{width,height}` payloads for non-native ratios (`5:4`, `4:5`, `3:2`, `2:3`, `21:9`); for `auto_2K`/`auto_4K`, the client now sends explicit aspect-locked dimensions (no ambiguous auto enum pass-through); safety checker off by default. |
| Fal | `fal-ai/bytedance/seedream/v4.5/edit` | 1:1 default (allowed: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9) | Image-to-image/edit; requires `image_urls`; uses native + exact custom `image_size` mapping like text-to-image, including explicit aspect-locked dimensions for `auto_2K`/`auto_4K`; safety checker off by default; proxied through `/api/fal/seedream-edit-submit` + `/api/fal/seedream-status`. |

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
