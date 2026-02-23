# SOP: Video Generation Workflows

This SOP documents how ShortPulse generates videos from text prompts or image references, how the UI and API interact, and how to maintain and improve the flow.
See `docs/sops/sop_ai_studio_index.md` for shared primitives, model defaults, and coordination across AI Studio verticals.

## Scope
- Video generation in AI Studio’s Create → Video flow (text-to-video and image-to-video models).
- Model selection and cost estimation for video runs.
- Reference handling (drag/drop) and output book-keeping.
- Text/describe flows are covered in `docs/sops/sop_text_generation.md`; this SOP focuses on video behaviors.

## Key components

| Component | Role |
| --- | --- |
| `frontend/features/ai-studio/hooks/useAiStudioState.ts` | Central state/actions: handles prompt, aspect, model selection, submits generation, polls task status, and manages outputs/reference images/videos. |
| `frontend/features/ai-studio/components/TextPropertiesPanel.tsx` | UI for Text flow (mode toggle, aspect, model picker, prompt textarea, Generate CTA showing estimated credits). |
| `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx` | UI for Video (reference drops, prompt textarea, aspect/model picker, Generate CTA). |
| `frontend/features/ai-studio/components/StudioPreview.tsx` | Shows latest output/reference preview and allows drag/drop to seed regeneration; accepts dropped image files for image-to-video. |
| `frontend/features/ai-studio/components/ReferenceCanvas.tsx` | Reference grid (draggable cards) and file drop surface for seeding references; renders inline video previews when outputs are mp4s. |
| `frontend/features/ai-studio/logic/*` | Pricing (`pricing.ts`), token estimates, drag/drop utilities, and provider clients (Fal). |
| `frontend/pages/ai-studio.tsx` | Orchestrates panels, wires cost display, renders the error banner, and disables Generate when credits are insufficient. |

## Environment prerequisites

1. Video models rely on Fal provider keys; no agent prompts are used in this flow.  
2. `OPENAI_API_KEY` is still required for separate text/describe workflows documented in `docs/sops/sop_text_generation.md`; video generation does not depend on those prompts.  
3. Credits: generation charging is server-authoritative in submit APIs; `useCredits` reads `ai_credit_balance` and does not write ledger rows.

## Video generation workflow (Create → Video)

1. User selects Create → Video; `VideoPropertiesPanel` renders with aspect + model (video-capable options filtered by mode).
2. User enters a prompt (and optionally prepares an image reference if the model requires/accepts it).  
3. Generate CTA shows estimated credits via `computeCostForModel(model, { aspect })`; disabled until a model is selected or the user lacks sufficient credits.  
4. On click:  
   - `useAiStudioState.submitTask` builds a `StudioOutput` with `taskState: "pending"` and submits to the provider (Fal video) with aspect-mapped sizing and any reference inputs required by the model.  
   - Fal submit routes reserve credits before provider submission (no immediate debit posted).
   - Fal success captures reservation into a debit; failed submit/status outcomes release reservation.
   - Task polling updates status; success stores `resultUrls`, sets `previewUrl` (video URL), and clears errors. Failures set `errorMessage` and stop polling.  
5. Reference Grid prepends the new output card; Studio Preview shows the latest video thumbnail/preview if available.  
6. On success, outputs are auto-saved to the Media Library as `source = ai_studio`, and audit events are logged. Save/Media Library buttons remain available for manual re-save and downstream use.

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

## Result ingestion & previews

- Status polling (`useAiStudioState`) normalizes provider responses and extracts video URLs from multiple shapes: `video.url`, `video_url`, or `videos[]` (and their nested `data/output/result` variants).  
- When a video URL is present, it is stored as `previewUrl` and rendered as an autoplaying muted loop in both Reference Grid cards and Studio Preview; images still use CSS backgrounds.  
- If a completed task returns a URL but no card appears, verify the URL shape matches the handled keys above and that the dev server has been restarted after code changes.

## Prompt handling

