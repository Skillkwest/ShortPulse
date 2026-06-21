# SOP: AI Studio Styles Library Style Creator

Purpose: define the modular Style Creator workflow used by AI Studio Styles Library so creation/edit/delete behavior stays stable while extraction quality contracts evolve safely.

## Scope

- In scope: style-card intake (upload/drop), prompt-only preview generation, extraction orchestration, save/delete persistence, and extraction telemetry.
- Out of scope: generation model pricing/policy, new style-control UI knobs (strength/axis/blend), normal Reference Grid/Media Library artifact persistence for style thumbnails, and dedicated style tables.

## Key components

| Component                                                                           | Role                                                                                                                                      |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/features/ai-studio/components/StylesLibraryPanel.tsx`                     | Presentational Styles Library panel; renders tiles/modals and delegates behavior to controller.                                           |
| `frontend/features/ai-studio/components/style-creator/useStyleCreatorController.ts` | Domain controller for create/edit/delete modal state machine, extraction orchestration, and persistence command execution.                |
| `frontend/features/ai-studio/components/style-creator/intake.ts`                    | Style intake helpers (drop/file normalization, preview crop, reorder utilities).                                                          |
| `frontend/features/ai-studio/components/style-creator/extraction.ts`                | Deterministic extraction outcome classification (`success`, `fallback`, `blocked_source`).                                                |
| `frontend/features/ai-studio/components/style-creator/telemetry.ts`                 | Normalized extraction telemetry emitter (`telemetry.ai_studio.style_extraction`).                                                         |
| `frontend/features/ai-studio/logic/styleDetailsNormalization.ts`                    | Backward-compatible style-details normalization/equality helpers used by persistence hooks.                                               |
| `frontend/features/ai-studio/logic/stylePreviewGeneration.ts`                       | Authenticated client helper for prompt-only style-card preview generation.                                                                |
| `frontend/features/ai-studio/hooks/useStylesLibraryPanelIdsPreference.ts`           | Per-user shared style-order persistence through `user_preferences.ai_studio_style_panel_ids`.                                             |
| `frontend/features/ai-studio/hooks/useStylesLibraryStyleDetailsPreference.ts`       | Per-user style-details persistence (`user_preferences.ai_studio_style_details_overrides`) with local fallback.                            |
| `frontend/features/ai-studio/hooks/useBuiltInStyleCatalog.ts`                       | Authenticated runtime loader for the global built-in Styles catalog from `/api/ai/built-in-styles`.                                       |
| `frontend/pages/api/admin/agent-instructions/built-in-styles.ts`                    | Admin-only route that publishes the global built-in Styles catalog.                                                                       |
| `frontend/pages/api/ai/built-in-styles.ts`                                          | Authenticated runtime route that returns the global built-in Styles catalog.                                                              |
| `frontend/pages/api/ai/extract-style.ts`                                            | Authenticated style extraction endpoint (`imageDataUrl` -> `stylePrompt`, `styleTitle`, optional `usage`).                                |
| `frontend/pages/api/ai/generate-style-preview.ts`                                   | Authenticated FLUX 2 Klein style-preview endpoint (`stylePrompt` -> compact 512x512 JPEG data URL) for prompt-only manual style creation. |

## Persistence contract

`StylesLibraryStyleDetails` required fields remain unchanged:

- `style`
- `title`
- `referenceImageName`
- `stylePrompt`
- `previewImageUrl`

Rules:

1. Reads must normalize legacy rows down to the core fields only.
2. Writes persist only the core style fields listed above.
3. JSONB storage remains in `user_preferences.ai_studio_style_details_overrides` for user-created custom Styles only.
4. Shared style order persists separately in `user_preferences.ai_studio_style_panel_ids`.
5. Global built-in Styles are sourced from `ai_studio_builtin_style_runtime`, edited only from `/admin/agent-instructions`, and ignored when a matching id appears in `ai_studio_style_details_overrides`.
6. Admin drag reorder of built-in Styles persists the ordered global catalog array and becomes the default built-in Style sort order for all users.
7. Custom-style delete must remove the source row from the details override map; built-in Style delete uses the per-user delete denylist for hide semantics without mutating the global built-in definition. Restoring built-in Styles clears that per-user denylist and clears the per-user style-order override so the current admin built-in order is restored while custom Styles remain intact.
8. Admin built-in Style preview uploads use the same local image preprocessing as custom Styles and write the processed preview image URL/data URL into the global built-in Style definition.
9. Admin built-in Style ids are generated automatically from the first saved style name, normalized as lowercase hyphenated ids, capped at 160 characters, and preserved on later renames. Existing ids must not be regenerated unless the product intentionally replaces or migrates that built-in Style identity.
10. Customer-facing built-in Styles runtime must fail closed instead of returning seeded fallback content. The local seeded catalog is admin recovery/operator visibility only; it must not be rendered by AI Studio Styles Library, the right-rail Styles panel, selected-style controls, or generation detail previews.

## Workflow

1. User creates style via Add Style modal or library drop.
2. Intake resolves two derived image artifacts from the dropped/uploaded source:
   - Preview image: center-cropped square `512x512` JPEG for style-card rendering.
   - Extraction source: aspect-preserving bounded JPEG (`max(width,height)=1024`, no upscaling) used for `/api/ai/extract-style`.
   - Style Prompt editor enforces a `300` character max (live counter + input clamp, near-limit warning at `270`) to keep style add-ons within the runtime prompt budget used by extraction and submit-path append behavior.
3. Extraction calls `/api/ai/extract-style` through the client helper with the derived extraction image as `imageDataUrl`, one bounded request timeout, and an overall deadline cap.
   - The route owns upstream retry/fallback behavior; the client does not retry extraction requests.
   - Extraction normalization enforces a deterministic leading hard style class descriptor as the first `stylePrompt` token.
   - Current hard style class set: `Photographic`, `Vintage`, `Hyper-realistic`, `Anime Style`, `Cartoon Style`, `Photorealistic`, `Candid Cell Phone Snapshot`, `Digital Illustration`, `3D Render`, `Concept Art`, `Hand-Drawn`, `Painting`.
4. Outcome is classified as `success`, `fallback`, or `blocked_source`.
5. Manual prompt-only create/save path:
   - First persists normalized details using only the core fields, with `previewImageUrl` blank.
   - Then starts background preview generation for that same `styleId` when `stylePrompt` is non-empty and no uploaded/reference preview exists.
   - The preview route uses Fal FLUX 2 Klein (`fal-ai/flux-2/klein/9b`) with a `1024x1024` JPEG payload, bills through the canonical Create image pricing path, converts the provider result to a `512x512` JPEG data URL, captures/refunds through generation billing, and returns only `previewImageUrl`.
   - The controller upserts the same style details with the generated `previewImageUrl`. If preview generation fails, the style remains saved and the library shows a recoverable inline error.
   - Prompt-only style previews do not create normal Reference Grid, generation projection, Media Library, or Supabase transform artifacts.
6. Create/save path persists normalized details using only the core fields.
7. Edit/delete path uses guarded persistence commands with deterministic local error messaging.
8. The first tile in Styles Library is a fixed `None` slot (system tile); it is never persisted, edited, deleted, or reordered.
9. Styles Library tile clicks are edit-only (open/create/update/delete workflows) and do not mutate active Create/Edit style selection.
10. Right-rail Styles tile clicks own Create/Edit style selection state and auto-close the right-rail Styles panel after selection; submit-path style append behavior remains unchanged.
11. Drag reorder in the primary Styles Library updates the shared page-level catalog order so the right-rail Styles chooser reflects the same sequence.

## Submission-time style behavior and prompting guidance

1. Submission behavior:

- Active style is applied by appending selected style prompt text to the hidden submission prompt via model-family adapter logic.
- Current adapter families:
  - Nano Banana: treatment-scoped style line with explicit identity/composition preservation language.
  - Seedream: style line emphasizing cohesive palette, lighting mood, and surface texture.
  - Generic fallback: legacy `Visual style reference: <style prompt>` line.
- Current lane does not use per-provider style-weight controls; adherence is model-dependent.
- Runtime kill switch: set `NEXT_PUBLIC_AI_STUDIO_STYLE_FAMILY_ADAPTER_ENABLED=false` to force legacy style-line output.

2. Prompt-writing guidance for stronger adherence:

- Keep user prompt task-oriented, then add style intent in style prompt fields with explicit visual dimensions:
  - first descriptor = one hard style class anchor,
  - palette,
  - lighting,
  - contrast,
  - texture/material treatment,
  - lens/grade feel.
- Prefer concrete phrasing over abstract adjectives.

3. Recommended style-prompt pattern:

- `Apply a [style] treatment with [palette], [lighting direction/quality], [contrast level], and [texture/finish]. Preserve subject identity and scene geometry.`

4. Edit-workflow guidance (especially for fidelity-heavy models):

- When references strongly constrain structure, include language that scopes style to visual treatment only:
  - `Treat style as a color/lighting/texture guide; do not alter identity, proportions, or composition.`
- Avoid conflicting directives between user prompt and style prompt.

5. Known tradeoff:

- Strong reference-fidelity models may under-index style text when instructions conflict.
- This is expected unless there is evidence of a new regression in the style append path.

6. Evidence capture standard:

- For cross-model style behavior checks, capture runs using:
  - `docs/records/evidence/style-adherence/style-adherence-run-template.md`
- Store completed packets under:
  - `docs/records/evidence/style-adherence/`

## Telemetry contract

Low-severity browser `telemetry.ai_studio.*` reports are currently suppressed before `/api/log/client-error`, so the contract below documents payload shape and source naming, not a guaranteed live-ingest path.

Source: `telemetry.ai_studio.style_extraction`

Messages:

- `style_extraction.success`
- `style_extraction.fallback`
- `style_extraction.blocked_source`

Required metadata keys:

- `telemetry_family`
- `telemetry_version`
- `outcome`
- `flow`
- `stage`
- `source_url_kind`
- `failure_class`
- `attempt_count`
- `probe_ms`
- `openai_ms`
- `total_ms`
- `model_used`
- `error_class`
- `error`
- `classifier_reason`
- `resolution_stage`
- `resolution_reason`
- `candidate_count`
- `server_copy_attempted`

Failure class mapping:

- `timeout`: deadline exceeded.
- `canceled`: local abort/navigation interruption.
- `network_transient`: client-classified network transport failure before the extraction route completes.
- `upstream_http`: non-2xx failure returned by the extraction route after server-side retry/fallback handling.
- `blocked_source`: local source-resolution failure (for example blocked browser access or expired drag payload), not the retired server URL-probe lane.
- `fallback`/`unknown`: normalized residual classes for deterministic reporting.

## Verification checklist

- `npm -C frontend run test -- features/agent-runtime/__tests__/styleExtractionPromptPolicy.test.ts`
- `npm -C frontend run test -- lib/__tests__/agentPromptsConfig.test.ts`
- `npm -C frontend run test -- features/ai-studio/components/style-creator/__tests__/extraction.test.ts`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/styleDetailsNormalization.test.ts`
- `npm -C frontend run test -- features/ai-studio/components/__tests__/StylesLibraryPanel.test.tsx`
- `npm -C frontend run test -- tests/api/generate-style-preview.route.test.ts`
- `npm -C frontend run test -- tests/api/protected-api-paths.parity.test.ts`
- `npm -C frontend run test -- features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioGenerationPromptComposer.test.ts`
- `npm -C frontend run docs:check`
