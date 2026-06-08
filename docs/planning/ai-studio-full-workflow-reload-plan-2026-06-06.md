# AI Studio Full Workflow Reload Plan

Purpose: define the durable architecture and autonomous implementation plan for a Reference Grid action that reloads the workflow that created a reference, restores its generation-critical controls, and lets the user keep iterating from that exact setup.

Status: implemented locally
Date: 2026-06-06
Owner surface: AI Studio generation, Reference Grid, project restore, and generated-output projection

Implementation note: the local buildout completed on 2026-06-06. The plan remains retained as the architecture/source-of-truth record for the workflow reload contract. `docs/supabase_full_schema.sql` was not updated because the current checked-in schema snapshot does not define `generation_projection`; migration 148 plus `docs/data-dictionary.md` and `docs/security-checklist.md` carry the repo-local schema delta.

## Goal

Add a full workflow reload action to generated references. When the user clicks the action on a restorable reference, AI Studio should navigate to the originating workflow panel and hydrate the controls that materially affected that generation.

Examples:

- A Create image reload navigates to Create and restores prompt, mode-owned Create context, model, aspect ratio, image resolution, reference inputs, character context, and style context.
- A Video reload navigates to Video and restores prompt, model, reference mode, first or last frame inputs, duration, resolution, audio toggle, camera settings, Kling or Seedance settings, and reference assets.
- A Music reload navigates to Music and restores prompt, lyrics, duration, model, format, and request-shaping music controls.
- A Sound Effects reload navigates to Sound Effects and restores prompt, duration, loop, format, model, and request-shaping controls.
- A Voice reload navigates to the Voices panel and restores the appropriate voiceover or voice-changer inputs, selected voice identity, script or source media, model, format, and voice settings.

The action should not automatically submit a new generation in v1. It should hydrate the panel so the user can review, edit, and intentionally click Generate. The existing reroll action can remain as the immediate-submit behavior while this new feature becomes the explicit edit-and-iterate behavior.

## Non-Goals

- Do not redesign AI Studio, Reference Grid, media cards, or panel layouts beyond adding the reload action and any minimal status text required for safe failure handling.
- Do not fork Reference Grid, Quick Slot Inventory, or Canvas into per-workflow or per-mode state.
- Do not infer workflow origin from loose labels when canonical restore metadata is absent.
- Do not make project workspace snapshots the durable source of generated-output restore metadata.
- Do not introduce Supabase image transformations.
- Do not change pricing, provider routing, credit debit behavior, or generation request shapes except to attach restore metadata.
- Do not auto-submit on reload in v1.
- Do not rely on hidden browser-only state for project restore.

## Current Repo Findings

| Area | Current truth | Planning implication |
| --- | --- | --- |
| Image reroll | `frontend/features/ai-studio/logic/generationReplay.ts` and `useAiStudioRerollController.ts` support image-only replay that immediately submits a new generation. | Reuse lessons and selected payload fields, but do not extend reroll into the full reload contract. |
| Submit capture | `useAiStudioTaskSubmission.ts` captures image `generationReplay` and sends it through submit handlers. Video handlers accept replay, but the current builder returns null for video. | Add a new canonical restore builder beside replay capture and thread it through all generation submit families. |
| Audio capture | `useAiStudioAudioGeneration.ts` sends `shortpulse_context` but does not attach durable generation replay or restore metadata. | Audio needs first-class restore metadata and some local panel state must be promoted before reliable hydration. |
| Projection | `generation_projection` stores `generation_replay`, `character_context`, and `style_context`. `generationProjection.ts` reads and writes those fields. | Add a first-class `workflow_reload` JSONB column to the projection table and all projection read/write services. |
| Project restore | Project snapshots trim rich generated metadata, then `projectGenerationAssociationsService.ts` patches it back from `generation_projection`. | The new restore field should follow the same trim-and-patch pattern. |
| Reference Grid | `ReferenceGridCard.tsx`, `ReferenceGrid.tsx`, `useReferenceGridCardRenderController.tsx`, `referenceGridTypes.ts`, and `referenceGridPropsEquality.ts` carry the existing reroll action. | Add the reload action through the same canonical action-prop path and update equality tests. |
| Detail modal | `DetailModal.tsx` shows some generation metadata but does not have a workflow reload action. | Treat modal support as v1.1 unless the implementation pass decides the button must appear everywhere a reference action appears. |
| Workflow identity | `workflowIdentity.ts` only maps Create/Edit/Video/Character into `WorkflowId`; sound workflows are separate and `propertiesPanelRouting.ts` maps audio tools to `voices`, `music`, and `sound-effects`. | Restore metadata must store the actual `originTool` and `panelKind`, not only `WorkflowId`. |
| Workflow settings | `useAiStudioWorkflowSettings.ts` already uses "workflow restore" internally for lightweight tab-switch hydration. | Name runtime actions carefully, such as `workflowReload`, to avoid confusing manual reference reload with automatic settings hydration. |
| Audio panels | Music and Sound Effects have controlled prompt/duration props but local request-shaping state. Voices has selected voice and source state split between controlled props, shared voice grid, and local state. | Reliable audio reload requires promoting generation-critical controls to page-owned state or a workflow settings controller before shipping audio reload. |

