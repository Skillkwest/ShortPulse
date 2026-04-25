# SOP: AI Studio Styles Library Style Creator

Purpose: define the modular Style Creator workflow used by AI Studio Styles Library so creation/edit/delete behavior stays stable while extraction quality contracts evolve safely.

## Scope
- In scope: style-card intake (upload/drop), extraction orchestration, save/delete persistence, and extraction telemetry.
- Out of scope: generation model pricing/policy, new style-control UI knobs (strength/axis/blend), and dedicated style tables.

## Key components
| Component | Role |
| --- | --- |
| `frontend/features/ai-studio/components/StylesLibraryPanel.tsx` | Presentational Styles Library panel; renders tiles/modals and delegates behavior to controller. |
| `frontend/features/ai-studio/components/style-creator/useStyleCreatorController.ts` | Domain controller for create/edit/delete modal state machine, extraction orchestration, and persistence command execution. |
| `frontend/features/ai-studio/components/style-creator/intake.ts` | Style intake helpers (drop/file normalization, preview crop, reorder utilities). |
| `frontend/features/ai-studio/components/style-creator/extraction.ts` | Deterministic extraction outcome classification (`success`, `fallback`, `blocked_source`). |
| `frontend/features/ai-studio/components/style-creator/telemetry.ts` | Normalized extraction telemetry emitter (`telemetry.ai_studio.style_extraction`). |
| `frontend/features/ai-studio/logic/styleDetailsNormalization.ts` | Backward-compatible style-details normalization/equality helpers used by persistence hooks. |
| `frontend/features/ai-studio/hooks/useStylesLibraryPanelIdsPreference.ts` | Per-user shared style-order persistence (`user_preferences.ai_studio_style_panel_ids`) with local fallback. |
| `frontend/features/ai-studio/hooks/useStylesLibraryStyleDetailsPreference.ts` | Per-user style-details persistence (`user_preferences.ai_studio_style_details_overrides`) with local fallback. |
| `frontend/pages/api/ai/extract-style.ts` | Authenticated style extraction endpoint (`imageDataUrl` -> `stylePrompt`, `styleTitle`, optional `usage`). |

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
3. JSONB storage remains in `user_preferences.ai_studio_style_details_overrides` for MVP.
4. Shared style order persists separately in `user_preferences.ai_studio_style_panel_ids`.
5. Custom-style delete must remove the source row from the details override map; delete denylist persistence remains only for hide semantics on seeded catalog styles.

## Workflow
1. User creates style via Add Style modal or library drop.
2. Intake resolves two derived image artifacts from the dropped/uploaded source:
   - Preview image: center-cropped square `512x512` JPEG for style-card rendering.
   - Extraction source: aspect-preserving bounded JPEG (`max(width,height)=1024`, no upscaling) used for `/api/ai/extract-style`.
   - Style Prompt editor enforces a `1000` character max (live counter + input clamp, near-limit warning at `900`) to keep style add-ons within the runtime prompt budget used by extraction and submit-path append behavior.
3. Extraction calls `/api/ai/extract-style` through the client helper with the derived extraction image as `imageDataUrl`, one bounded request timeout, and an overall deadline cap.
   - The route owns upstream retry/fallback behavior; the client does not retry extraction requests.
   - Extraction normalization enforces a deterministic leading hard style class descriptor as the first `stylePrompt` token.
   - Current hard style class set: `Photographic`, `Vintage`, `Hyper-realistic`, `Anime Style`, `Cartoon Style`, `Photorealistic`, `Candid Cell Phone Snapshot`, `Digital Illustration`, `3D Render`, `Concept Art`, `Hand-Drawn`, `Painting`.
4. Outcome is classified as `success`, `fallback`, or `blocked_source`.
5. Create/save path persists normalized details using only the core fields.
6. Edit/delete path uses guarded persistence commands with deterministic local error messaging.
7. The first tile in Styles Library is a fixed `None` slot (system tile); it is never persisted, edited, deleted, or reordered.
8. Styles Library tile clicks are edit-only (open/create/update/delete workflows) and do not mutate active Create/Edit style selection.
9. Right-rail Styles tile clicks own Create/Edit style selection state and auto-close the right-rail Styles panel after selection; submit-path style append behavior remains unchanged.
10. Drag reorder in the primary Styles Library updates the shared page-level catalog order so the right-rail Styles chooser reflects the same sequence.

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
  - `docs/planning/evidence/style-adherence/style-adherence-run-template.md`
- Store completed packets under:
  - `docs/planning/evidence/style-adherence/`

## Telemetry contract
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
- `npm -C frontend run test -- features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioGenerationPromptComposer.test.ts`
- `npm -C frontend run docs:check`
