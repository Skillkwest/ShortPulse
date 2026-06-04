# Holomony Media Display Regression Source Fix Plan

## Status And Stop Condition

Status: planning complete, implementation not started.

This document is the planning artifact for the active media-display regression cluster. It is code-backed by current source inspection on the local `production` branch and does not claim production readiness. No runtime code has been changed as part of this planning pass.

Stop condition for this planning lane: stop once this document exists and names the smallest canonical implementation route, owner files, proof, and handoff boundaries. Implementation begins only after explicit user approval.

## Current Symptoms

- Reference Grid and Quick Slot cards sometimes render blank placeholders or stuck spinners.
- Double-clicking visible media can open `DetailModal` with generic/default metadata and `Media unavailable`.
- Video cards can display in grids but break or spin when opened in detail.
- Dragging Reference Grid or Quick Slot media into Canvas can fail even when durable media exists, especially before signed display URLs are resolved in card state.
- Media Library grids can load visibly slowly or show blank cells while preview signing catches up.

## Source Of Truth

Current repo source controls this plan. Historical handoffs, retained reports, and older chat context are advisory only.

Primary instruction and ownership sources:

- `AGENTS.md`
- `docs/agents/holomony/AGENTS.md`
- `docs/agents/holomony/memory.md`
- `docs/agents/holomony/right-rail-command-index.md`
- `docs/agents/holomony/media-display-command-index.md`

Primary source files audited:

- `frontend/features/ai-studio/logic/referenceGridMedia.ts`
- `frontend/features/ai-studio/logic/referenceOutputAuthority.ts`
- `frontend/features/ai-studio/components/detail-modal/detailModalPreviewAuthority.ts`
- `frontend/features/ai-studio/components/DetailModal.tsx`
- `frontend/features/ai-studio/components/detail-modal/SharedMediaDetailPreviewMedia.tsx`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridImageHydrationController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridHydrationQueueController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardItemsController.ts`
- `frontend/features/ai-studio/reference-grid/logic/referenceGridCardVisualState.ts`
- `frontend/features/ai-studio/reference-grid/logic/referenceGridLoadingState.ts`
- `frontend/features/ai-studio/reference-projections/projections.ts`
- `frontend/features/ai-studio/hooks/useAiStudioReferenceGridProps.ts`
- `frontend/features/ai-studio/hooks/useAiStudioPageMediaReferenceRuntime.ts`
- `frontend/features/ai-studio/components/canvas/useCanvasViewportDropHandlers.ts`
- `frontend/features/ai-studio/components/canvas/canvasDropController.ts`
- `frontend/features/ai-studio/logic/canvasMediaDisplayAuthority.ts`
- `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`
- `frontend/features/media-library/hooks/useMediaSurfacePreviewSigning.ts`
- `frontend/features/media-library/logic/mediaPreviewSigningPass.ts`
- `frontend/features/media-library/logic/mediaPreviewSigningBatch.ts`
- `frontend/features/media-library/runtime/surfaceConfig.ts`
- `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
- `frontend/features/ai-studio/components/EmbeddedMediaLibraryPanel.tsx`
- `frontend/features/ai-studio/components/media-library-modal/MediaLibraryMediaGrid.tsx`
- `frontend/features/ai-studio/components/media-library-modal/MediaLibraryAllItemsGrid.tsx`
- `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPanelPreviewModal.tsx`

## Root Cause Findings

1. Quick Slot hydration can be scheduled from curated cards while hydration validity is still anchored to `allOutputIds`.
   - `useReferenceGridRuntimeScaffold.ts` passes `validOutputIds: allOutputIds` into `useReferenceGridPreviewRuntime`.
   - `useReferenceGridHydrationQueueController.ts` schedules hydration from `curatedVisibleCardItems`, `visibleCardItems`, `nearViewportCuratedOutputs`, and `nearViewportOutputs`.
   - `useReferenceGridImageHydrationController.ts` prunes queued, inflight, pending, hydrated, and cached hydration work against the supplied `validOutputIds`.
   - `selectVisibleAllRefsProjection` can omit IDs that are still legitimate Quick Slot items. The valid hydration authority should be the visible media ownership union, not All Refs alone.