## Approaches Considered

### Approach A: Extend `generationReplay`

This would turn the existing replay object into a cross-workflow union and use it for reload.

Pros:

- Reuses existing image capture, projection storage, and tests.
- Requires fewer database columns.
- Existing image reroll metadata already contains many useful fields.

Cons:

- The current type is semantically image-only and named for immediate reroll, not UI hydration.
- Reroll submits; reload navigates and hydrates. Combining them would blur two different product behaviors.
- Audio and video would force large unrelated variants into a legacy image helper.
- Existing tests and UI eligibility logic assume `generationReplay` means image reroll.

Verdict: useful as a compatibility source for existing image outputs, but not the canonical architecture.

### Approach B: Infer From `shortpulse_context`

This would use existing `shortpulse_context.selected_tool`, model metadata, prompt fields, and media type to decide which panel to open.

Pros:

- Minimal initial schema work.
- Some selected tool data already exists for image, video, and audio generations.

Cons:

- `shortpulse_context` is observability and billing context, not a complete restore contract.
- It is not currently a first-class projection column.
- It cannot restore prompt variants, reference inputs, resolution controls, audio panel state, or voice identity reliably.
- It would create hidden fallback behavior and inconsistent results across old and new outputs.

Verdict: reject as a canonical path. It may help diagnostics, but it should not decide reload behavior.

### Approach C: Add First-Class `workflowReload` Metadata

This adds a versioned restore contract to generated outputs, persists it in `generation_projection`, mirrors it into generation/media metadata where useful, and hydrates panel state from that contract.

Pros:

- Explicit, durable, testable, and versionable.
- Separates manual reload from immediate reroll.
- Fits the existing projection and project restore architecture.
- Supports image, video, and audio without overloading image-specific replay semantics.
- Makes old-output compatibility a documented decision rather than a hidden inference.

Cons:

- Requires a SQL migration and read/write changes across submit, projection, restore, and UI layers.
- Requires audio state cleanup before audio reload can be trustworthy.

Verdict: choose this as the canonical architecture.

### Approach D: Reconstruct On Demand From Generation Rows

This would fetch `ai_generations`, `media_files`, outputs, and provider metadata when the user clicks reload, then reconstruct the workflow state.

Pros:

- Avoids a new client-visible field at first.
- Could recover some older generations if metadata happens to be present.

Cons:

- Expensive and inferential.
- Scatters restore logic across server and client instead of using one contract.
- Still cannot recover settings that were never stored.
- Makes project restore and saved-library restore less deterministic.

Verdict: reject for v1. Keep projection as the read model.

## Chosen Architecture

Use Approach C with a narrow compatibility bridge from existing image `generationReplay`.

Canonical object name in TypeScript should be `WorkflowReloadConfig`. Database and wire fields should use `workflow_reload`. The name should intentionally avoid colliding with the existing `useAiStudioWorkflowSettings` internal "workflow restore" terminology.

`WorkflowReloadConfig` should be a versioned discriminated union:

```ts
export type WorkflowReloadConfig = {
  version: 1;
  source: "ai_studio_generation";
  capturedAt: string;
  originTool: ToolId;
  panelKind: PropertiesPanelKind;
  outputMode: StudioOutput["mode"];
  restoreBehavior: "navigate_and_hydrate";
  prompt: {
    display: string;
    submission?: string;
  };
  model: {
    id: string;
  };
  payload:
    | WorkflowReloadImagePayload
    | WorkflowReloadVideoPayload
    | WorkflowReloadMusicPayload
    | WorkflowReloadSoundEffectsPayload
    | WorkflowReloadVoiceoverPayload
    | WorkflowReloadVoiceChangerPayload;
};
```

Common fields should include:

- `version`
- `source`
- `capturedAt`
- `originTool`
- `panelKind`
- `outputMode`
- `restoreBehavior`
- `projectId` when available
- `createMode` for Create Standard or Pulse
- `pulse` metadata only when the output came from a Pulse-owned Create generation and only if it is safe to restore visible mode without exposing hidden Pulse transcript state
- `model.id`
- `prompt.display`
- `prompt.submission` when different from display prompt and useful for faithful regeneration
- `pricingDisplayCredits` only if needed for diagnostics, not for future charging authority

Image payload should include:

- `aspect`
- `imageResolution`
- `referenceInputs`
- `internalMediaRefs`
- `characterContext`
- `styleContext`
- `submitTool`
- `inpaint` only if the implementation elects to support inpaint reload; otherwise inpaint outputs should not show the reload button until a safe contract exists

Video payload should include:

- `aspect`
- `videoReferenceMode`
- `durationSeconds`
- `resolution`
- `generateAudio`
- `cameraFixed`
- `autoFix`
- `referenceInputs`
- `internalMediaRefs`
- `motionReferenceVideoUrl`
- `seedance2InputMode`
- `seedance2ReferenceImageUrls`
- `seedance2ReferenceVideoUrls`
- `seedance2ReferenceAudioUrls`
- `seedance2ReturnLastFrame`
- `seedance2WebSearch`
- `klingNegativePrompt`
- `klingCfgScale`
- `klingWorkflowMode`
- `klingShotType`
- `klingVoiceIds`
- `klingMultiPrompts`
- `klingElements`

Music payload should include:

- `text`
- `lyrics`
- `durationSeconds`
- `bpm`
- `mode`
- `structure`
- `energyPercent`
- `outputFormat`
- `composerMode`
- `singerEnabled`
- `songBatchCount` if it affects request count or output behavior

Sound Effects payload should include:

- `text`
- `durationSeconds`
- `loop`
- `promptInfluence`
- `outputFormat`

Voiceover payload should include:

- `script`
- `voiceId`
- `voiceName`
- `outputFormat`
- `config`

Voice Changer payload should include:

- `source`
- `voiceId`
- `voiceName`
- `outputFormat`
- `modelId`
- `inputFormat`
- `removeBackgroundNoise`
- `voiceSettings`
- `sourceName`
- `sourceOrigin`
- `sourceStoragePath` or an internal media reference
- `originalVideoStoragePath`, `originalVideoName`, `originalVideoMimeType`, and `originalVideoAspect` when the generated output came from a video source

## Persistence Design

Add a forward migration:

- Create `sql/migrations/148_add_generation_projection_workflow_reload.sql`.
- Add `generation_projection.workflow_reload jsonb not null default '{}'::jsonb`.
- Add a check constraint requiring `jsonb_typeof(workflow_reload) = 'object'`.
- Do not add an index in v1 unless a query path proves it needs one.
- Add `sql/migrations/rollback/148_add_generation_projection_workflow_reload_rollback.sql` unless the implementation documents a specific reason a rollback is not feasible.
- Update `docs/supabase_full_schema.sql`, `docs/data-dictionary.md`, and `docs/security-checklist.md` during implementation because this is a Supabase table contract change.

Thread `workflow_reload` through server persistence:

- `frontend/lib/server/api/generationProjection.ts`
- `frontend/lib/server/api/falSubmitProxy.ts`
- `frontend/lib/server/openaiImageGeneration.ts`
- `frontend/lib/server/elevenlabs.ts`
- `frontend/lib/server/api/terminalConvergenceViewSync.ts`
- `frontend/lib/server/falIntegration/recoveryExecution.ts`
- `frontend/lib/server/projectGenerationAssociationsService.ts`
- `frontend/lib/server/projectOutputDisplayItemsService.ts`
- `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts`
- `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
- Relevant tests under `frontend/lib/server/**/__tests__` and `frontend/features/ai-studio/logic/__tests__`

Mirror `workflow_reload` into `ai_generations.metadata` and generated `media_files.metadata` when those rows are created. `generation_projection.workflow_reload` remains the canonical reload read model, while media metadata helps saved-library and admin trace surfaces preserve context.

Project workspace snapshots should continue trimming rich generated-output metadata for settled outputs. Add `workflowReload` to the trim list and patch it back from `generation_projection` on project restore, matching the existing `generationReplay`, `characterContext`, and `styleContext` pattern.

## Client Capture Plan

Create a new file:

- `frontend/features/ai-studio/logic/workflowReload.ts`

It should own:

- `buildWorkflowReloadConfigV1`
- `isWorkflowReloadConfigV1`
- `canReloadWorkflowOutput`
- `deriveImageWorkflowReloadFromGenerationReplay` as a documented compatibility helper
- Sanitizers for strings, arrays, internal refs, and per-workflow payloads

Add `workflowReload?: WorkflowReloadConfig` to `StudioOutput`.

Image and video capture should happen in the same area currently building `generationReplay`:

- Build `workflowReload` in `useAiStudioTaskSubmission.ts` after reference preparation and before dispatch.
- Attach it to the optimistic output before submit.
- Pass it through `dispatchSubmissionByRoute` and submit handlers as `workflowReload`.
- Send it to API routes as `workflow_reload`.
- Keep `generationReplay` untouched for existing reroll behavior until reload is proven and a separate retirement decision exists.

Audio capture should happen in `useAiStudioAudioGeneration.ts`:

- Build voiceover, voice-changer, music, and sound-effects reload configs before calling their ElevenLabs routes.
- Attach reload metadata to optimistic outputs and final placeholder replacements.
- Send `workflow_reload` in JSON bodies and `workflowReload` in multipart form data where existing route naming uses camelCase.
- Update ElevenLabs API routes and `frontend/lib/server/elevenlabs.ts` to persist the object.

## Audio State Hardening Plan

Do not ship audio reload until generation-critical audio panel state is page-owned or controlled through a single hook. Patchwork reload into local component state would be fragile.

Music:

- Promote `composerMode`, `singerEnabled`, `songBatchCount`, `bpm`, `mode`, `structure`, `energyPercent`, and `outputFormat` if any of them affect generation.
- Keep prompt, lyrics, and duration in the existing page-owned state.
- Add panel props and callbacks only for generation-critical fields.

Sound Effects:

- Promote `loopEnabled`, `promptInfluence`, and `outputFormat`.
- Keep prompt and duration in existing page-owned state.

Voices:

- Promote selected voice identity or expose a controlled selected-voice bridge from `useSharedVoicesGrid`.
- Keep `voiceScript`, `voicePrompt`, `voiceChangerSource`, and active source video page-owned.
- Add a deterministic restore path that either selects the saved voice or fails visibly if the voice is no longer available to the user.
- Do not restore custom voice ownership from `user_preferences` alone; use the existing user-owned custom voice authority.

## Runtime Reload Controller

Create a new hook:

- `frontend/features/ai-studio/hooks/useAiStudioWorkflowReloadController.ts`

Responsibilities:

- Resolve the output by id.
- Validate `workflowReload` with `canReloadWorkflowOutput`.
- Navigate to `originTool` using the existing selected-tool action path.
- Hydrate only workflow panel state required by generation.
- Restore reference inputs through canonical internal media refs where present.
- Restore prompts, model, aspect, image resolution, video settings, and audio settings.
- Preserve global Reference Grid, Quick Slot Inventory, and Canvas state.
- Return a small status result for success, missing metadata, unavailable voice/source, or unsupported legacy output.

Implementation should avoid racing `useAiStudioWorkflowSettings` automatic tab hydration. Preferred design:

- Add an explicit "manual reload in progress" guard or transactional setter so automatic outgoing/incoming workflow settings do not overwrite newly hydrated state.
- Set selected tool first, then apply state in the next controlled transaction.
- Store a short-lived reload token in a ref if effects need to ignore one cycle of automatic workflow settings persistence.

## UI Wiring Plan

Reference Grid v1:

- Add `onReloadWorkflowOutput?: (output: StudioOutput) => void` to `referenceGridTypes.ts`.
- Thread it through `ReferenceGrid.tsx`, `useReferenceGridCardRenderController.tsx`, `ReferenceGridCard.tsx`, `useAiStudioReferenceGridProps.ts`, `AiStudioReferenceRail.tsx`, and any shell frame props that compare Reference Grid prop identity.
- Update `referenceGridPropsEquality.ts` and its tests.
- Render the action only when `canReloadWorkflowOutput(item)` is true.
- Keep curated-surface behavior aligned with reroll behavior unless product review says curated cards should also expose reload.
- Use an existing Phosphor icon and accessible label such as `Reload workflow`.

Detail modal v1.1:

- Add the same action to `DetailModal.tsx` through `SharedMediaDetailActionBar` after Reference Grid action behavior is proven.
- Avoid separate modal-only reload logic.

Media Library v1.2:

- For saved generated media, resolve restore metadata from `media_files.metadata.workflow_reload` when present.
- Prefer projection lookup by `generationId` or `source_ref` when available because projection is canonical.
- Do not show reload on uploaded user media unless it has explicit workflow metadata.

## Legacy Compatibility

New outputs should require valid `workflowReload`.

Existing image outputs with valid `generationReplay` may use a documented compatibility bridge:

- `deriveImageWorkflowReloadFromGenerationReplay` should produce a v1 image reload config.
- The compatibility button may be shown for image generated outputs if the derived config passes validation.
- This is not a generic inference fallback.
- Add tests that prove only valid replay-shaped image metadata derives reload metadata.
- Document a removal condition after old project/output restore compatibility is no longer needed.

Outputs without valid `workflowReload` or compatible image replay should simply not show the reload action. That avoids a misleading button that cannot faithfully restore the generation setup.

## Autonomous Implementation Phases

### Phase 1: Contract And Tests

- Add `WorkflowReloadConfig` types in `frontend/features/ai-studio/types.ts`.
- Add `workflowReload.ts` builder, parser, eligibility helper, and image replay compatibility derivation.
- Add unit tests for each supported workflow payload.
- Add negative tests for malformed metadata, uploaded media, and unsupported legacy outputs.

Exit proof:

- `npm -C frontend run test -- features/ai-studio/logic/__tests__/workflowReload.test.ts`

### Phase 2: Projection And Server Persistence

- Add SQL migration and rollback.
- Add `workflowReload` to `UpsertGenerationProjectionInput`.
- Select, parse, upsert, repair, sync, and project-patch `workflow_reload` wherever `generation_replay` is already handled.
- Mirror `workflow_reload` into `ai_generations.metadata` and generated `media_files.metadata`.
- Update server tests for generation projection, terminal convergence sync, project workspace states, project generation associations, OpenAI image generation, Fal submit proxy, and ElevenLabs persistence.

Exit proof:

- `npm -C frontend run test -- lib/server/api/__tests__/generationProjection.test.ts`
- `npm -C frontend run test -- lib/server/__tests__/projectGenerationAssociationsService.test.ts`
- `npm -C frontend run test -- lib/server/__tests__/projectWorkspaceStatesService.test.ts`

### Phase 3: Capture On Generation

- Build and attach reload metadata for image and video in `useAiStudioTaskSubmission.ts`.
- Pass `workflowReload` through `taskSubmission/types.ts`, `routeDispatch.ts`, `imageHandlers.ts`, `videoHandlers.ts`, and `defaultHandlers.ts`.
- Build and attach reload metadata for audio in `useAiStudioAudioGeneration.ts`.
- Update API route payload parsing for JSON and multipart audio routes.
- Keep all existing request semantics and provider payloads unchanged except the metadata field.

Exit proof:

- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioAudioGeneration.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/taskSubmission/__tests__/seedreamSubmission.test.ts`

