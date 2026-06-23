# Copperknot Media Reuse / Audio Boundary Checkpoint

Date: 2026-06-23

Touched:

- `frontend/tests/e2e/media-panel-persistence.audit.js`
- `frontend/tests/e2e/ai-studio-audio-exclusivity.audit.js`
- `docs/agents/copperknot/july-7-launch-board.md`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`

Result:

- Production image Media Library reuse now passes for Reference Grid, Quick Slot Inventory, and Canvas through the real UI drag payload.
- Audio variant audit was hardened for cleanup reporting and current modal-scoped playback controls.
- The latest production audio run proved functional handoff for inline Media Library audio and Media Library preview-modal audio.
- The prior generic resource-load signal is now classified as non-severe aborted script/media/navigation fetches, and cleanup succeeded for both uploaded audio fixtures.
- The audio run still returned `ok=false` because shared detail-modal audio playback timed out after the preview-modal handoff succeeded.
- Video fixture coverage was added to the media-panel persistence harness, along with cleanup-only mode and media-list-backed cleanup verification.
- Production video variant proof did not pass in this pass; one audit-owned video fixture required exact Supabase admin cleanup after the UI delete path did not remove it.
- Final cleanup-only verification against `https://www.shortpulse.ai` returned `ok=true` with no audit-owned image or video fixtures remaining.
- Visual and audio Media Library cards now have explicit accessible select/deselect labels, including posterless video cards; focused local card validation passed at `1` file / `10` tests.

Boundary:

- Media remains below floor for video/audio/prompt variants, full creative-flow project association, save-to-library continuity, and post-deploy proof of the shared detail-modal audio handoff.

## Prompt Targetability Addendum

Touched:

- `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPromptReferenceCard.tsx`
- `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPromptGrid.tsx`
- `frontend/features/ai-studio/components/media-library-modal/__tests__/MediaLibraryPromptGrid.test.tsx`
- `frontend/features/ai-studio/components/__tests__/MediaLibraryAllItemsGrid.test.tsx`
- Copperknot board/queue docs

Result:

- Prompt cards now expose explicit `Select prompt <title>` / `Deselect prompt <title>` labels in reference-style and legacy/default prompt grids.
- Focused validation passed: prompt/mixed/media card tests `3` files / `36` tests, touched type-check, scoped ESLint, docs check, and diff check.

Boundary:

- This is local source/test hardening only. Production prompt reuse, full creative-flow project association, and save-to-library continuity remain open.

## Post-Deploy Audio Proof Addendum

Result:

- After deploy, `PLAYWRIGHT_AUDIO_EXCLUSIVITY_BASE_URL=https://www.shortpulse.ai npm run test:e2e:audio-exclusivity` passed.
- Production proof now covers Media Library inline audio handoff, Reference Grid to Media Library preview-modal handoff, and Reference Grid to generated detail-modal audio handoff.
- Uploaded audio fixture cleanup succeeded, and observer request noise remained classified as non-severe aborted script/fetch requests.

Boundary:

- The specific deployed detail-modal audio blocker is closed. Broader video/audio/prompt reuse variants, full creative-flow project association, and save-to-library continuity remain open.

## Fresh Deploy Audio Race Addendum

Result:

- After a later deploy to `shortpulse-qwae83wqg`, the same production audio audit regressed at generated detail-modal audio: the modal audio loaded and advanced, then paused before the steady-state assertion.
- Fixture cleanup still succeeded.
- Copperknot traced the likely source to the shared exclusive-sound coordinator: stale late play events could request playback before the late-starter guard and pause the newly requested detail audio.
- Local source now routes play and volume claims through guarded `claimExclusiveSoundPlayback`.
- Focused validation passed: exclusive-sound coordinator `4` tests, DetailModal `61` tests, Reference Grid card render controller `19` tests, touched type-check, scoped ESLint, and diff check.

Boundary:

- Generated detail-modal audio is local source-hardened again and awaiting post-deploy production proof. Inline Media Library audio and Media Library preview-modal handoff remain supported by production proof.

## Prompt Save Continuity Addendum

Touched:

- `frontend/features/ai-studio/components/DetailModal.tsx`
- `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPreviewDetailProps.ts`
- `frontend/features/ai-studio/hooks/contracts/pageContentContracts.ts`
- `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
- `frontend/features/ai-studio/components/detail-modal/detailModalPlatformTypes.ts`
- Focused DetailModal and persistence tests

Result:

- Detail modal prompt-library saves no longer show `Saved` until the async prompt persistence callback returns success.
- Local prompt-only edits still keep their existing local saved feedback when no prompt-library save callback exists.
- Focused validation passed: DetailModal `62` tests, preview-detail props `6` tests, persistence actions `19` tests, touched type-check, scoped ESLint, and diff check.

Boundary:

- This is local source/test hardening for save-to-library continuity. Production prompt save/reopen/reuse proof remains open.

## Media Delete Verification Addendum

Touched:

- `frontend/features/media-library/logic/mediaLibraryDataEffects.ts`
- `frontend/features/media-library/logic/__tests__/mediaLibraryDataEffects.test.ts`
- Copperknot board/queue docs

Result:

- `deleteMediaFileWithStorage` now asks Supabase to return the deleted `media_files.id` and throws if the delete affects no row.
- `deleteMediaPromptById` now applies the same returned-row verification for `media_prompts.id`.
- This prevents the Media Library panel from showing delete success and removing a card locally when the database row is still present.
- Storage cleanup now only runs after the row delete is verified, avoiding object cleanup after a false DB delete.
- Focused validation passed: data-effects `8` tests, panel mutation controller `4` tests, touched type-check, scoped ESLint, and diff check.

Boundary:

- This is local source/test hardening for the delete false-success class exposed by the production video audit cleanup and mirrored in prompt deletes. Production video and prompt variant delete/reuse proof remains open after deploy.
