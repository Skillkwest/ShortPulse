# AI Studio Character Mode Injection Plan

Archive status: moved from `docs/planning/` on 2026-02-17 after implementation completion.  
Canonical historical context is retained here; active planning moved back to backlog where needed.

Purpose: implement the Create workflow Character Mode so every generate run injects the selected character sheet references + hidden character description context + user prompt into Seedream 4.5 Edit at highest image resolution.

## Requirement Lock (Confirmed)
- Character Mode in Create must run with `fal-ai/bytedance/seedream/v4.5/edit`.
- Character Mode is only accessible in Create workflow.
- Create workflow does not support user-supplied image references; Character Mode references come from Character Manager only.
- Highest supported image resolution must be enforced while Character Mode is enabled.
- When available, the four Character Sheet images must be sent automatically every run.
- When available, character description must be prepended to the submitted prompt as hidden context.
- User prompt must be the second segment of the submitted prompt.
- Hidden description context must never be shown in AI Studio UI output cards/modals.
- Missing character description must not block generation.
- Missing Character Sheet references must not block generation.
- If no character data is available, generation continues with plain user prompt and no character injection.

## Current-State Audit
- UI + locking:
  - Character Mode toggle + picker is wired in `frontend/features/ai-studio/components/TextPropertiesPanel.tsx`.
  - Model + image-resolution lock to Seedream Edit/highest resolution already exists in `frontend/pages/ai-studio.tsx`.
- Character data availability:
  - Create workflow currently loads only profile list (`id`, `name`, `profileImageUrl`) via `listCharacterManagerCharacters()` in `frontend/pages/ai-studio.tsx`.
  - Character description + sheet assignments + slot URLs are not currently loaded into AI Studio create flow.
- Submission pipeline:
  - Prompt sent to model is currently the same string stored/displayed in output cards in `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`.
  - Create tool with Seedream Edit can fail for missing references because automatic Character Sheet injection is not wired.

## Target Runtime Contract
1. User toggles Character Mode ON in Create.
2. AI Studio loads selected character generation bundle (description + resolved 4-sheet image URLs).
3. On Generate:
  - Submitted model: `fal-ai/bytedance/seedream/v4.5/edit`
  - Submitted resolution: highest allowed for that model (`auto_4K` currently)
  - Submitted references: Character Sheet references (ordered) when available
  - Submitted prompt (to model only):
    - Part 1: character description (hidden) when available
    - Part 2: user prompt (visible, always)
4. UI-visible prompt remains user prompt only.

## Data And Composition Design
### Character bundle source
- Reuse Character Manager persistence primitives in `frontend/features/character-manager/logic/characterManagerPersistence.ts`.
- Load selected character draft details via `loadCharacterManagerDraftByCharacterId(characterId)` and derive:
  - `characterDescription`
  - `characterSheetAssignments`
  - `slots`
- Convert assignments to ordered sheet references using Character Sheet zone order:
  - `portrait`
  - `close_up`
  - `front_shot`
  - `back_shot`

### New AI Studio composition helpers
- Add a new logic utility file (proposed): `frontend/features/ai-studio/logic/characterModePayload.ts`.
- Include pure helpers:
  - `resolveCharacterSheetReferenceUrls(...)`
  - `composeCharacterModePrompt({ characterDescription, userPrompt })`
  - `mergeCharacterAndUserReferences(...)`
- Rules:
  - Character Sheet references must be first when available.
  - Deduplicate URLs.
  - Respect model max reference count (Seedream Edit route allows up to 10).
  - Missing references are allowed; submission proceeds.

### Hidden prompt handling
- Introduce a two-prompt contract in submission:
  - `displayPrompt` (UI/persistence-facing)
  - `submissionPrompt` (provider-facing)
- `displayPrompt` remains the user prompt.
- `submissionPrompt` is composed with hidden description prefix only when description exists.

## Implementation Workstreams
### Workstream 1: Character Mode bundle loading in AI Studio
- Files:
  - `frontend/pages/ai-studio.tsx`
  - `frontend/features/character-manager/logic/characterManagerPersistence.ts` (read-only reuse or thin helper export)
- Tasks:
  - Add selected-character detail state for description + resolved sheet refs.
  - Fetch on `selectedCharacterId` changes.
  - Cache latest resolved bundle for generate calls.
  - Add loading/error state scoped to Character Mode readiness.

