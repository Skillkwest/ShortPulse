# SOP: Video Generation Workflows

This SOP documents how ShortPulse generates videos from text prompts or image references, how the UI and API interact, and how to maintain and improve the flow.
See `docs/sop_ai_studio_index.md` for shared primitives, model defaults, and coordination across AI Studio verticals.

## Scope
- Video generation in AI Studio’s Create → Video and Image-to-Video flows.
- Model selection and cost estimation/debit for video runs.
- Reference handling (drag/drop) and output book-keeping.
- Text/describe flows are covered in `docs/sop_text_generation.md`; this SOP focuses on video behaviors.

## Key components

| Component | Role |
| --- | --- |
| `frontend/features/ai-studio/hooks/useAiStudioState.ts` | Central state/actions: handles prompt, aspect, model selection, submits generation, polls task status, debits credits, and manages outputs/reference images/videos. |
| `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx` | UI for Create flow (mode toggle, aspect, model picker, prompt textarea, Generate CTA showing estimated credits). |
| `frontend/features/ai-studio/components/RecreatePropertiesPanel.tsx` | UI for Image-to-Video (reference drops, prompt textarea, aspect/model picker, Generate CTA). |
| `frontend/features/ai-studio/components/StudioPreview.tsx` | Shows latest output/reference preview and allows drag/drop to seed regeneration; accepts dropped image files for image-to-video. |
| `frontend/features/ai-studio/components/ReferenceCanvas.tsx` | Reference grid (draggable cards) and file drop surface for seeding references; renders inline video previews when outputs are mp4s. |
| `frontend/features/ai-studio/logic/*` | Pricing (`pricing.ts`), token estimates, drag/drop utilities, and provider clients (Fal/Kie). |
| `frontend/pages/ai-studio.tsx` | Orchestrates panels, wires cost display/debit, renders the error banner, and disables Generate when credits are insufficient. |

## Environment prerequisites

1. Video models rely on Fal/Kie provider keys; no agent prompts are used in this flow.  
2. `OPENAI_API_KEY` is still required for separate text/describe workflows documented in `docs/sop_text_generation.md`; video generation does not depend on those prompts.  
3. Credits: Supabase ledger is used for debits; ensure `useCredits` can fetch and insert ledger rows.

## Video generation workflow (Create → Video)

1. User selects mode “Video” in CreatePropertiesPanel and chooses aspect + model (video-capable options filtered by mode).  
2. User enters a prompt (and optionally prepares an image reference if the model requires/accepts it).  
3. Generate CTA shows estimated credits via `computeCostForModel(model, { aspect })`; disabled until a model is selected or the user lacks sufficient credits.  
4. On click:  
   - Credits are debited immediately (`debit(currentCostCredits, memo, refId)`), provided the balance is sufficient.  
   - `useAiStudioState.submitTask` builds a `StudioOutput` with `taskState: "pending"` and submits to the provider (Fal/Kie video) with aspect-mapped sizing and any reference inputs required by the model.  
   - Task polling updates status; success stores `resultUrls`, sets `previewUrl` (video URL), and clears errors. Failures set `errorMessage` and stop polling.  
5. Reference Grid prepends the new output card; Studio Preview shows the latest video thumbnail/preview if available.  
6. Save/Media Library buttons remain available for downstream use.

## Image-to-Video workflow (Recreate → Image to Video)

1. User opens the Image-to-Video tool (RecreatePropertiesPanel) and selects aspect + model.  
2. User drops/uploads a primary reference image (required) and optionally extra images.  
3. User enters or drops a prompt into the prompt textarea.  
4. Generate CTA shows estimated credits; disabled if reference or model is missing or credits are insufficient.  
5. On click, the flow mirrors Create → Video: debit, submit with reference image(s), poll, and render the output in Reference Grid/Studio Preview.

## Reference handling

- Users can drag existing reference cards (images) or drop external image files into Reference Canvas or Studio Preview; dropped files become `StudioOutput` entries with object URLs.  
- Image-to-Video requires at least one reference image; Create → Video may be text-only unless a specific model demands an image.  
- Drag/drop ignores non-image payloads and prefers real URLs over blobs when available.

## Result ingestion & previews