### Phase 4: Audio State Promotion

- Promote generation-critical Music, Sound Effects, and Voices state before enabling reload for those tools.
- Add controlled props and page runtime state only for generation-critical fields.
- Update panel tests to prove controlled state round trips and defaults remain unchanged.
- Keep non-generation UI-only state local.

Exit proof:

- `npm -C frontend run test -- features/ai-studio/components/__tests__`
- Targeted audio panel tests added or updated for promoted controls.

### Phase 5: Manual Reload Controller

- Implement `useAiStudioWorkflowReloadController.ts`.
- Wire it through `useAiStudioState.ts` or the current page runtime composition layer, depending on the existing action ownership.
- Add transactional hydration for Create, Edit, Video, Music, Sound Effects, Voiceover, and Voice Changer.
- Add failure statuses for stale voice, missing source asset, invalid metadata, and unsupported legacy output.
- Prove it does not fork or reset right-rail global state.

Exit proof:

- New hook tests for each workflow family.
- Existing workflow settings tests still pass.
- Reroll tests still pass unchanged.

### Phase 6: Reference Grid Button

- Add the reload action prop and button through the Reference Grid action path.
- Keep button visibility gated by `canReloadWorkflowOutput`.
- Add tests for button visibility, click behavior, and non-restorable outputs.
- Update prop equality tests.