2. Video media authority is not consistently separated into poster/thumbnail display versus playable media.
   - `referenceGridMedia.ts` resolves generic `previewUrl` and `fullUrl` pairs, but its pick type does not include `previewPosterUrl` or `previewPosterStoragePath`.
   - `DetailModal.tsx` builds one preview candidate list and then infers media kind from the winning URL.
   - `SharedMediaDetailPreviewMedia.tsx` receives a single `mediaUrl` plus `mediaKind`; if the selected URL is a poster, the video renderer gets a non-playable image URL.
   - `canvasMediaDisplayAuthority.ts` separates Media Library video `mediaUrl` and `posterUrl`, but Reference Grid/Quick Slot internal Canvas drops still use `resolveCanvasResolutionFromOutput`, which chooses `resultUrls[0]`, `previewUrl`, or fallback for video before durable storage signing.

3. DetailModal candidate selection is too generic for video and audio authority.
   - `detailModalPreviewAuthority.ts` resolves canonical authority through `resolveReferenceDownloadTarget`, signs the storage path with preview profile `none`, and returns one URL with image-oriented full-quality validation naming.
   - `DetailModal.tsx` mixes `resolvedCanonicalPreviewUrl`, `preferredDetailMediaUrl`, `resolvedDetailMedia.previewUrl`, `output.previewUrl`, and `resultUrls` into one ordered list.
   - The modal must instead receive a kind-aware authority result: image display URL, video playable URL, video poster URL, audio playable URL, and unavailable reason.

4. Reference Grid loading can prefer task-state loading over durable media display truth.
   - `referenceGridCardVisualState.ts` treats `pending` and `running` as generation loading unless it sees generated media as loaded.
   - The current generated-media loaded check depends on card preview and image source/loading state. A durable storage path or saved media identity can exist while signed preview/hydration is still catching up.
   - The visual state should classify durable media authority as display-resolving or media-hydrating, not as generation still running, once storage or saved-media identity exists.

5. Canvas internal drops rely too much on already-populated URL fields.
   - `resolveCanvasDropReference` in `useAiStudioPageMediaReferenceRuntime.ts` is synchronous and immediately resolves from `getOutputById`.
   - `resolveCanvasResolutionFromOutput` picks URL fields from the output and payload fallback. For videos, this can miss durable `fullStoragePath` until a signed URL has already landed elsewhere.
   - `useCanvasViewportDropHandlers.ts` already supports async preparation through `prepareResolvedInternalCanvasDrop`, but the page runtime does not currently use that hook to resolve durable authority for internal Reference Grid/Quick Slot drops.

6. Media Library visible-cell signing is centralized but mixed All Media may be too conservative for first paint.
   - `MediaLibraryPanel.tsx` and `EmbeddedMediaLibraryPanel.tsx` both use `resolvePanelMixedAllMediaSignBudget` for `itemType === "all"`.
   - That override clamps to `initialSignLimit: 2`, `prefetchWindow: 3`, and `signBatchSize: 2`.
   - `useMediaPreviewSigningController.ts` prioritizes visible IDs, but if the visible set has more than two initial mixed rows, first visible cells can remain blank while follow-up passes drain.

## Canonical Media Authority Contract

Implement one shared authority contract before surface-specific fixes. The contract should live in the existing AI Studio media authority layer rather than a new route or fallback system.

Preferred owner path:

- Extend `frontend/features/ai-studio/logic/referenceGridMedia.ts` with a `resolveStudioOutputMediaDisplayAuthority` helper, or split only if file size requires it into an adjacent `frontend/features/ai-studio/logic/referenceMediaDisplayAuthority.ts` that replaces callers immediately.
- Reuse `frontend/features/ai-studio/logic/referenceOutputAuthority.ts` for durable identity classification.
- Reuse `frontend/features/ai-studio/components/detail-modal/detailModalPreviewAuthority.ts` only for detail-modal signing and candidate rejection, after making it consume the shared authority result.
- Reuse `frontend/features/ai-studio/logic/canvasMediaDisplayAuthority.ts` for Canvas display authority, extending it to support `StudioOutput` as well as Media Library payloads if that keeps Canvas logic centralized.
- Reuse `frontend/lib/mediaPreviewPath.ts`, `frontend/lib/mediaSignedUrlCache.ts`, and existing preview trust guards. Do not use Supabase image transformations.

