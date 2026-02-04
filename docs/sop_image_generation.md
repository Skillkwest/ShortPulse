# SOP: Image Generation (Text-to-Image) Workflows

This SOP documents how ShortPulse generates images from text prompts, how the UI and API interact, and how to maintain and improve the flow.
See `docs/sop_ai_studio_index.md` for shared primitives, model defaults, and cross-vertical coordination.

## Scope
- Image generation in AI Studio’s Create → Image flow.
- Model selection and cost estimation/debit for image runs.
- Reference handling (drag/drop), prompt capture, and output book-keeping.
- Text/describe flows are covered in `docs/sop_text_generation.md`; this SOP focuses on text-to-image and image-to-image/video behaviors.

## Key components

| Component | Role |
| --- | --- |
| `frontend/features/ai-studio/hooks/useAiStudioState.ts` | Central state/actions: handles prompt, aspect, model selection, submits generation, polls task status, debits credits, and manages outputs/reference images. |
| `frontend/features/ai-studio/components/TextPropertiesPanel.tsx` | UI for Text flow (mode toggle, aspect, model picker, prompt textarea, Generate CTA showing estimated credits). |
| `frontend/features/ai-studio/components/StudioPreview.tsx` | Shows latest output/reference preview and allows drag/drop to seed regeneration; accepts dropped image files. |
| `frontend/features/ai-studio/components/ReferenceCanvas.tsx` | Reference grid (draggable cards) and file drop surface for seeding references. |
| `frontend/features/ai-studio/logic/*` | Pricing (`pricing.ts`), prompt/token estimates, drag/drop utilities, and provider clients (Fal/Kie). |
| `frontend/pages/ai-studio.tsx` | Orchestrates panels, wires cost display/debit, and renders the error banner. |
| `frontend/features/ai-studio/logic/promptGeneration.ts` | Client helper for prompt refinement (Agent 1) that can precede image generation. |

## Environment prerequisites

1. Image models rely on Fal/Kie provider keys; no agent prompts are involved in this flow.  
2. `OPENAI_API_KEY` is still required for the separate text/describe workflows documented in `docs/sop_text_generation.md`; this SOP does not depend on those prompts.  
3. Credits: Supabase ledger is used for debits; ensure `useCredits` can fetch and insert ledger rows.

## Image generation workflow (Create → Image)

1. User selects mode “Image” in TextPropertiesPanel and chooses aspect + model (Fal/Kie options filtered by mode).  
2. User enters a prompt (optionally informed by previously described prompts).  
3. Generate CTA shows estimated credits via `computeCostForModel(model, { aspect })`; disabled until a model is selected or the user lacks sufficient credits.  
4. On click:  
   - Credits are debited immediately (`debit(currentCostCredits, memo, refId)`), provided the balance is sufficient.  
   - `useAiStudioState.submitTask` builds a `StudioOutput` with `taskState: "pending"` and submits to the provider (Fal/Kie) with aspect-mapped sizing; no agent prompts are involved.
   - Task polling updates status; success stores `resultUrls`, sets `previewUrl`, and clears errors. Failures set `errorMessage` and stop polling.  
5. Reference Grid prepends the new output card; Studio Preview shows the latest image.  
6. Save/Media Library buttons remain available for downstream use.

## Reference handling

- Users can drag existing reference cards (images) or drop external image files into Reference Canvas or Studio Preview; dropped files become `StudioOutput` entries with object URLs.  
- For image-to-image/video modes, the primary reference is required; for pure text-to-image, references are optional.  
- Drag/drop is hardened to ignore non-image payloads and prefer real URLs over blobs when available.

## Prompt handling

- Prompt textarea is bound to shared `prompt` state; Save Prompt creates a text `StudioOutput` card.  
- When Image-to-Text mode is off, the typed prompt is sent as-is to the image model (no auto-describe and no agent prompts).  
- Improvement: consider auto-filling the image prompt from the last describe result when switching from describe → image to reduce friction.

## Error handling & UX

- Prominent dismissible error banner surfaces API/flow failures (missing reference in describe mode, upstream errors).  
- Reference Grid cards show failure chips for failed tasks; Studio Preview shows status/error text.  
- Generate is disabled when required inputs are missing (e.g., model not chosen) or the credit balance is lower than the computed cost, so the banner can remind users to top up before retrying.

