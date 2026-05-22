# AI Studio Audio Companion Art Plan (2026-05-11)

Status: audited and updated on 2026-05-22  
Scope: AI Studio generated audio refs and their audio-card surfaces  
Audience: follow-on implementation agent, product reviewer, docs/runtime reviewers

## Purpose

Define the current execution plan for AI Studio audio companion art after the first rollout shipped.

This document is no longer a greenfield implementation plan. The repo already ships hidden audio
companion art across the core generation, projection, restore, and rendering seams. The remaining
work is to harden that system, shrink delivery/storage cost, and close cleanup/ownership gaps
without widening scope into a visible image feature.

## Executive Summary

Recommended posture:

1. Keep companion art as `audio-owned hidden decoration`, not a user-visible image asset.
2. Preserve the current generated-audio-only rollout.
3. Keep companion art fully asynchronous and non-fatal to audio completion.
4. Reframe the remaining lane around `delivery asset hardening`, not initial feature creation.
5. Replace the current full-size browse asset with a lightweight audio-card delivery asset.
6. Close lifecycle cleanup gaps so hidden companion-art objects do not orphan on delete.
7. Freeze ownership/quota semantics explicitly before changing storage behavior.

## Repo-Backed Current-State Audit

### Trusted shipped facts

1. `StudioOutput` already has a dedicated companion-art contract in
   `frontend/features/ai-studio/types.ts`:
   - `companionArtUrl`
   - `companionArtStoragePath`
   - `companionArtStatus`
2. Audio generation already returns pending companion-art fields through:
   - `frontend/features/ai-studio/hooks/useAiStudioAudioGeneration.ts`
   - `frontend/pages/api/elevenlabs/text-to-speech.ts`
   - `frontend/pages/api/elevenlabs/music.ts`
   - `frontend/pages/api/elevenlabs/sound-effects.ts`
   - `frontend/pages/api/elevenlabs/speech-to-speech.ts`
3. The hidden async generation lane already exists in:
   - `frontend/lib/server/audioCompanionArt/promptCompiler.ts`
   - `frontend/lib/server/audioCompanionArt/processing.ts`
4. `generation_projection` already carries companion-art fields and retry state through migration
   `sql/migrations/123_add_audio_companion_art_projection_fields.sql`.
5. Reference Grid and AI Studio Media Library audio cards already render companion art through:
   - `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx`
   - `frontend/features/ai-studio/components/shared/ReferenceAudioPlayer.tsx`
   - `frontend/features/ai-studio/components/media-library-modal/MediaLibraryAllItemsGrid.tsx`