The contract must expose these distinct fields:

- `mediaIdentity`: output id, saved media id when present, generation id/task id when present, storage paths, and media kind.
- `thumbnailPreviewUrl`: image-card thumbnail or compact still preview only. This may be `/_next/image` or a signed preview/original where allowed, but it is never full-detail authority.
- `posterPreviewUrl`: video poster/still preview only. This must never be passed as video `src`.
- `playableMediaUrl`: video or audio playable URL only. For video/audio, prefer signed durable full/original storage, then trusted direct playable URLs. Do not choose poster/thumbnail candidates here.
- `fullMediaUrl`: detail/download/original image authority or playable original for video/audio. This must reject Supabase render-image URLs and must not use `/_next/image` as final modal authority.
- `cardDisplayUrl`: grid/card display URL derived from thumbnail/poster/playable rules by media kind.
- `unavailableReason`: structured reason such as `waiting_for_signing`, `missing_storage_authority`, `upstream_generation_pending`, `storage_resolve_failed`, or `unsupported_media_kind`.
- `authorityTier`: existing `preview-only`, `tracked`, or `reusable`, plus whether the result is `durable`, `direct`, or `temporary`.

Surface rules:

- Reference Grid cards use `cardDisplayUrl`; video cards use `posterPreviewUrl` for still display and only attach/play `playableMediaUrl`.
- Quick Slot uses the same authority as Reference Grid, with `mediaSurface: "quick-slot"` for preview quality and hydration decisions.
- `DetailModal` uses `fullMediaUrl` for images, `playableMediaUrl` plus `posterPreviewUrl` for videos, and `playableMediaUrl` for audio.
- Canvas internal drops use durable `playableMediaUrl`/`fullMediaUrl`/`cardDisplayUrl` resolved during drop preparation, not stale card-render URLs.
- Media Library grids keep their existing row-based preview signing path, but mixed All Media signing must guarantee the first visible row set gets signing priority before deferred/offscreen work.
- Media Library preview modal uses the existing selection controller, but its video preview/full promotion must preserve the same poster versus playable split.

## Implementation Sequence

1. Add the shared `StudioOutput` media authority helper.
   - Owner files: `referenceGridMedia.ts`, `referenceOutputAuthority.ts`, `detailModalPreviewAuthority.ts` as needed.
   - Inputs: `StudioOutput` delivery fields, signed storage map when available, optional async signer for durable storage, `surface`, `projectId`, and force-refresh flag.
   - Outputs: the canonical contract above.
   - Smallest acceptable implementation: one sync resolver for already-available card authority plus one async resolver for durable detail/Canvas signing, both sharing candidate ordering and media-kind rules.

2. Fix Reference Grid and Quick Slot hydration validity.
   - Owner files: `useReferenceGridRuntimeScaffold.ts`, `useReferenceGridPreviewRuntime.ts`, `useReferenceGridImageHydrationController.ts`, `useReferenceGridHydrationQueueController.ts`.
   - Change `validOutputIds` from All Refs-only authority to the union of `allOutputIds`, `curatedOutputIds`, and `activeOutputId` when present.
   - Keep `pruneHydrationQueueToCandidateIds` candidate-scoped, but ensure candidate pruning never invalidates still-visible Quick Slot hydration just because the card is absent from All Refs.
   - Add focused tests proving a Quick Slot-only/suppressed-from-All-Refs image can enqueue, finalize, and remain hydrated.

3. Make Reference Grid card visual loading media-authority-aware.
   - Owner files: `referenceGridCardVisualState.ts`, `referenceGridLoadingState.ts`, `useReferenceGridCardItemsController.ts`.
   - Treat durable media authority (`previewStoragePath`, `fullStoragePath`, or saved media id) as media display resolving/hydrating rather than generation pending/running.
   - Keep true provider pending/running spinners only when there is no renderable or durable media authority yet.
   - Preserve local video persistence loading for blob/data videos without durable storage.

