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

| Component                                                                                                                                                                     | Role                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/features/ai-studio/hooks/useAiStudioState.ts` + `frontend/features/ai-studio/hooks/useAiStudioStateEffects.ts`                                                      | Shared workspace state/actions and output/reference collections; state effects enforce aspect/resolution/reference compatibility guardrails.              |
| `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts` + `useAiStudioGenerationPromptComposer.ts` + `useAiStudioTaskSubmission.ts` + `hooks/taskSubmission/*` | Generation preflight/invariants, prompt+reference composition, provider submit routing, and queued status polling lifecycle.                              |
| `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`                                                                                                            | Create properties UI (mode toggle, aspect/model/resolution selectors, prompt input, Generate CTA with estimated credits).                                 |
| `frontend/features/ai-studio/components/StudioPreview.tsx`                                                                                                                    | Shows latest output/reference preview and allows drag/drop to seed regeneration; accepts dropped image files.                                             |
| `frontend/features/ai-studio/components/ReferenceGrid.tsx`                                                                                                                    | Reference grid (draggable cards) and file drop surface for seeding references.                                                                            |
| `frontend/features/ai-studio/logic/*`                                                                                                                                         | Pricing (`pricing.ts`), prompt/token estimates, drag/drop utilities, and provider clients (Fal).                                                          |
| `frontend/pages/ai-studio.tsx`                                                                                                                                                | Orchestrates panels, wires cost display, and renders the error banner.                                                                                    |
| `frontend/pages/api/ai/studio-agent-standard.ts` / `frontend/pages/api/ai/studio-agent-pulse.ts`                                                                              | Mode-owned prompt-refinement and multimodal prompt-building routes used by Create before image generation when chat, Pulse, or refine actions are active. |

## Environment prerequisites

1. Fal-backed image models rely on `FAL_KEY`; those provider submissions do not route through legacy prompt-generation endpoints.
2. `OPENAI_API_KEY` is required for separate text/describe workflows documented in `docs/sops/sop_text_generation.md` and for the OpenAI `gpt-image-2` Create/Edit lanes exposed through `POST /api/openai/image-generate` and `POST /api/openai/image-edit`.
3. `KIE_API_KEY` or `SHORTPULSE_KIE_API_KEY` is required for the queued Kie GPT Image 2 text-to-image lane exposed through `/api/fal/kie-gpt-image-2-submit` + `/api/fal/kie-gpt-image-2-status` and the queued Kie GPT Image 2 image-to-image lane exposed through `/api/fal/kie-gpt-image-2-edit-submit` + `/api/fal/kie-gpt-image-2-edit-status`.
4. Credits: generation debit/refund is server-authoritative through API submit routes; `useCredits` reads balance only.

## Image generation workflow (Create → Image)

1. User selects mode “Image” in CreatePropertiesPanel and chooses aspect + model (provider options filtered by shared model-selection policy).
2. User can choose model-specific image resolution from the dedicated resolution step card (same control style as video settings).
3. User enters a prompt (optionally informed by previously described prompts).
4. Generate CTA shows estimated credits via `computeCostForModel(model, { aspect, resolution })`; disabled until a model is selected or the user lacks sufficient credits.
5. On click:
   - `CreatePropertiesPanel.onGenerate` routes through `useAiStudioGenerationController.handlePrimarySubmit`, which runs start invariants/preflight and delegates prompt composition to `useAiStudioGenerationPromptComposer`.
   - `useAiStudioTaskSubmission` creates/reconciles optimistic output state, resolves `taskSubmission` handler route by model id, and submits provider payloads (including aspect/resolution/reference mappings).
   - Fal/Kie and `gpt-image-2` routes reserve credits before provider submission (no immediate debit posted); direct-response OpenAI routes complete through `/api/openai/image-generate` and `/api/openai/image-edit`.
   - Submit admission control may reject over-limit requests with `429` (`code: GENERATION_ADMISSION_LIMIT`), `Retry-After`, and limiter metadata (`admissionScope`, `admissionReason`); denied requests release reservations immediately.
   - Successful generation captures the reservation into a debit; failed submit/status outcomes release the reservation.
   - Clearing a Reference Grid spinner calls `POST /api/generation/abandon` with the output `source_ref`/generation/request identifiers, removes the card locally, closes active local lifecycle rows as hidden terminal failures, and marks later provider results as suppressed/no-refund. This does not attempt provider-side cancellation.
   - Fal/Kie task polling updates status; success stores `resultUrls`, sets `previewUrl`, and clears errors. `gpt-image-2` create and standard edit complete immediately without provider polling and patch the optimistic output into terminal success once the route returns. Failures set `errorMessage` and stop polling.
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
    - `gpt-image-2`
    - `kie-ai/gpt-image-2-image-to-image`
  - Create model picker lane switches with the same authority:
    - Character Mode OFF -> `text-image`
    - Character Mode ON -> `character-image`
  - Toggle remap is paired and deterministic:
    - OFF -> ON maps paired text-to-image models to edit variants (fallback `seedream/edit`).
    - ON -> OFF maps paired edit variants back to text-to-image (fallback `seedream/text-to-image`).
  - Image resolution remains user-selectable per selected model (no forced Character Mode resolution override).
- Hidden prompt composition:
  - Provider-facing prompt prepends character description (when present), then appends user prompt.
  - UI-visible prompt (output cards, modals, saved prompt text) remains the user prompt only.
- Character Sheet references:
  - References are resolved from the Create picker's selected look when present, otherwise from Character Manager active preset metadata (`character_sheet_presets_v1`), in canonical zone order (`portrait`, `close_up`, `front_shot`).
  - If active preset zones are empty, the client falls back to legacy `character_sheet_assignments` slot mapping.
  - Character draft is refreshed before each Create/Text submit so preset switches and zone updates are applied immediately.
  - The Create picker look override is AI Studio-local and does not write back to Character Manager active-look metadata.
  - When the Character panel changes the selected character without an explicit Create-picker look choice, AI Studio clears the previous local look override and rehydrates the current character's active/default look before generation.
  - App-owned Character Sheet refs must hand off as canonical internal media refs whenever storage authority is known; replay/reroll must persist that canonical identity instead of durable signed URLs.
  - Provider-facing signed URLs for app-owned character refs are minted at submit time by the image/edit submit boundary. Raw URL refs remain only for truly external references or URL-only fallback cases.
  - URL-based reference lists are still deduped and capped by provider limits for the external/fallback portion of the submit payload.
  - Selected character id is persisted in browser local storage and restored on reload so Character Mode defaults to the user's latest explicit selection when available.
- Submission invariants:
  - Character Mode ON requires at least one Character Sheet image reference.
  - Missing character references blocks submit with explicit UI error (no description-only fallback submit).
  - A second safety-net invariant in task submission also blocks any selected image-to-image model when references are missing.
  - Pre-submit stages are deadline-bound:
    - Character bundle refresh deadline: 10s.
    - Reference preparation deadline: dynamic by work units and local upload count (`base 14s + 12s per extra work unit + 14s per local blob/data input`, capped at 120s).
    - Reference preparation runs as abortable stage steps (`fetch_local_image`, `upload_image_route`, `refresh_signed_url`) under the shared pre-submit deadline budget, but canonical app-owned refs should prefer submit-time server resolution instead of client-side URL refresh.
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
- Pre-submit reference preparation now emits breadcrumb diagnostics (`generation_preflight_prepare_stage`) with stage/status/source/elapsed timing to speed timeout triage.
- Generate is disabled when required inputs are missing (e.g., model not chosen) or the credit balance is lower than the computed cost, so the banner can remind users to top up before retrying.
- Generate CTA disabled state is validation-only. In-flight generation, prompt refinement, or local preflight/export work must not relabel the CTA or block valid repeat clicks; progress belongs on output cards, stage overlays, banners, or other status surfaces.

## Model usage

- Defaults: `gpt-5.5` for text/vision calls (prompt refinement/describe); image models are chosen from the picker (Fal) and submit through provider-specific handler routes.
- Aspect normalization is provider/model-specific (see `pricing.ts` and `hooks/taskSubmission/{imageHandlers,defaultHandlers}.ts`).
- Cost computation: `computeCostForModel` uses aspect + selected image resolution where applicable (Nano Banana 2/Pro + Seedream tiers) for estimate display; generation charging happens server-side in submit APIs.
- Local reference ingestion: blob/data image inputs now stage through `/api/media/prepare-reference-image-upload`, browser-direct upload to storage, and `/api/media/stage-reference-image` before submit; provider submit routes should receive signed HTTPS URLs, not base64 bodies.

## Image resolution controls

- The card is shown in both `CreatePropertiesPanel` (text-to-image) and `ExpertEditPanelView` (image-to-image).
- Resolution options are model-driven from `modelRegistry.ts` (`allowedResolutions` + `defaultResolution`):
  - FLUX models / Nano Banana: `model_default` (no separate resolution enum exposed in current UI payload mapping).
  - Nano Banana 2 + Nano Banana 2 Edit: `0.5K`, `1K`, `2K`, `4K`.
  - Nano Banana Pro + Nano Banana Pro Edit: `1K`, `2K`, `4K`.
  - Kie GPT Image 2 text-to-image and image-to-image: `1K`, `2K`, `4K`; the submit adapter normalizes provider-invalid combinations so `auto` submits `1K` and `1:1 + 4K` submits `2K`.
  - Seedream 4.5 + Seedream 4.5 Edit: `auto_2K` (default), `auto_4K`.
  - Seedream 5 Lite + Seedream 5 Lite Edit: `auto_2K`, `auto_3K`.

## Expert Edit properties panel behavior

- Expert Edit is now the only Edit workflow surface.
- Expert Edit panel contracts:
  1. One primary edit drop zone + two default secondary drop zones plus add/remove controls up to ten secondary drop zones. Secondary references render five items per row; when the visible slots plus add button require a second row, Expert Edit enters compact wrapped-reference layout so the stage shrinks instead of pushing the composer/selectors below the viewport.
  2. Inline prompt/composer row includes model/aspect/resolution selectors and inline Generate button.
  3. Generate remains disabled until primary reference image exists.
  4. Chat mode UI is hidden/off for Expert Edit.
     4a. Launch surface is Standard-only: public Expert Edit hides the Standard/Inpaint/Markup selector plus public Inpaint/Markup rail/modal entry points, while the underlying non-standard implementation remains parked behind the launch gate for later re-enable.
     4b. Inpaint generation is temporarily disabled product-wide. Hidden FLUX Fill and Kontext inpaint runtime lanes are not active submit targets, and any stale inpaint submit state must fail closed with a temporary-unavailable message rather than reaching provider routes.
  5. Inpaint editing can paint anywhere inside the primary drop zone (including outside the visible image bounds).
  6. Inpaint submit exports the visible image-area mask window (`imageRect`) and applies the same stage camera transform as base-image flatten so FLUX Fill mask pixels remain aligned under zoom/pan framing.
  7. `Remove Background` submits the currently selected layer image only, routes regenerate through hidden Bria RMBG (`fal-ai/bria/background/remove`) with prompt-optional submit policy, and debits 1 credit per run.
  8. Generate submit flattening (regular + inpaint base image) and manual `Flatten Layers` both use the same stage-camera flatten contract: aspect-aware output dimensions, transparent uncovered pixels, current layer transforms/z-order, and current stage camera framing (`zoom`, `pan`). Manual `Flatten Layers` updates the Expert Edit canvas/layer stack only and must not add a new Reference Grid item.
  9. Layer stack uses a permanent foundation `layer 1` (clearable, never removable), all non-foundation layers are content-backed only, and primary image ingress inserts a new populated layer above the selected layer while preserving panel-top = visual-top z-order.
     9a. Keyboard delete mirrors the visible delete affordance: when a layer is selected and focus is not inside an editable field, pressing `Delete` (and macOS `Backspace`) removes that selected layer through the same layer-stack rules.
     9b. The full Expert Edit properties body sits inside one primary wrapper surface so the preset rail, stage, layers rail, and lower controls remain visually contained by the same background shell used by Create.
     9c. The inline Expert Edit `Layers` panel lives in the left rail directly below `Prompt Presets`, and the underlying layer system remains active for stage selection, z-order management, flattening, and keyboard delete behavior. The expanded modal layers panel remains available when invoked by the existing canvas flows.
     9e. Inline Expert Edit presets chrome uses one shared card: the `Prompt Presets` title row is embedded at the top of the same surface that contains the preset list.
  10. Crop tool uses explicit aspect selection: no ratio is selected by default, ratio chips are toggleable, Crop mode renders a centered max-fit guide for the selected ratio, and `Crop` applies only to the active layer using stage-accurate pixels (including current move/resize/rotate) before resetting that layer transform. Crop selection does not change the global generation aspect selector.
      10a. The inline Move tools panel exposes zoom plus Undo/Redo only; `Adjust` and `Center` remain available in the expanded Move modal rather than the inline post-stage tools strip.
  11. Styles selector is a right-rail panel (not a modal): the shared Styles control is available in Expert Edit and Create, toggles a Styles section below Reference Grid, keeps a selected-style preview in the left Styles button, and auto-closes the right-rail Styles panel after style selection. Right-rail section visibility follows panel-header toggles, style-selection indicators are workflow-themed (Create blue, Edit amber, Video violet, Canvas cream), and the Styles helper text is hidden on the active Edit surface.
  12. `Libraries -> Presets` opens one primary left-panel Presets Library with internal `Pulses` and `Prompt Presets` sections. The `Pulses` section merges the global built-in guided-workflow catalog with shared per-user custom Pulse persistence. The current seeded built-in starter set is `Video Prompt Magic`, `Multi Sequence Video Prompt`, and `DFY Story Builder`, but the active built-in set now comes from the admin control plane and may change over time. Built-ins are no longer editable from user Pulse surfaces; custom user-authored Pulses use the library/editor flows as saved instruction presets, while built-ins remain on the guided `workflow_gpt` compatibility path. The `Prompt Presets` section is populated from the full Expert Edit preset catalog (with overrides applied), keeps the right rail visible, and supports click-to-edit preset name/prompt in a modal.
  13. Submit-scoped model overrides (`modelIdOverride` or `inpaintOverride.modelId`) must not persistently mutate the selected model in panel state; they apply to that submit only.
  14. Hidden-output primary-reference replacement is intentionally scoped to remove-background (Bria RMBG) hidden outputs and must not trigger for arbitrary hidden image outputs.
  15. Inpaint lock and reference-aware masked routing still live in `frontend/features/ai-studio/logic/inpaintSubmission.ts` as parked implementation, but the inpaint runtime lanes are currently disabled and must not submit to provider routes.
  16. Expert Edit prompt-reference tokens support `@img1` through `@img10` for standard edit secondary slot references, with generate-time validation blocking and submit-time Figure mapping for provider prompts. Inpaint-specific secondary reference behavior remains parked with the disabled inpaint implementation and is not an active product contract while the temporary disable is in effect.
  17. Markup mode uses stage overlays (not pixel-destructive edits): Pen draws freehand note strokes, Lasso draws closed filled color shapes, and the color picker controls new markup color. Inline and expanded markup canvases share the same in-session stroke state, and that markup state persists through the unified Expert Edit session/history contract while remaining an overlay artifact rather than a destructive layer edit. Legacy eraser behavior remains internal for now but is not surfaced in the active markup tool UI.
  18. Inpaint media preflight is override-authoritative: when `inpaintOverride` exists, submit prepares only the override media (`baseImageInput`, `maskInput`, and optional `referenceImageInput`) and does not separately preflight normal edit `imageInputs`.
  19. Main-stage and MarkupModal-stage interaction parity is mandatory: move transform pointers, inpaint brush/lasso + overlay + clear/invert, and markup pointer/wheel behavior must route through the shared stage-interaction architecture (`useExpertEditStageInteractionRouter`) so both surfaces follow one tool lifecycle contract while preserving shared state.
  20. Viewport/camera contract is shared across inline + modal surfaces: camera state uses one `scale` plus normalized offsets (`offsetXRatio`, `offsetYRatio`) resolved per active surface bounds, modal stage geometry is aspect-fit (no modal-only square/frame path), and flatten/inpaint camera payloads must use active surface viewport dimensions while preserving output aspect contracts.
  21. Aspect-selector changes are framing-only: markup stroke geometry and inpaint mask geometry are stored in isotropic scene space and remapped per frame, so switching ratios (`1:1`, `16:9`, `9:16`, `4:5`, `5:4`, etc.) can clip content but must never stretch/squish it.
  22. Expert Edit session persistence is unified and page-scoped: layer stack state plus markup/inpaint histories persist across workflow/tool tab switches within the active AI Studio session, including Undo/Redo stacks; the payload resets when `sid` changes.
  23. Collapsed `Tools` remains an inline expand/collapse control and does not auto-open the expanded Markup modal.
  24. Inline stage transform ownership is split by contract: wrapper/shell owns camera transform state for zoom/pan/flatten viewport framing, primary dropzone remains the pointer sampling surface for draw/transform tools, and transform-overlay affordances may render outside the image bounds while wrapper-level clipping prevents camera/image spill outside the stage frame.
- Prompt guard policy for Edit submit is model-capability driven (`editPromptPolicy`); unknown capability defaults to prompt required.
- Token workflow details are maintained in `docs/sops/sop_ai_studio_expert_edit_prompt_references.md` (canonical SOP for grammar, UI behavior, preflight, and compilation rules).

## Supported image models (current)

| Provider | Model id                                          | Allowed aspects (examples)                                                                                    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fal      | `fal-ai/flux-2/klein/9b`                          | Uses `falSizeForAspect` (maps 1:1, 9:16, 16:9, etc.)                                                          | Text-to-image; billed credits now come from the shared global pricing policy plus any explicit per-model override configured in `/admin/pricing`; safety checker off by default.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| OpenAI   | `gpt-image-2`                                     | `auto`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`, `5:4`, `4:3`, `3:2`, `16:9`, `21:9`                               | Supports prompt-only create plus standard reference-image edit. AI Studio maps aspects onto the supported OpenAI size matrix (`1024x1024`, `1024x1536`, `1536x1024`) and uses `low` / `medium` / `high` as the model-specific quality tiers. Create submits go through `/api/openai/image-generate`; standard edits go through `/api/openai/image-edit` with deterministic high-fidelity/image-count pricing, while the provider request omits `input_fidelity` because `gpt-image-2` rejects that parameter. Both lanes persist outputs synchronously from base64 provider data and complete without provider polling. |
| Kie      | `kie-ai/gpt-image-2-text-to-image`                | `auto` default (allowed: auto, 1:1, 3:2, 2:3, 4:3, 3:4, 5:4, 4:5, 16:9, 9:16, 2:1, 1:2, 3:1, 1:3, 21:9, 9:21) | Text-to-image only via Kie `createTask`, proxied through `/api/fal/kie-gpt-image-2-submit` + `/api/fal/kie-gpt-image-2-status`. Pricing is per image by requested provider-safe resolution (`1K=$0.03`, `2K=$0.05`, `4K=$0.08`) before shared credit conversion/markup. Provider-invalid combinations are normalized before submit: `auto` resolves to `1K`, and `1:1 + 4K` resolves to `2K`. Provider safety submits as `enable_safety_checker: false`, `safety_tolerance: 5`.                                                                                                                                         |
| Kie      | `kie-ai/gpt-image-2-image-to-image`               | `auto` default (allowed: auto, 1:1, 3:2, 2:3, 4:3, 3:4, 5:4, 4:5, 16:9, 9:16, 2:1, 1:2, 3:1, 1:3, 21:9, 9:21) | Image-to-image only via Kie `createTask`, proxied through `/api/fal/kie-gpt-image-2-edit-submit` + `/api/fal/kie-gpt-image-2-edit-status`. Requires 1-16 reference image URLs as Kie `input_urls`. Pricing is per image by requested provider-safe resolution (`1K=$0.03`, `2K=$0.05`, `4K=$0.08`) before shared credit conversion/markup. Provider-invalid combinations are normalized before submit: `auto` resolves to `1K`, and `1:1 + 4K` resolves to `2K`. Provider safety submits as `enable_safety_checker: false`, `safety_tolerance: 5`.                                                                      |
| Fal      | `fal-ai/nano-banana-2`                            | `auto` default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16)                           | Text-to-image via the Fal queue; base per-image pricing starts at $0.08 with resolution multipliers (`0.5K x0.75`, `2K x1.5`, `4K x2`) and optional web-search surcharge, proxied through `/api/fal/nano-banana-2-*`.                                                                                                                                                                                                                                                                                                                                                                                                   |
| Fal      | `fal-ai/nano-banana-2/edit`                       | `auto` default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16)                           | Image-to-image/edit; requires `image_urls` references; pricing mirrors Nano Banana 2 text-to-image with resolution multipliers and optional web-search surcharge, proxied through `/api/fal/nano-banana-2-edit-*`.                                                                                                                                                                                                                                                                                                                                                                                                      |
| Fal      | `fal-ai/nano-banana-pro`                          | 4:5 default (wide/portrait variants allowed via the allowed list)                                             | Text-to-image via the Fal queue with flat per-image pricing (4K doubles cost, web-search adds a surcharge) and PNG outputs; proxied through `/api/fal/nano-banana-pro-*`.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Fal      | `fal-ai/nano-banana-pro/edit`                     | `auto` default (allowed: auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16)                           | Image-to-image/edit; requires `image_urls` references; flat per-image pricing (15 credits; 4K doubles; web_search adds 1.5 credits), proxied through `/api/fal/nano-banana-pro-edit-*`.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Fal      | `fal-ai/bytedance/seedream/v4.5/text-to-image`    | 1:1 default (allowed: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9)                                    | Uses native `image_size` enums for core ratios and exact custom `{width,height}` payloads for non-native ratios (`5:4`, `4:5`, `3:2`, `2:3`, `21:9`); for `auto_2K`/`auto_4K`, the client now sends explicit aspect-locked dimensions; provider safety checker is enabled.                                                                                                                                                                                                                                                                                                                                              |
| Fal      | `fal-ai/bytedance/seedream/v4.5/edit`             | 1:1 default (allowed: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9)                                    | Image-to-image/edit; requires `image_urls`; uses native + exact custom `image_size` mapping like text-to-image, including explicit aspect-locked dimensions for `auto_2K`/`auto_4K`; provider safety checker is enabled; proxied through `/api/fal/seedream-edit-submit` + `/api/fal/seedream-status`.                                                                                                                                                                                                                                                                                                                  |
| Fal      | `fal-ai/bytedance/seedream/v5/lite/text-to-image` | 1:1 default (allowed: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 9:16, 16:9, 21:9)                                         | Text-to-image; supports `auto_2K`/`auto_3K` and custom `{width,height}` sizing; provider safety checker is enabled; proxied through `/api/fal/seedream-v5-lite-submit` + `/api/fal/seedream-status`; pricing uses fixed `$0.035` base (4 billed credits by default before per-model overrides).                                                                                                                                                                                                                                                                                                                         |
| Fal      | `fal-ai/bytedance/seedream/v5/lite/edit`          | 1:1 default (allowed: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9)                                    | Image-to-image/edit; requires `image_urls` (up to 10); supports `auto_2K`/`auto_3K` and custom `{width,height}` sizing; provider safety checker is enabled; proxied through `/api/fal/seedream-v5-lite-edit-submit` + `/api/fal/seedream-status`; pricing mirrors Seedream 5 Lite text-to-image.                                                                                                                                                                                                                                                                                                                        |

## Maintenance rules

1. Keep prompts in `frontend/lib/agentPromptsConfig.ts` (single source) and avoid duplicating in docs.
2. Align SOP defaults with code (model defaults, server-side charging behavior).
3. When adding models, update the canonical model catalog lifecycle/surface metadata, pricing strategy, and any aspect constraints; AI Studio picker options and admin pricing rows are derived from catalog surfaces. Ensure the cost estimator and debit memo are correct.
4. Run `npm run lint` after changes; smoke-test create/image flow (model select, prompt entry, generate, output appears, credit debited, no errors).

## Known gaps / improvements

- Credit UX: consider showing both estimated and actual debits (when available) in the Reference card or banner.
- Error surfacing: add per-card retry affordance and friendlier inline messaging on the prompt form.
- Caching: consider reusing the last refined prompt when switching from text → image to reduce duplicate API calls.
- Accessibility: ensure drag/drop surfaces have keyboard equivalents (e.g., “Choose file” button focusable with Enter/Space).

## Upcoming flows (prepare ahead)

- Image-to-Image: will require at least one reference image; reuse the same Reference Grid/Studio Preview ingestion path and cost/debit rules as text-to-image. Confirm aspect clamping using the model’s `allowedAspects` from `modelRegistry.ts` and document any reference count limits here.
- Image-to-Video: align with the video SOP defaults (duration/audio/aspect from `modelRegistry.ts`), require a primary reference image, and surface the per-model reference requirement in the Generate disabled state copy. Update this section when the flow is wired.
