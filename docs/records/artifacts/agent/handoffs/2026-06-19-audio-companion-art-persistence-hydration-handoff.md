# Audio Companion Art Persistence And Hydration Handoff

Date: 2026-06-19

Status: implementation-ready handoff for a temporary agent.

## Problem Statement

After refreshing AI Studio or reopening a persistent project, audio references in Media Library surfaces can lose their visual background image. The expected behavior is that audio references display their companion/background image anywhere the audio reference appears, including Media Library, embedded library services, Reference Grid, Quick Slot Inventory, Canvas, drag/drop payloads, and detail/selection flows.

This is not primarily a CSS/rendering issue. The audio renderer already displays a background when a URL is supplied. The failure is upstream: some reload/hydration paths do not reliably provide a signed `companion_art_url` or durable `companionArtStoragePath` for audio rows/outputs.

## Current Audit Conclusions

The issue spans two related authority seams:

- Shared media-library row projection: `/api/media/list` is the canonical source for Media Library row hydration. It already has generation/display-item companion-art enrichment, but the temporary agent must harden this path so refreshed audio rows reliably include companion-art authority when durable authority exists.
- Project workspace restore hydration: project read convergence intentionally preserves durable display rows and skips full projection repair. That can leave an audio output with durable audio media but missing companion art after reload, because the row is considered already display-authoritative.

Do not solve this by adding card-level fetches, modal-level fallbacks, CSS placeholders, or duplicated lookup logic in every consumer. Fix the canonical data authorities so all consumers receive the same complete audio media model.

## Key Source Map

Rendering and display consumers:

- `frontend/features/ai-studio/components/shared/ReferenceAudioPlayer.tsx`
  - Applies `backgroundImageUrl` directly to the audio card shell.
- `frontend/features/ai-studio/components/media-library-modal/MediaLibraryMediaCard.tsx`
  - Passes `resolveMediaAudioBackgroundImageUrl(file)` into `ReferenceAudioPlayer`.
- `frontend/features/ai-studio/logic/mediaLibraryModalModel.ts`
  - `resolveMediaAudioBackgroundImageUrl(file)` only works when row metadata already contains `companion_art_url` or a metadata/workflow fallback URL.
- `frontend/features/ai-studio/hooks/useMediaLibraryPanelItemInteractions.ts`
  - Drag payloads copy `companionArtUrl` and `companionArtStoragePath` from the media row.