4. Make DetailModal consume kind-aware authority.
   - Owner files: `DetailModal.tsx`, `detailModalPreviewAuthority.ts`, `SharedMediaDetailPreviewMedia.tsx`, `studioOutputDetailModal.ts`.
   - Replace the generic candidate list for media rendering with the shared authority result.
   - For video, pass `playableMediaUrl` to the video `src` and `posterPreviewUrl` to a new or existing poster prop. Do not feed poster/image candidates to `mediaUrl` when `mediaKind === "video"`.
   - Preserve image full-quality promotion, rejected-candidate retry, refresh-on-error, action availability, prompt editing, delete, and save/download behavior.
   - Keep metadata source as the selected `StudioOutput`; do not create generic/default detail items when an output id still resolves.

5. Resolve Canvas internal drops through durable media authority at preparation time.
   - Owner files: `useAiStudioPageMediaReferenceRuntime.ts`, `canvasMediaDisplayAuthority.ts`, `useCanvasViewportDropHandlers.ts`, canvas tests.
   - Keep `resolveCanvasDropReference` as a quick identity-to-resolution pass if needed, but add/use `prepareResolvedInternalCanvasDrop` to asynchronously sign durable storage before insertion.
   - For videos, resolve `playableMediaUrl` from `fullStoragePath` or saved media identity and `posterPreviewUrl` separately.
   - For images, resolve `fullMediaUrl` or `cardDisplayUrl` by authority tier, preferring durable display URLs over payload fallback.
   - For audio, resolve playable media from durable full/original or trusted direct audio URL.
   - If durable authority resolution fails, return `null` and log/handoff with the existing unresolved internal drop path rather than inserting a broken item.

6. Tune Media Library mixed All Media first-visible signing.
   - Owner files: `surfaceConfig.ts`, `useMediaPreviewSigningController.ts`, `mediaPreviewSigningPass.ts`, `MediaLibraryPanel.tsx`, `EmbeddedMediaLibraryPanel.tsx`.
   - Keep the visible-scoped signing model for panel, Elements, and Character carriages.
   - Adjust `resolvePanelMixedAllMediaSignBudget` or `resolveMediaSignQueuePass` so the initial urgent batch covers the first visible ID set, bounded by panel column count, before deferred prefetch.
   - Preserve the current guard that panel/carriage surfaces do not run broad offscreen prefetch drains.
   - Do not add per-grid signing logic to `MediaLibraryMediaGrid` or `MediaLibraryAllItemsGrid`.

7. Align Media Library preview modal with the same media-kind authority.
   - Owner files: `useMediaLibraryPanelSelectionController.ts`, `MediaLibraryPanelPreviewModal.tsx`, `mediaPreviewResolver.ts`.
   - Preserve fast-open behavior from the current card preview.
   - Promote videos to signed playable original/full media while retaining poster preview separately.
   - Preserve full-original image promotion and error recovery.

## Regression Tests And Proof

Required local implementation tests:

- `npm run test -- useReferenceGridImageHydrationController useReferenceGridHydrationQueueController useReferenceGridCardItemsController referenceGridCardVisualState`
- `npm run test -- ReferenceGrid.curated useAiStudioReferenceGridProps useReferenceGridResolvedMediaController`
- `npm run test -- referenceGridMedia referenceOutputAuthority DetailModal DetailModal.fullQuality`
- `npm run test -- useAiStudioPageMediaReferenceRuntime canvas canvasDropController`
- `npm run test -- useMediaPreviewSigningController mediaPreviewSigningPass MediaLibraryPanel MediaLibraryMediaGrid MediaLibraryAllItemsGrid`
- `npm run test -- MediaLibraryPanelPreviewModal ElementsPanelSplitHost CharacterPanelSplitHost CharacterEmbeddedMediaLibraryPanel`
- `npm run test:adaptive-media-runtime`

Specific cases to add or update:

- Quick Slot-only image item that is removed from All Refs still hydrates and does not get pruned before decode finalization.
- Quick Slot and All Refs duplicate-visible item hydrates once using the preferred Quick Slot surface and does not leave All Refs stuck loading.
- Generated output with durable storage and stale `pending`/`running` task state displays media-resolving or hydrated state instead of generation spinner.
- Video output with poster and full video storage renders poster on card, plays signed full video in DetailModal, and never passes poster URL as video `src`.
- DetailModal opened from Reference Grid/Quick Slot retains selected output metadata and does not fall back to generic/default item when output id resolves.
- Canvas internal Reference Grid/Quick Slot drop with durable `fullStoragePath` but no signed URL resolves via drop preparation and inserts the correct image/video/audio item.
- Canvas video drop uses signed playable video URL and separate poster URL.
- Media Library mixed All Media panel signs all first visible cells before deferred/offscreen work.
- Elements and Character embedded carriages receive the shared signing behavior without caller-domain assignment changes.
- Media Library preview modal opens quickly on card preview, then promotes image/video/audio to correct full/playable authority.
- No runtime path emits Supabase `/storage/v1/render/image/`, no `createSignedUrl` transform options are introduced, and `/_next/image` is never final full-quality modal authority.

Proof required before implementation can be considered complete:

- Local targeted tests above pass.
- `npm -C frontend run docs:check` passes if implementation changes docs.
- `bash scripts/ops/holomony/holomony_media_display_command_map.sh` still passes after owner-path changes.
- Production URL proof is required before any launch-readiness claim, but this plan does not include or claim production proof.

## Out Of Scope And Handoff Boundaries

Out of scope for this implementation plan:

- No code changes during this planning lane.
- No Media Library custom-folder Canvas work.
- No generic Canvas editing, viewport, shape, text, selection, camera, or non-media UX changes.
- No project persistence implementation beyond identifying where Canvas media authority should be handed off.
- No broad refactor of AI Studio output state, generation recovery, or project workspace restore.
- No new routes, duplicate display paths, legacy fallback systems, or workflow-local media state forks.

Handoff triggers:

- Persistence owner handoff if `curatedReferenceIds`, output restore, or project snapshots fail to preserve the correct output ids before Reference Grid renders.
- Auth/storage owner handoff if signed URLs fail because the user session, Supabase permissions, storage object, or media row is unavailable.
- Provider/generation owner handoff if no durable output, saved media id, storage path, result URL, or generation publication exists for a completed generation.
- Character owner handoff if Character carriage failures involve assignment semantics, `character_media_assets`, look identity, or persistence rules rather than shared media display.
- Elements owner handoff if Elements carriage failures involve profile/workflow semantics rather than shared media display or preview modal behavior.
- Canvas owner handoff if the failure is generic editing, text, shape, camera, selection, or viewport behavior rather than media display, media drop routing, or restore trust.

Each handoff must include the exact output/media id, source surface, candidate URLs/storage paths checked, whether signing was attempted, and the failing owner boundary.

## Risks And Non-Regression Contracts

- Do not weaken detail-modal full-quality image authority to make card previews faster.
- Do not solve video modal errors by showing a poster in the video renderer.
- Do not treat `/_next/image` as final full/original modal authority.
- Do not reintroduce Supabase image transformations or `createSignedUrl` transform options.
- Do not insert Canvas items from temporary `blob:` or `data:` media when durable authority is available but not signed yet.
- Do not fork Reference Grid, Quick Slot, Canvas, Media Library panel, Character carriage, or Elements carriage into workflow-local media state.
- Do not add one-off per-surface resolvers when a shared media authority rule should own candidate ordering.
- Do not hide storage/auth/provider failures behind silent fallback; expose handoff evidence instead.
- Preserve Generate CTA behavior, prompt editing, delete actions, save/download actions, existing media-library selection behavior, and non-media Canvas interactions.
- Keep Media Library signing bounded: first visible cells get priority, but panel/carriage surfaces must not broad-prefetch the whole library.

## Planning Rules

- Current source wins over prior plans, old handoffs, retained reports, and chat memory.
- Implement shared media authority first, then adapt surfaces to consume it.
- If two surfaces need the same candidate-ordering rule, change the shared rule before changing either surface.
- Every implementation step must directly reduce the active bug cluster.
- If a step only improves architecture without reducing the current failures, mark it out of scope.
- If proof shows persistence, auth, storage outage, provider output, or caller-domain semantics are the root source, stop Holomony implementation at the handoff boundary and provide evidence.
- Stop after the planned implementation and required proof complete; do not continue by nearby cleanup or additional media work.