6. Session save/restore and generated-output hydration already understand companion-art fields:
   - `frontend/features/ai-studio/logic/sessionSnapshot.ts`
   - `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
   - `frontend/features/ai-studio/logic/sessionRestoreMediaSigning.ts`
   - `frontend/features/ai-studio/logic/generatedOutputHydration.ts`
7. Project-scoped output refresh also preserves companion-art projection fields through
   `frontend/lib/server/projectGenerationAssociationsService.ts`.

### Trusted current problems

1. The prompt compiler hard-codes companion-art generation to `1024x1024` at `low` quality in
   `frontend/lib/server/audioCompanionArt/promptCompiler.ts`.
2. The processor uploads the generated image directly as a raw PNG browse asset at
   `<uid>/generations/audio/<generationId>/companion-art/cover.png` in
   `frontend/lib/server/audioCompanionArt/processing.ts`.
3. Audio-card surfaces currently consume the signed original companion-art object instead of a
   dedicated lightweight delivery asset.
4. The rendered audio-card surface is much smaller than the stored asset:
   - audio cards are `4 / 5` tiles in `frontend/styles/ai-studio-canvas.css`
   - waveform/time content is capped to `78px` wide in the same stylesheet
5. Companion art bypasses the normal `media_files` row path and the existing image-derivative
   pipeline, so it is not covered by ordinary media-row deletion and does not reuse the repo’s
   thumbnail conventions.
6. Media Library delete currently removes the audio media row and its known variants, but companion
   art is projection-owned and not part of that delete target set.
7. Suppressed or abandoned generations are not an explicit exclusion in the current companion-art
   processor claim query, so a hidden/suppressed audio output can still remain eligible for
   companion-art work unless the lane adds a deliberate gate.
8. Delete flows already use different database-vs-storage ordering across surfaces, so the
   companion-art cleanup lane needs one explicit failure policy rather than inheriting inconsistent
   behavior accidentally.
9. The current storage/quota posture is implicit rather than explicitly frozen:
   hidden companion-art bytes live outside the canonical `media_files.file_size` quota contract.

### Audit conclusion

The repo no longer needs a plan for creating companion art from scratch.

The repo now needs a plan for:

- shrinking the delivery asset,
- making cleanup deterministic,
- clarifying storage ownership/quota semantics,
- and optionally repairing old full-size assets.

UI rollout is already shipped. The follow-on lane should avoid re-solving prompt compilation,
projection fields, or rendering wiring unless required by the new lightweight delivery contract.

## Product Contract

### In scope for this follow-on lane

- newly generated AI Studio audio outputs only
- Reference Grid audio cards
- AI Studio Media Library inline audio cards where those generated outputs surface
- hidden async companion-art generation after audio success
- replacement of the current full-size browse asset with a small delivery asset
- cleanup of hidden companion-art storage on relevant delete/remove paths
- explicit ownership/quota policy for hidden companion-art storage
- optional bounded compatibility/backfill strategy for older full-size assets

### Explicitly out of scope

- uploaded audio parity
- existing non-generated library audio parity
- companion art as a visible standalone image output
- project-card preview usage of companion art
- reuse of video-poster semantics as the long-term audio solution
- full visual redesign of audio cards
- generic hidden-image infrastructure for unrelated surfaces
- expansion into remuxed video surfaces unless a separate product decision widens scope

### Required behavior

- Audio appears immediately with the existing fallback gradient.
- Companion art upgrades the card asynchronously when ready.
- Companion-art generation or resize failure never blocks audio playback or audio success.
- Companion art remains hidden from normal image-output surfaces, project previews, and visible
  output counting.
- Suppressed or abandoned outputs do not generate new companion-art work after suppression takes
  effect.
- The delivery asset is intentionally low-cost relative to the audio-card surface.
- Delete, restore, and cleanup behavior are explicit rather than incidental.

## Authority Map

These are the primary seams for the follow-on lane.

### Existing generation and prompt seams

- `frontend/lib/server/audioCompanionArt/promptCompiler.ts`
- `frontend/lib/server/audioCompanionArt/processing.ts`
- `frontend/lib/server/openaiImageGeneration.ts`
- `frontend/pages/api/elevenlabs/text-to-speech.ts`
- `frontend/pages/api/elevenlabs/music.ts`
- `frontend/pages/api/elevenlabs/sound-effects.ts`
- `frontend/pages/api/elevenlabs/speech-to-speech.ts`

### Existing output and read-model seams

- `frontend/features/ai-studio/types.ts`
- `frontend/features/ai-studio/hooks/useAiStudioAudioGeneration.ts`
- `frontend/features/ai-studio/hooks/useAiStudioGeneratedOutputMaintenance.ts`
- `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
- `frontend/lib/server/projectGenerationAssociationsService.ts`
- `frontend/pages/api/media/list.ts`

### Existing restore/session seams