Exit proof:

- `npm -C frontend run test -- features/ai-studio/reference-grid/components/__tests__/ReferenceGridCard.test.tsx`
- `npm -C frontend run test -- features/ai-studio/reference-grid/logic/__tests__/referenceGridPropsEquality.test.ts`
- `npm -C frontend run test -- features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`

### Phase 7: Saved Library And Detail Modal Follow-Up

- Add detail-modal action after Reference Grid behavior is stable.
- Add Media Library reload support for saved generated media that carries explicit restore metadata.
- Prefer projection lookup when the saved item has a `generationId`.
- Keep uploaded media reload disabled unless explicit workflow metadata exists.

Exit proof:

- Detail modal tests for action visibility and dispatch.
- Media Library model tests for metadata parsing and projection preference.

### Phase 8: Docs, Validation, And Rollout

- Update `docs/sops/sop_ai_studio_create_properties_generation_wiring.md` for image/video capture.
- Add or update an AI Studio Sound SOP section if audio reload changes audio panel ownership.
- Update `docs/data-dictionary.md`, `docs/security-checklist.md`, and `docs/supabase_full_schema.sql` for schema changes.
- Update `docs/planning/backlog.md` or archive this plan after implementation completes.
- Run focused tests first, then `npm -C frontend run docs:check`, `npm -C frontend run lint`, and `npm -C frontend run build` before closeout if the implementation pass changes code.

## Test Matrix

| Behavior | Tests |
| --- | --- |
| Valid image reload metadata builds | `workflowReload.test.ts` |
| Valid video reload metadata builds | `workflowReload.test.ts`, `useAiStudioTaskSubmission.test.ts` |
| Valid audio reload metadata builds | `workflowReload.test.ts`, `useAiStudioAudioGeneration.test.ts` |
| Projection stores and reads metadata | `generationProjection.test.ts` |
| Project restore patches trimmed metadata | `projectGenerationAssociationsService.test.ts`, `projectWorkspaceStatesService.test.ts` |
| Reference Grid shows button only when valid | `ReferenceGridCard.test.tsx`, `ReferenceGrid.curated.test.tsx` |
| Manual reload hydrates panel state | new `useAiStudioWorkflowReloadController.test.tsx` |
| Existing reroll remains stable | `useAiStudioState.reroll.test.ts`, `generationReplay.test.ts` |
| Audio controlled-state promotion is safe | targeted panel tests for Music, Sound Effects, and Voices |
| Docs stay indexed | `npm -C frontend run docs:check` |

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Reload and reroll semantics get mixed together | Keep `generationReplay` for reroll and `workflowReload` for navigate-and-hydrate. |
| Audio reload becomes patchwork due to local panel state | Promote generation-critical state before enabling audio reload. |
| Project restore loses metadata because snapshots trim rich output fields | Patch `workflowReload` back from `generation_projection`, mirroring `generationReplay`. |
| Old outputs show a misleading reload button | Hide the button unless valid metadata exists or valid image replay derives a config. |
| Workflow settings auto-restore overwrites manual reload state | Add a transaction or guard in the manual reload controller. |
| Voice reload selects a voice the user no longer owns | Fail visibly and do not hydrate an unsafe voice id. |
| Media Library saved items drift from projection metadata | Prefer projection by `generationId`; media metadata is a mirror, not authority. |
| New schema field misses Supabase grants or RLS expectations | Add the field to existing RLS-protected `generation_projection` and run SQL audit in implementation. |

