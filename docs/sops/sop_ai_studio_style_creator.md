# SOP: AI Studio Styles Library Style Creator

Purpose: define the modular Style Creator workflow used by AI Studio Styles Library so creation/edit/delete behavior stays stable while extraction quality and metadata contracts evolve safely.

## Scope
- In scope: style-card intake (upload/drop), extraction orchestration, metadata normalization, save/delete persistence, and extraction telemetry.
- Out of scope: generation model pricing/policy, new style-control UI knobs (strength/axis/blend), and dedicated style tables.

## Key components
| Component | Role |
| --- | --- |
| `frontend/features/ai-studio/components/StylesLibraryPanel.tsx` | Presentational Styles Library panel; renders tiles/modals and delegates behavior to controller. |
| `frontend/features/ai-studio/components/style-creator/useStyleCreatorController.ts` | Domain controller for create/edit/delete modal state machine, extraction orchestration, and persistence command execution. |
| `frontend/features/ai-studio/components/style-creator/intake.ts` | Style intake helpers (drop/file normalization, preview crop, reorder utilities). |
| `frontend/features/ai-studio/components/style-creator/extraction.ts` | Deterministic extraction outcome classification (`success`, `fallback`, `blocked_source`). |
| `frontend/features/ai-studio/components/style-creator/telemetry.ts` | Normalized extraction telemetry emitter (`telemetry.ai_studio.style_extraction`). |
| `frontend/features/ai-studio/logic/styleProfile.ts` | Optional structured `styleProfile`/`extractionMeta` builders. |
| `frontend/features/ai-studio/logic/styleDetailsNormalization.ts` | Backward-compatible style-details normalization/equality helpers used by persistence hooks. |
| `frontend/features/ai-studio/hooks/useStylesLibraryStyleDetailsPreference.ts` | Per-user style-details persistence (`user_preferences.ai_studio_style_details_overrides`) with local fallback. |
| `frontend/pages/api/ai/extract-style.ts` | Authenticated style extraction endpoint (`imageUrl` -> `stylePrompt`, `styleTitle`, optional `usage`). |

## Persistence contract
`StylesLibraryStyleDetails` required fields remain unchanged:
- `style`
- `title`
- `referenceImageName`
- `stylePrompt`
- `previewImageUrl`

Optional metadata extension fields:
- `styleProfile?`
- `extractionMeta?`

Rules:
1. Reads must normalize legacy rows that do not include metadata.
2. Writes must preserve backward compatibility and never require metadata fields.
3. JSONB storage remains in `user_preferences.ai_studio_style_details_overrides` for MVP.

## Workflow
1. User creates style via Add Style modal or library drop.
2. Intake resolves preview image and extraction source URL.
3. Extraction calls `/api/ai/extract-style` through client helper.
4. Outcome is classified as `success`, `fallback`, or `blocked_source`.
5. Create/save path persists normalized details; optional metadata is attached when available.
6. Edit/delete path uses guarded persistence commands with deterministic local error messaging.
7. Selected style remains shared with Expert Create/Edit and submit-path style append remains unchanged.

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
- `error_class`
- `error`

## Verification checklist
- `npm -C frontend run test -- features/ai-studio/components/style-creator/__tests__/extraction.test.ts`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/styleDetailsNormalization.test.ts`
- `npm -C frontend run test -- features/ai-studio/components/__tests__/StylesLibraryPanel.test.tsx`
- `npm -C frontend run test -- features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioGenerationPromptComposer.test.ts`
- `npm -C frontend run docs:check`
