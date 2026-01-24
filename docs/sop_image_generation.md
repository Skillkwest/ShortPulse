# SOP: Image Generation (Text-to-Image) Workflows

This SOP documents how ShortPulse generates images from text prompts, how the UI and API interact, and how to maintain and improve the flow.

## Scope
- Image generation in AI Studio’s Create → Image flow.
- Model selection and cost estimation/debit for image runs.
- Reference handling (drag/drop), prompt capture, and output book-keeping.
- Text/describe flows are covered in `docs/sop_text_generation.md`; this SOP focuses on text-to-image and image-to-image/video behaviors.

## Key components

| Component | Role |
| --- | --- |
| `frontend/features/ai-studio/hooks/useAiStudioState.ts` | Central state/actions: handles prompt, aspect, model selection, submits generation, polls task status, debits credits, and manages outputs/reference images. |
| `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx` | UI for Create flow (mode toggle, aspect, model picker, prompt textarea, Generate CTA showing estimated credits). |
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

1. User selects mode “Image” in CreatePropertiesPanel and chooses aspect + model (Fal/Kie options filtered by mode).  
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
| Fal | `fal/flux-dev` | Uses `falSizeForAspect` (maps 1:1, 9:16, 16:9, etc.) | Pure text-to-image; debits on click; outputs JPEG. |
| Fal | `fal/kling-video-v1.6` | 16:9 enforced for video (uses reference image) | Image-to-video; requires an image reference; debits on click. |
| Kie | `seedream/4.5-text-to-image` | 1:1 enforced if invalid aspect | Text-to-image; debits on click. |
| Kie | `gpt-image-1` | 1:1 enforced if invalid aspect | GPT-image; debits on click; uses Kie proxy client. |

## Maintenance rules

1. Keep prompts in `frontend/lib/agentPromptsConfig.ts` (single source) and avoid duplicating in docs.  
2. Align SOP defaults with code (model defaults, debit timing).  
3. When adding models, update `modelOptions`, `pricing.ts`, and any aspect constraints; ensure the cost estimator and debit memo are correct.  
4. Run `npm run lint` after changes; smoke-test create/image flow (model select, prompt entry, generate, output appears, credit debited, no errors).

## Known gaps / improvements

- Credit UX: consider showing both estimated and actual debits (when available) in the Reference card or banner.  
- Error surfacing: add per-card retry affordance and friendlier inline messaging on the prompt form.  
- Caching: consider reusing the last refined prompt when switching from enhance → image to reduce duplicate API calls.  
- Accessibility: ensure drag/drop surfaces have keyboard equivalents (e.g., “Choose file” button focusable with Enter/Space).