## Model usage

- Defaults: `gpt-4.1-nano` for text/vision calls (prompt refinement/describe); image models are chosen from the picker (Fal/Kie) and use provider-specific clients without agent prompts.  
- Aspect normalization per provider (see `pricing.ts` and submit logic in `useAiStudioState`): Fal uses width/height; Kie/GPT-image enforce allowed aspects.  
- Cost computation: `computeCostForModel` uses aspect and, for text flows, token estimates; image/video runs debit on click, prompt/describe runs debit after the API response (observed/estimated tokens).

## Supported image models (current)

| Provider | Model id | Allowed aspects (examples) | Notes |
| --- | --- | --- | --- |
| Fal | `fal-ai/flux-1/schnell` | Uses `falSizeForAspect` (maps 1:1, 9:16, 16:9, etc.) | Text-to-image; defaults guidance 3.5, steps 4; debits per MP; outputs JPEG. |
| Fal | `fal/flux-2` | Uses `falSizeForAspect` (maps 1:1, 9:16, 16:9, etc.) | Text-to-image; defaults guidance 15, steps 41; debits on click; outputs PNG. |
| Fal | `fal/flux-2/edit` | Uses `falSizeForAspect` (maps 1:1, 9:16, 16:9, etc.) | Image-to-image/edit; requires `image_urls`; safety checker off; per-MP pricing (same as FLUX.2); proxied through `/api/fal/flux2-edit-*`. |
| Fal | `fal/flux-2-pro` | Uses `falSizeForAspect` (maps 1:1, 9:16, 16:9, etc.) | Text-to-image; least-restrictive safety (checker off, tolerance 5); debits per tiered MP cost; outputs PNG. |
| Fal | `fal/flux-2-pro/edit` | Uses `falSizeForAspect` (maps 1:1, 9:16, 16:9, etc.) | Image-to-image/edit; requires `image_urls`; least-restrictive safety (checker off, tolerance 5); pricing matches FLUX.2 Pro text-to-image; proxied through `/api/fal/flux2pro-edit-*`. |
| Fal | `fal/flux-2-max` | Uses `falSizeForAspect` (maps 1:1, 9:16, 16:9, etc.) | Text-to-image; least-restrictive safety (checker off, tolerance 5); debits per tiered MP cost (0.07 first MP, 0.03 each additional); outputs PNG. |
| Fal | `fal/imagen4/preview/fast` | 1:1 enforced if invalid aspect | Text-to-image; flat per-image pricing; outputs PNG. |
| Fal | `fal-ai/nano-banana` | 1:1 default (allowed: 21:9, 16:9, 3:2, 4:3, 5:4, 4:5, 3:4, 2:3, 9:16) | Text-to-image via the Fal queue; flat per-image pricing (4 credits) and PNG outputs, proxied through `/api/fal/nano-banana-*`. |
| Fal | `fal-ai/nano-banana/edit` | `auto` default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16) | Image-to-image/edit; requires `image_urls` references; flat per-image pricing (4 credits), proxied through `/api/fal/nano-banana-edit-*`. |
| Fal | `fal-ai/nano-banana-pro` | 4:5 default (wide/portrait variants allowed via the allowed list) | Text-to-image via the Fal queue with flat per-image pricing (4K doubles cost, web-search adds a surcharge) and PNG outputs; proxied through `/api/fal/nano-banana-pro-*`. |
| Fal | `fal-ai/nano-banana-pro/edit` | `auto` default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16) | Image-to-image/edit; requires `image_urls` references; flat per-image pricing (15 credits; 4K doubles; web_search adds 1.5 credits), proxied through `/api/fal/nano-banana-pro-edit-*`. |
| Fal | `fal-ai/bytedance/seedream/v4.5/text-to-image` | 1:1 enforced if invalid aspect | Text-to-image via Fal queue; safety checker on; debits on click. |

## Maintenance rules

1. Keep prompts in `frontend/lib/agentPromptsConfig.ts` (single source) and avoid duplicating in docs.  
2. Align SOP defaults with code (model defaults, debit timing).  
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