- Prompt textarea is bound to shared `prompt` state; Save Prompt creates a text `StudioOutput` card.  
- Prompts are sent directly to the chosen video model (no agent prompts).  
- Improvement: consider reusing the last describe result as a starting prompt when switching from describe → video.

## Error handling & UX

- Prominent dismissible error banner surfaces API/flow failures (missing reference for reference-required video models, upstream errors).  
- Reference Grid cards show failure chips for failed tasks; Studio Preview shows status/error text.  
- Generate is disabled when required inputs are missing (e.g., model or reference image for reference-required models) or when the credit balance is below the computed cost.

## Model usage

- Video models are selected from the picker (Fal video entries).  
- Aspect normalization is provider/model-specific (see `pricing.ts` and submit logic in `useAiStudioState`).
- Cost computation: `computeCostForModel` uses aspect plus duration/resolution/audio defaults for estimate display; charging occurs in server submit APIs. Prompt-refine/describe flows currently report usage but are not debited. No agent prompts are sent in video flows.

## Supported video models (current)

| Provider | Model id | Allowed aspects (examples) | Notes |
| --- | --- | --- | --- |
| Fal | `fal-ai/kling-video/v3/pro/image-to-video` | 16:9 default (allowed: 16:9, 9:16, 1:1) | Image-to-video queue; requires a start image (`start_image_url`); optional end image when using keyframes. Per-second pricing ($0.224/s audio-off, $0.336/s audio-on, $0.392/s with voice control). Defaults to 10s with `generate_audio: true` and proxies through `/api/fal/kling-v3-image-to-video-*`. |
| Fal | `fal-ai/kling-video/v3/pro/text-to-video` | 16:9 default (allowed: 16:9, 9:16, 1:1) | Text-to-video queue; per-second pricing ($0.224/s audio-off, $0.336/s audio-on, $0.392/s with voice control). Defaults to 10s with `generate_audio: true` and proxies through `/api/fal/kling-v3-text-submit`. |
| Fal | `fal-ai/veo3.1/first-last-frame-to-video` | auto default (allowed: auto, 16:9, 9:16) | First/Last Frame queue; requires `first_frame_url` + `last_frame_url`; per-second pricing ($0.20/s audio-off, $0.40/s audio-on at 720p/1080p); defaults to 8s @ 720p with audio (320 credits). |
| Fal | `fal-ai/veo3.1/image-to-video` | auto default (allowed: auto, 16:9, 9:16) | Image-to-video queue; requires `image_url`; per-second pricing ($0.20/s audio-off, $0.40/s audio-on at 720p/1080p; 4K $0.40/$0.60). Defaults to 8s @ 720p with audio on. |
| Fal | `fal-ai/veo3.1` | 16:9 default (allowed: 16:9, 9:16) | Per-second pricing (unchanged); defaults to 8s @ 1080p with audio on (still billed via `veo-3-per-second`); 4K/audio-on is higher. |
| Fal | `fal-ai/sora-2/text-to-video/pro` | 16:9 default (allowed: 16:9, 9:16) | Tiered pricing: `rawCredits = ceil(usd / 0.01)`, final `credits = ceil(rawCredits / 5) * 5`. Standard tier uses 10s pricing (150 cr) for <=10s requests; High tier 10s = 330 cr (default). Queue accepts 4/8/12s; ShortPulse requests 8s by default (audio on) and polls Fal queue. |
| Fal | `fal-ai/bytedance/seedance/v1.5/pro/text-to-video` | 16:9 default (allowed: 16:9, 9:16, 1:1, 4:3, 3:4, 21:9) | Token-based pricing (`tokens = width*height*24*duration/1024`): audio $2.4 per 1M tokens, no-audio $1.2 per 1M. Defaults: 10s, 1080p (fall back 720p→480p), audio on. |

## Maintenance rules

1. Keep prompts in `frontend/lib/agentPromptsConfig.ts` for text/describe only; video flows do not use agent prompts.  
2. When adding video models, update `modelOptions`, `pricing.ts`, and aspect constraints; ensure the cost estimator and server charge metadata are correct, update the table above, and keep model filtering accurate.  
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