- `frontend/features/ai-studio/logic/sessionSnapshot.ts`
- `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
- `frontend/features/ai-studio/logic/sessionRestoreMediaSigning.ts`
- `frontend/features/ai-studio/logic/generatedOutputHydration.ts`

### Existing UI seams

- `frontend/features/ai-studio/components/shared/ReferenceAudioPlayer.tsx`
- `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx`
- `frontend/features/ai-studio/components/media-library-modal/MediaLibraryAllItemsGrid.tsx`
- `frontend/styles/ai-studio-canvas.css`
- `frontend/styles/ai-studio-media-library-panel.css`

### Existing derivative and cleanup seams to prefer

- `frontend/lib/server/mediaDerivatives/processMediaDerivative.ts`
- `frontend/lib/mediaPreviewTransformProfile.ts`
- `frontend/features/media-library/logic/mediaLibraryDataEffects.ts`

## Decision Register

Freeze these before code changes.

| Decision               | Options                                                                                    | Recommended default                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Rollout scope          | Generated audio only / broader parity                                                      | Generated audio only                                                               |
| Storage representation | Small delivery asset only / raw source + small delivery asset                              | Small delivery asset only unless a raw source has a concrete future use            |
| Delivery format        | PNG / JPEG / WebP                                                                          | WebP delivery asset                                                                |
| Delivery size target   | 240px / 480px / larger                                                                     | 240-480px browse asset                                                             |
| Historical posture     | Leave old rows / lazy upgrade / bounded backfill                                           | Leave old rows or lazy-upgrade by touch unless storage evidence justifies backfill |
| Ownership model        | Projection-owned hidden asset / media-file-owned hidden asset / formal derivative contract | Hidden asset with explicit authoritative cleanup seam                              |
| Quota posture          | Internal hidden storage exempt from quota / count toward user quota                        | Must be explicitly frozen before rollout                                           |
| Async trigger model    | Existing server-side enqueue / client follow-up                                            | Keep existing server-side enqueue                                                  |
| Suppression posture    | Allow suppressed rows to finish / gate suppressed rows before work begins                  | Gate suppressed or abandoned rows before companion-art work begins                 |
| Restore behavior       | Durable by storage-path authority / runtime-only                                           | Keep current durable storage-path authority                                        |
| Cleanup authority      | Media delete only / generation delete only / shared explicit cleanup helper                | Shared explicit cleanup helper                                                     |
| Delete failure policy  | Storage-first / DB-first / route-specific behavior                                         | Freeze one explicit policy and apply it consistently                               |
| Rollout safety         | Direct cutover / flag-gated cutover                                                        | Flag-gated cutover if asset format/path changes materially                         |

## Proposed Target Contract

### Companion-art runtime contract

Keep the current public field names unless a rename is required for clarity:

- `companionArtUrl?: string | null`
- `companionArtStoragePath?: string | null`
- `companionArtStatus?: "pending" | "processing" | "ready" | "failed" | null`

Interpretation after this lane:

- `companionArtStoragePath` should point to the lightweight card-delivery asset, not an
  unnecessarily large browse image.
- If a raw source asset is retained, it should remain internal implementation detail rather than
  the default UI authority field.

### Delivery contract

1. Audio success returns immediately with `companionArtStatus: "pending"`.
2. The hidden lane generates art asynchronously.
3. The hidden lane persists a lightweight audio-card asset.
4. UI surfaces consume the lightweight signed asset.
5. Failure leaves the audio card on the fallback gradient.

## Rejected Shapes

Do not do these:

- do not re-open this as a visible image-generation feature
- do not widen into uploaded/library audio parity in the same lane
- do not keep serving full-size `1024x1024` PNGs to tiny card backgrounds once the replacement path
  exists
- do not create a second ad hoc resize pipeline when the repo already has derivative conventions
- do not leave cleanup ownership implicit across `media_files` delete and projection-owned storage
- do not let companion art leak into project preview selection

## Updated Phase Plan

### Phase 0: Contract Reset

Objective:

- freeze the follow-on lane as `shipped baseline + optimization/hardening`, not initial rollout

Work:

- confirm generated-audio-only scope remains correct
- freeze storage representation (`small delivery asset only` vs `raw + small`)
- freeze quota posture
- freeze suppression posture for suppressed/abandoned generations
- freeze cleanup authority
- freeze delete failure policy
- freeze historical posture for old full-size assets
- freeze rollback/flag posture if delivery-path format changes

Exit criteria:

- every row in the updated Decision Register is frozen

Stop rule:

- do not change storage or UI delivery until storage representation and cleanup authority are
  explicit

### Phase 1: Lightweight Write Path

Objective:

- stop producing oversized browse assets for audio-card backgrounds

Work:

- update the processor to emit a lightweight delivery asset
- prefer reuse of the existing derivative strategy/pattern
- keep audio companion-art generation asynchronous and non-fatal
- add an explicit eligibility gate so suppressed/abandoned generations do not keep generating new
  hidden art
- keep prompt-compiler behavior unchanged unless visual quality evidence requires retuning

Audit questions:

- Is the delivery asset materially smaller than the current raw PNG?
- Is the new asset still visually acceptable behind the audio-card shell?
- Are suppressed or abandoned generations excluded before work is claimed or uploaded?
- Did we accidentally create a second source of truth for companion-art storage?

Exit criteria:

- newly generated companion art persists as a lightweight delivery asset

Stop rule:

- do not cut UI delivery over until the new asset path is stable and measurable

### Phase 2: Read-Model And UI Delivery Cutover

Objective:

- make all in-scope surfaces consume the lightweight asset

Work:

- update generated-output delivery signing paths
- update media-list enrichment for generated audio rows
- confirm session snapshot/restore continues to rely on storage-path authority
- preserve current fallback styling and interaction behavior

Audit questions:

- Are Reference Grid and Media Library both loading the small asset?
- Are signed URL paths still stable across restore/hydration?
- Are project previews still ignoring companion art?

Exit criteria:

- the shipped surfaces no longer request the large original asset for audio-card backgrounds

Stop rule:

- do not widen surface scope if one of the two shipped surfaces still uses the old path

### Phase 3: Cleanup And Ownership Hardening

Objective:

- ensure hidden companion-art storage is removed when the owning audio is removed

Work:

- add explicit cleanup for companion-art objects on relevant delete flows
- clear projection companion-art metadata when the owning asset/generation is deleted or suppressed
- align companion-art cleanup with one explicit DB/storage ordering and failure policy
- define behavior for project delete, generation delete, abandon, and permanent library delete

Audit questions:

- Can hidden companion-art storage survive `Delete from library` today?
- Which seam is authoritative for deleting companion art when media rows and projection rows both
  exist?
- Do cleanup failures degrade safely and observably?

Exit criteria:

- in-scope delete paths remove hidden companion-art storage deterministically

Stop rule:

- do not treat storage optimization as complete if cleanup still leaves orphaned hidden assets

### Phase 4: Compatibility Repair

Objective:

- decide how to handle already-generated full-size assets

Work:

- choose leave-alone, lazy-upgrade, or bounded backfill
- optionally add an orphan-repair or old-asset repair helper
- avoid repo-wide churn unless storage evidence justifies it

Audit questions:

- Is the volume of existing full-size companion art large enough to justify repair work now?
- Can we safely repair by touch instead of running a one-off migration?

Exit criteria:

- historical posture is explicit and documented

Stop rule:

- skip backfill if the repo lacks evidence that repair has better ROI than stopping

### Phase 5: Validation, Metrics, And Docs

Objective:

- prove the lane reduces cost without changing product behavior

Work:

- add or update tests for processor output, delivery signing, restore, and delete cleanup
- capture before/after byte-size evidence
- update this doc and any relevant SOP notes with the final contract

Validation targets:

- no full-size companion-art PNGs requested for audio-card backgrounds after cutover
- typical delivery asset is materially smaller than the current raw asset
- fallback gradient remains correct for pending and failed states
- one-sound-at-a-time behavior remains unchanged
- delete cleanup removes companion-art storage

Exit criteria:

- companion art remains visually correct while reducing storage/delivery cost and closing cleanup
  gaps

Stop rule:

- stop when the hidden lightweight contract is stable; do not continue by adjacency into upload
  parity or generic hidden-image systems

## Validation Matrix

### Unit and server coverage

- prompt compiler continues to normalize by source mode
- processor emits the new lightweight asset shape
- failure marks `failed` without harming audio success
- cleanup helper removes companion-art storage and clears metadata

### Hydration and restore coverage

- generated-output hydration preserves the new companion-art storage authority
- session save prefers storage-path authority over raw signed URLs
- restore re-signs the lightweight asset correctly

### UI coverage

- Reference Grid audio card uses the lightweight asset
- AI Studio Media Library inline audio card uses the lightweight asset
- pending/failed fallback remains intact
- playback behavior remains unchanged

### Explicit non-regression checks

- no visible extra image refs are added to normal output surfaces
- project preview/counting behavior still ignores companion art
- out-of-scope remuxed video surfaces remain unchanged
- suppressed or abandoned generations do not continue producing companion art in the background
- delete from `All Media` does not leave hidden companion-art storage behind

## Risks

### Risk 1: Cleanup still leaks hidden storage

Why it matters:

- storage savings are undermined if old hidden assets persist

Mitigation:

- add one explicit cleanup authority seam and test it

### Risk 2: Small assets look too degraded

Why it matters:

- users still need the cards to feel polished

Mitigation:

- keep a measurable size target and a rollback path

### Risk 3: Quota semantics stay ambiguous

Why it matters:

- hidden storage can drift away from product expectations

Mitigation:

- freeze quota posture in Phase 0 and document it

### Risk 4: Scope creep into a general media system rewrite

Why it matters:

- this lane can easily expand into unrelated image/storage cleanup work

Mitigation:

- keep the non-goals explicit and stop after the audio-card contract is hardened

### Risk 5: Suppressed outputs still generate hidden assets

Why it matters:

- a user-hidden or abandoned generation can keep creating storage cost after suppression

Mitigation:

- add a suppression gate to the processor claim path and validate it explicitly

## Suggested Build Order

1. freeze the updated Decision Register
2. implement the lightweight write path
3. cut read-model and UI delivery over to the lightweight asset
4. harden delete/cleanup ownership
5. decide and document historical posture
6. capture validation evidence and doc closeout

## Closeout

This lane is ready for implementation as a targeted hardening pass.

The repo already ships the companion-art feature. The remaining work is to make that shipped system
smaller, cleaner, and more explicitly owned without changing the visible product contract.