### Workstream 2: Submission API contract split (display vs submitted prompt)
- Files:
  - `frontend/features/ai-studio/hooks/useAiStudioState.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
  - `frontend/features/ai-studio/hooks/taskSubmission/types.ts`
  - `frontend/features/ai-studio/hooks/taskSubmission/imageHandlers.ts`
  - `frontend/features/ai-studio/hooks/taskSubmission/defaultHandlers.ts`
- Tasks:
  - Extend generate/submit signatures to carry:
    - `submissionPromptOverride`
    - `referenceInputsOverride`
    - `displayPromptOverride` (or equivalent explicit field)
  - Ensure output objects (`StudioOutput.prompt`) keep user prompt only.
  - Ensure provider handlers use submission prompt only.

### Workstream 3: Character Mode preflight guardrails
- Files:
  - `frontend/pages/ai-studio.tsx`
  - `frontend/features/ai-studio/hooks/useAiStudioViewModel.ts`
- Tasks:
  - Replace hard guardrails with best-effort readiness handling for Create Character Mode.
  - Add optional non-blocking notices for:
    - no selected character
    - missing character description
    - missing Character Sheet references
  - Ensure generate remains enabled when these are missing.
  - Keep existing credit/model guardrails intact.

### Workstream 4: Runtime payload enforcement
- Files:
  - `frontend/pages/ai-studio.tsx`
  - `frontend/features/ai-studio/logic/characterModePayload.ts` (new)
- Tasks:
  - In Character Mode + Create path, always pass composed submission prompt + Character Sheet refs overrides into generate call.
  - Keep forced model + highest resolution behavior active.
  - Ensure regenerate path uses the same injected payload framework.

### Workstream 5: Telemetry and safe metadata
- Files:
  - `frontend/pages/ai-studio.tsx`
  - `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
- Tasks:
  - Add non-sensitive metadata fields only:
    - `character_mode_enabled`
    - `character_id`
    - `character_reference_count`
  - Do not log/store raw character description in UI-visible records.

## Validation And Test Plan
### Unit tests
- `frontend/features/ai-studio/logic/__tests__/characterModePayload.test.ts` (new):
  - ordered reference extraction from assignments
  - prompt composition order (description first, user prompt second)
  - dedupe and max-reference enforcement

### Hook tests
- Update `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`:
  - submission uses hidden-composed prompt
  - output card prompt remains user-only
  - injected reference overrides are passed for Seedream Edit

### View-model guardrail tests
- Update `frontend/features/ai-studio/hooks/__tests__/useAiStudioViewModel.test.ts`:
  - Character Mode keeps generate enabled when selected character bundle is incomplete
  - Character Mode keeps generate enabled when bundle is complete
  - Existing credit/model guardrails still block correctly

### Manual QA checklist
- Character Mode ON + complete character:
  - model forced to Seedream Edit
  - resolution forced to highest
  - generate succeeds with no manual reference upload
- Character Mode ON + missing description:
  - generate proceeds using references only (if present)
- Character Mode ON + missing one sheet slot:
  - generate proceeds with available references only
- Character Mode ON + no sheet refs:
  - generate proceeds with prompt-only submission to Seedream Edit
- Character Mode ON + no selected character:
  - generate proceeds with prompt-only submission to Seedream Edit
- Character Mode OFF:
  - behavior unchanged from current baseline
- Output cards/detail modal:
  - show user prompt only (no character description leakage)

## Docs Updates Required In Same PR
- Update `docs/sops/sop_image_generation.md` with Character Mode injection flow.
- Update `docs/sops/sop_character_manager_operations.md` to note Character Sheet is now generation-driving in AI Studio Create.
- Log rollout summary in `docs/change_log.md`.

## Risks And Mitigations
- Risk: hidden prompt leaks into UI output/persistence.
  - Mitigation: explicit display vs submission prompt contract + tests.
- Risk: stale signed URLs for character references.
  - Mitigation: refresh character bundle on selection and before submit if stale/missing.
- Risk: silent quality drop when injection inputs are missing.
  - Mitigation: non-blocking notices + telemetry for missing-description/missing-reference runs.
- Risk: excessive coupling between Character Manager and AI Studio.
  - Mitigation: isolate conversion/composition logic in `characterModePayload.ts`.
- Risk: guardrail regressions in non-character flows.
  - Mitigation: keep checks gated to Character Mode + Create tool only; run existing task-submission/view-model tests.

## Execution Order
1. Add payload utility + tests.
2. Add character bundle loading + readiness state in AI Studio page.
3. Extend generate/submit contracts for hidden prompt + reference overrides.
4. Apply Character Mode preflight guardrails and wire submit-time injection.
5. Run lint/tests + manual QA.
6. Update SOP/change-log docs.
