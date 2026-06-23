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

## Fresh Deploy Audio Proof Refresh

Result:

- After the user deployed to `shortpulse-nx9ncr9q5`, `PLAYWRIGHT_AUDIO_EXCLUSIVITY_BASE_URL=https://www.shortpulse.ai npm run test:e2e:audio-exclusivity` passed.
- Production proof now covers inline Media Library audio handoff, Reference Grid to Media Library preview-modal handoff, and Reference Grid to generated DetailModal audio handoff on the fresh deployment.
- Uploaded audio fixture cleanup succeeded.
- Severe signal classification remained `ok=true`; observer noise was limited to aborted script/fetch/image requests during navigation/runtime churn.

Boundary:

- The generated DetailModal audio deploy-proof gap is closed for `shortpulse-nx9ncr9q5`. Broader video/audio/prompt reuse variants, full creative-flow project association, and production prompt save/reopen/reuse continuity remain open.

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

## Fresh Deploy Video Variant Retry

Touched:

- `frontend/tests/e2e/media-panel-persistence.audit.js`
- Copperknot board/queue docs

Result:

- After route parity passed against `shortpulse-18sudlbt8`, the production media-panel persistence audit still did not pass for the video variant.
- The first run failed resolving the uploaded video row for folder membership; the harness now waits briefly for the uploaded row to appear in `/api/media/list` before failing that step.
- The rerun later failed on image fixture visibility during the broader mixed image/video audit path, and cleanup-only reported the video fixture as both deleted and still remaining.
- A scoped Supabase check confirmed one audit-owned video row still existed for `holomony-video-variant-audit-1782244226725.mp4`.
- Surgical cleanup removed exactly that audit-owned row and `3` storage objects, then verified `remainingRows=0`.
- The harness now refuses to target a video card unless the exact filename-labeled media button is present, preventing false reuse/delete success against the first visible video card.
- Harness validation passed for the touched audit file: `node --check`, scoped ESLint, and `git diff --check`.
- Follow-up cleanup-only verification returned `ok=true` with no remaining audit-owned image or video fixtures.

Boundary:

- Video variant production readiness remains open. The latest evidence points to a video-list/delete/proof-consistency gap rather than launch readiness. Do not score video variants as proven from this run.

## Fresh Deploy Cleanup-Consistency Refresh

Touched:

- `frontend/tests/e2e/media-panel-persistence.audit.js`
- `docs/agents/copperknot/memory.md`
- Copperknot board/queue docs

Result:

- Fresh production route parity still resolved `https://www.shortpulse.ai` to `shortpulse-18sudlbt8`, created `2026-06-23T19:39:58.783Z`, with `184` route entries inspected and required/forbidden routes passing.
- Secret exposure checks passed.
- Copperknot memory now requires a deploy/freshness performance score loop for queue discipline, ownership boundary, proof honesty, and churn risk before editing.
- The media-panel persistence audit now requires `3` consecutive exact `/api/media/list` misses before declaring an audit media row deleted.
- Video deletion verification no longer silently succeeds when the audit cannot read an access token.
- Validation passed: `node --check`, scoped ESLint, `npm -C frontend run docs:check`, and `git diff --check`.
- Cleanup-only production verification returned `ok=true` at `2026-06-23T20:04:19.165Z` with no audit-owned image or video fixtures remaining.
- A later stricter row-backed image cleanup pass found `4` stale audit-owned image rows that the older visible-DOM cleanup missed. It returned `ok=false`; video cleanup had no failures.

Boundary:

- This is proof-harness and Copperknot workflow hardening only. It reduces false-green cleanup evidence and churn risk, but video/audio/prompt variant product readiness remains open. Removing the `4` stale audit-owned image rows/storage objects is a destructive production cleanup gate and was not performed in this pass.