- `frontend/features/ai-studio/hooks/useMediaLibraryPanelSelectionController.ts`
  - Selection/detail payloads copy companion art from the media row.
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx`
  - Uses `output.companionArtUrl` for audio reference card background.
- `frontend/features/ai-studio/components/canvas/CanvasAudioCard.tsx`
  - Uses `item.companionArtUrl` for Canvas audio backgrounds.

Shared media-library row authority:

- `frontend/pages/api/media/list.ts`
  - `enrichRowsWithGenerationProjectionMetadata` queries `generation_projection` and `project_output_display_items`, signs companion-art storage paths, and returns `companion_art_url` for audio rows.
- `frontend/lib/mediaListProfile.ts`
  - Select profiles currently include core media-file columns but not direct companion-art columns. Treat this as a hardening candidate only if the current DB schema or row source actually contains those columns; do not add nonexistent columns blindly.
- `frontend/features/media-library/logic/mediaListApi.ts`
  - Returns server rows as-is.
- `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`
  - Stores fetched media rows without repairing companion art locally.

Project restore authority:

- `frontend/lib/server/projectWorkspaceStatesService.ts`
  - `convergeProjectWorkspaceGeneratedOutputsForRead` calls `hydrateProjectSnapshotGeneratedOutputs` with `patchDurableSnapshotRows: false`.
- `frontend/lib/server/projectGenerationAssociationsService.ts`
  - `patchSnapshotOutputRow` can set `companionArtStoragePath` from `generation_projection`.
  - The durable-row preservation branch currently calls metadata-only patching when the row already has durable display authority.
- `frontend/lib/server/projectOutputDisplayItemsService.ts`
  - Stores and materializes `companion_art_storage_path` and `companion_art_url_fallback`.
- `frontend/features/ai-studio/logic/sessionSnapshot.ts`
  - Persists durable `companionArtStoragePath` and intentionally drops transient `companionArtUrl` when durable storage authority exists.
- `frontend/features/ai-studio/logic/sessionRestoreMediaSigning.ts`
  - Signs restored `companionArtStoragePath` into `companionArtUrl` once the storage path survives restore.
- `frontend/features/ai-studio/hooks/useAiStudioGeneratedOutputMaintenance.ts`
  - Runtime repair currently tracks pending/processing companion-art states, but a restored ready audio row with missing companion art may not be a repair candidate.

Generation/source authority:

- `frontend/pages/api/elevenlabs/music.ts`
- `frontend/pages/api/elevenlabs/sound-effects.ts`
- `frontend/pages/api/elevenlabs/speech-to-speech.ts`
- `frontend/pages/api/elevenlabs/text-to-speech.ts`
- `frontend/lib/server/audioCompanionArt/processing.ts`
  - Companion art is generated asynchronously and stored in generation/display authorities. Verify, but do not rewrite generation pipelines unless evidence proves capture is missing at source.

## Known Existing Proof

Already passing during audit:

- `npm -C frontend run test -- tests/api/media-list.test.ts`
- `npm -C frontend run test -- features/ai-studio/components/__tests__/MediaLibraryMediaGrid.test.tsx features/ai-studio/components/__tests__/MediaLibraryAllItemsGrid.test.tsx features/ai-studio/hooks/__tests__/useMediaLibraryPanelDataController.test.tsx`
- `npm -C frontend run test -- lib/server/__tests__/projectWorkspaceStatesService.test.ts`

Those tests prove existing intended paths, but they do not fully cover the reported reload failure. Add focused regression coverage before or alongside fixes.

## Required Implementation Plan

1. Reproduce the missing authority in tests.
   - Add a project restore test where an audio generated output has durable audio storage/media authority, projection companion art is ready, but the materialized display row or snapshot row lacks companion art.
   - Expected result: read convergence returns `companionArtStoragePath` and `companionArtStatus`, and subsequent restore signing can produce `companionArtUrl`.
   - Add or extend media-list API coverage for an audio row that should receive companion art after reload from generation/display authority.

2. Repair project restore hydration at the authority seam.
   - Keep the durable-row preservation behavior for preview/full media paths.
   - Add a narrow companion-art repair path for audio generated outputs when projection or display authority has `companion_art_storage_path` and the restored row lacks `companionArtStoragePath` or status.
   - Do not overwrite existing user-scoped storage paths unless the current value is missing or unsafe.
   - Do not change Reference Grid, Quick Slot, Canvas, or Media Library UI/UX.

3. Harden shared media-list row projection.
   - Ensure `/api/media/list` returns `companion_art_storage_path`, `companion_art_status`, and signed `companion_art_url` for audio rows when durable companion-art authority exists in `generation_projection` or `project_output_display_items`.
   - Preserve ownership checks: never sign or return another user's companion-art path.
   - Preserve the Supabase image transformation prohibition. Do not introduce `/storage/v1/render/image/` paths or transform parameters.
   - If source identity is the missing link, repair the canonical identity mapping at the media row/generation association seam, not by guessing in UI components.

4. Check runtime self-heal only if tests prove it is still needed.
   - If a restored ready audio output can still miss companion art after server repair, expand `useAiStudioGeneratedOutputMaintenance` narrowly so ready audio outputs with generation identity and missing companion art can reconcile.
   - Prefer server/read-time completeness over client polling.

5. Validate affected surfaces without broad refactors.
   - Media Library modal and embedded library services should receive complete audio rows.
   - Drag/drop and selection payloads should carry companion art because rows are complete.
   - Project reload should hydrate audio outputs with companion-art storage authority and signed URL.
   - Reference Grid, Quick Slot, and Canvas should show audio backgrounds without per-surface patches.

## Forbidden Scope

- Do not add UI placeholders or CSS-only fixes.
- Do not duplicate companion-art lookup in cards, modals, drag handlers, Canvas, Reference Grid, or Quick Slot.
- Do not rewrite the large-project persistence architecture.
- Do not change visual design, layout, interaction behavior, or mobile behavior.
- Do not use Supabase image transformations.
- Do not broaden into unrelated media loading, video posters, signed-url cache, upload admission, admin routes, or account/profile work unless a failing test proves direct dependency.
- Do not touch unrelated dirty worktree files except where required by the implementation and after re-reading current diffs.

## Worktree Warning

At handoff creation time, the worktree had many unrelated modifications, including some overlapping media files such as `frontend/pages/api/media/list.ts` and Media Library tests. The temporary agent must run `git status --short`, inspect diffs before editing touched files, and preserve existing user/agent changes. Do not revert unrelated work.

## Proof Requirements

Minimum local proof before closeout:

- Project restore companion-art regression test passes.
- Media-list companion-art regression test passes.
- Existing media-list API test suite passes.
- Existing project workspace state test suite passes.
- At least one relevant Media Library grid/controller test suite passes if UI-adjacent types or row models change.
- Type check or touched-file type validation passes if TypeScript signatures change.

Suggested commands:

```bash
npm -C frontend run test -- tests/api/media-list.test.ts
npm -C frontend run test -- lib/server/__tests__/projectWorkspaceStatesService.test.ts
npm -C frontend run test -- features/ai-studio/components/__tests__/MediaLibraryMediaGrid.test.tsx features/ai-studio/components/__tests__/MediaLibraryAllItemsGrid.test.tsx features/ai-studio/hooks/__tests__/useMediaLibraryPanelDataController.test.tsx
```

If local proof cannot establish production behavior, close out with the exact unproven boundary instead of claiming production resolution.

## Stop Condition

Stop when the canonical server/read-time authorities reliably return or restore audio companion-art storage/url data for generated audio references, the required regression tests pass, and no consumer-specific patches are needed.

Also stop immediately if:

- the next required change would alter UI/UX behavior,
- the next required change belongs to an unrelated lane,
- active dirty worktree changes make safe editing impossible without user direction,
- production validation, deployment, SQL mutation, or another external operation is required and not explicitly approved,
- the remaining work would be broad architectural churn rather than the narrow companion-art authority fix.

## Work Prompt For Temporary Agent

You are receiving a focused ShortPulse AI Studio handoff. Your job is to fix audio companion/background images disappearing after page refresh or persistent project reload. Work only on the canonical data authorities that hydrate audio media rows and restored project outputs. First read this handoff and the repo startup instructions. Then inspect the current diffs, because the worktree may already contain unrelated or overlapping changes. Add regression tests that reproduce the missing companion-art authority after media-list reload and project workspace restore. Implement the smallest source fix that makes those tests pass without changing UI/UX. Prefer server/read-time hydration completeness over per-component fallbacks. Preserve ownership checks, private storage, signed-original delivery, and the prohibition on Supabase image transformations. Validate with the listed tests and stop at the handoff stop condition.

## Goal Prompt For Temporary Agent

Pursue the goal of completing `docs/records/artifacts/agent/handoffs/2026-06-19-audio-companion-art-persistence-hydration-handoff.md`. Objective: fix the root cause of audio reference background images missing after refresh or persistent project reload by repairing the canonical media-list row projection and project restore hydration authorities, not by adding UI fallbacks. Source of truth: this handoff plus current repo instructions. Scope: generated audio companion-art authority only, including `/api/media/list`, project workspace read convergence, project output display materialization if directly required, and focused tests. Out of scope: visual/UI changes, layout changes, mobile work, unrelated media performance, video poster work, upload/admission rewrites, SQL/deploy work unless a current failing test proves it is essential and the user approves. Start by checking `git status --short` and reading diffs for any file you may touch. Add focused failing coverage for: 1. media-list reload returning signed companion art for audio rows with durable generation/display authority, and 2. project workspace read restore preserving durable audio rows while repairing missing companion-art storage/status from projection/display authority. Implement the smallest canonical fix, validate with `npm -C frontend run test -- tests/api/media-list.test.ts`, `npm -C frontend run test -- lib/server/__tests__/projectWorkspaceStatesService.test.ts`, and the relevant Media Library grid/controller tests if row/UI types change. Stop when tests prove both authorities return complete audio companion-art data and no consumer-specific patches are needed, or stop earlier if safe progress requires production deployment, SQL mutation, user-owned dirty-file resolution, or an out-of-scope architectural change. Close out with completed changes, proof, unproven boundaries, and any exact follow-up.