## Plan Audit

This plan was checked against the current repo seams on 2026-06-06:

- It uses the existing generated-output projection architecture instead of adding a parallel project metadata store.
- It respects ADR 0083 by keeping Reference Grid, Quick Slot Inventory, and Canvas workspace-global.
- It respects ADR 0063 and ADR 0065 by keeping project workspace snapshots as restore envelopes and generation projection as generated-output metadata authority.
- It avoids the existing `generationReplay` trap by preserving reroll as immediate-submit and defining reload as navigate-and-hydrate.
- It accounts for the fact that audio panels currently keep some generation-critical fields in local state.
- It names the runtime feature `workflowReload` to avoid confusion with internal automatic workflow-settings restore.
- It includes docs and schema follow-ups required by the repo's docs and Supabase policies.

Implementation should start at Phase 1 and should not skip audio state promotion if audio reload is included in the shipped button.

## Implementation Closeout

Completed local buildout:

- Added `WorkflowReloadConfig` and metadata validation/compatibility helpers.
- Added `generation_projection.workflow_reload` migration/rollback and threaded persistence through projection, generation, media, project restore, and saved-library read models.
- Captured reload metadata for image, video, music, sound effects, voiceover, and voice changer generation paths.
- Promoted the audio panel state required for deterministic reload hydration.
- Added the manual reload controller, Reference Grid action, Detail Modal action, and saved Media Library action.
- Updated docs for the reload contract and Supabase metadata boundary.

Proof captured during implementation:

- `npm -C frontend run test -- features/ai-studio/logic/__tests__/workflowReload.test.ts`
- `npm -C frontend run test -- lib/server/api/__tests__/generationProjection.test.ts`
- `npm -C frontend run test -- lib/server/__tests__/projectGenerationAssociationsService.test.ts`
- `npm -C frontend run test -- lib/server/__tests__/projectWorkspaceStatesService.test.ts`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/generatedMediaAuthority.test.ts`
- `npm -C frontend run test -- lib/server/api/__tests__/directGenerationSettlement.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioAudioGeneration.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/taskSubmission/__tests__/seedreamSubmission.test.ts`
- `npm -C frontend run test -- features/ai-studio/components/__tests__/MusicPropertiesPanel.test.tsx`
- `npm -C frontend run test -- features/ai-studio/components/__tests__/SoundEffectsPropertiesPanel.test.tsx`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioCreationState.test.ts`
- `npm -C frontend run test -- features/ai-studio/components/__tests__/VoicesPropertiesPanel.test.tsx`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioWorkflowReloadController.test.ts features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts features/ai-studio/hooks/__tests__/useAiStudioState.reroll.test.ts`
- `npm -C frontend run test -- features/ai-studio/reference-grid/components/__tests__/ReferenceGridCard.test.tsx features/ai-studio/reference-grid/logic/__tests__/referenceGridPropsEquality.test.ts features/ai-studio/hooks/__tests__/useAiStudioReferenceGridProps.test.ts features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`
- `npm -C frontend run test -- features/ai-studio/components/__tests__/DetailModal.test.tsx`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/mediaLibraryWorkflowReload.test.ts features/ai-studio/components/__tests__/MediaLibraryPanelPreviewModal.test.tsx features/ai-studio/components/__tests__/MediaLibraryMediaGrid.test.tsx tests/api/media-list.test.ts`