- Status polling (`useAiStudioState`) normalizes provider responses and extracts video URLs from multiple shapes: `video.url`, `video_url`, or `videos[]` (and their nested `data/output/result` variants).  
- When a video URL is present, it is stored as `previewUrl` and rendered as an autoplaying muted loop in both Reference Grid cards and Studio Preview; images still use CSS backgrounds.  
- If a completed task returns a URL but no card appears, verify the URL shape matches the handled keys above and that the dev server has been restarted after code changes.

## Prompt handling

- Prompt textarea is bound to shared `prompt` state; Save Prompt creates a text `StudioOutput` card.  
- Prompts are sent directly to the chosen video model (no agent prompts).  
- Improvement: consider reusing the last describe result as a starting prompt when switching from describe → video.

## Error handling & UX

- Prominent dismissible error banner surfaces API/flow failures (missing reference for image-to-video models, upstream errors).  
- Reference Grid cards show failure chips for failed tasks; Studio Preview shows status/error text.  
- Generate is disabled when required inputs are missing (e.g., model or reference image for image-to-video) or when the credit balance is below the computed cost.

## Model usage

- Video models are selected from the picker (e.g., Fal/Kie video entries).  
- Aspect normalization per provider (see `pricing.ts` and submit logic in `useAiStudioState`): Fal uses width/height; Kie video models may enforce specific aspects (e.g., 16:9).  
- Cost computation: `computeCostForModel` uses aspect; video runs debit on click. Text/describe flows (separate SOP) debit after API responses using observed/estimated tokens. No agent prompts are sent in video flows.

## Supported video models (current)

| Provider | Model id | Allowed aspects (examples) | Notes |
| --- | --- | --- | --- |
| Fal | `fal/kling-video-v1.6` | 16:9 default (allowed: 16:9, 9:16, 1:1) | Image-to-video; default duration 5s; per-second pricing ($0.095/s → 48 credits at 5s). |
| Fal | `fal/kling-video-v1.6-text` | 16:9 default (allowed: 16:9, 9:16, 1:1) | Text-to-video; default duration 5s; per-second pricing ($0.095/s → 48 credits at 5s). |
| Kie | `kling/v2-5-turbo-text-to-video-pro` | 16:9 default (allowed: 16:9, 9:16, 1:1) | Per-duration pricing ($0.35 for 5s + $0.07/additional s); defaults to 10s (70 credits). |
| Kie | `kling-2.6/text-to-video` | 16:9 default (allowed: 1:1, 16:9, 9:16) | Per-second pricing; defaults to 10s with audio on ($0.14/s → 140 credits). |
| Kie | `veo3` | 16:9 default (allowed: 16:9, 9:16, 1:1) | Per-second pricing; defaults to 8s @ 1080p with audio on ($0.40/s → 320 credits); 4K/audio-on is higher. |

## Maintenance rules

1. Keep prompts in `frontend/lib/agentPromptsConfig.ts` for text/describe only; video flows do not use agent prompts.  
2. When adding video models, update `modelOptions`, `pricing.ts`, and aspect constraints; ensure the cost estimator and debit memo are correct, update the table above, and keep model filtering accurate.  
3. Align SOP defaults with code (credit gating, debit timing, model filtering).  
4. Run `npm run lint` after changes; smoke-test Create → Video and Image-to-Video flows (reference required when applicable, prompt entry, generate, output appears, credit debited, no errors).

## Known gaps / improvements

- Add a lightweight video preview/thumbnail in Studio Preview for quick validation.  
- Show both estimated and actual debits in Reference cards when provider usage is returned.  
- Add retry affordance on failed video cards and clearer messaging when a required reference is missing.  
- Consider pre-validating aspect/model combinations per provider to avoid submission errors.

## Upcoming flows / additions
- Additional image-to-video providers: document whether a primary reference is mandatory, the default duration/audio/resolution from `modelRegistry.ts`, and the credit/debit timing before enabling in UI.
- If a text-to-video provider requires image/context inputs, surface that requirement in the Generate disabled copy and add it to this table when live.
- Video-to-Video: plan to ingest a source clip (drag/drop + file picker), respect model defaults for aspect/duration/audio from `modelRegistry.ts`, and clarify pricing (per-second of output vs. input). Document trim/segment support and whether references beyond the source video are allowed before enabling.
