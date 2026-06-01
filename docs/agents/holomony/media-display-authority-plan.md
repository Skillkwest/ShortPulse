# Holomony Media Display Authority Plan

Status: local implementation checkpoint complete; production-facing proof pending after deploy

Last audited: 2026-06-01

Purpose: define the final canonical route for ShortPulse media display and media-performance ownership across Holomony-owned surfaces. This plan exists to prevent patchwork fixes, duplicate media paths, stale fallback routes, and hidden regressions in signed-in media surfaces.

Current checkpoint: local code now separates grid preview authority from explicit full-authority consumers, keeps generated cards interactive when renderable media already exists, routes internal Canvas image drops through active durable card authority, rejects Supabase render-image URLs in media-grid previews, and keeps preview repair out of valid first-paint signing. Production URL validation remains the final stop gate after deployment.

## Done Criteria

This lane is done when the owned product surfaces use one clear media authority route:

- card/grid/carriage surfaces render from canonical preview or poster-preview authority;
- the global right-rail Canvas resolves media from durable output/media authority, not transient drag URLs when durable authority exists;
- detail and preview modals resolve full/original media on explicit open, without flickering through false unavailable states;
- Quick Slot Inventory persists newly inserted durable media through project restore;
- hot-path repair, legacy fallback, and Supabase image transformation routes are not used for normal media display;
- focused tests and production-facing checks prove the route across the owned surfaces.

## In Scope

Holomony owns media display, performance, and media-authority correctness for:

- AI Studio `Reference Grid`;
- AI Studio `Quick Slot Inventory`;
- AI Studio global right-rail `Canvas` media display, drop routing, and durable restore trust;
- AI Studio `DetailModal` for Reference Grid and Quick Slot outputs;
- AI Studio main `Libraries -> Media` panel grids;
- Character panel media-library carriage grids;
- Elements panel media-library carriage grids;
- Media Library preview modal opened by media-grid double-clicks.

## Out Of Scope

Do not expand this lane into:

- Media Library custom-folder canvas. It is not an active target and should eventually be removed rather than optimized.
- Generic Canvas editing, viewport, selection, text editing, shape editing, or non-media UX.
- Character assignment semantics or `character_media_assets` persistence rules when media display is correct.
- Elements workflow/profile semantics when media display is correct.
- Provider generation quality, auth outages, billing, deployment incidents, or storage outages beyond diagnosis and handoff.
- The dead standalone `/media-library` route.

## Source Of Truth

Use the repo contracts and owner code paths in this order:

1. Root repo rules in `AGENTS.md`, especially no parallel routes, no fallback systems, and no Supabase image transformations.
2. Holomony startup and scope rules in `docs/agents/holomony/AGENTS.md`.
3. Right-rail routing and ownership in `docs/agents/holomony/right-rail-command-index.md`.
4. Media-grid and modal ownership in `docs/agents/holomony/media-display-command-index.md`.
5. Current claim state in `docs/agents/holomony/media-display-authority-ledger.md`.
6. The exact owner code path named by the command index for the surface being changed.

If the docs and code disagree, treat code plus current production evidence as the decision source, then update the doc that became stale.

## Canonical Media Authority Contract

There are four authority levels. Do not blur them.

### Grid Preview Authority

Reference Grid cards, Quick Slot cards, main Media Library grids, Character media carriages, and Elements media carriages use preview authority only:

- image previews use canonical preview storage when available;
- video cards use poster preview for still display and bounded video behavior where explicitly supported;
- audio cards use audio-specific preview/display authority;
- full/original paths are not normal grid-display fallbacks;
- missing preview authority should fail visibly and deterministically, not silently pull in unrelated full/result routes.

### Canvas Display Authority

The global right-rail Canvas is not a thumbnail grid. Canvas may need display-grade media, but it must still resolve from durable output/media authority:

- internal drops should carry `outputId` and `mediaId` when available;
- Canvas should prefer durable storage-backed authority over transient provider, `blob:`, or drag payload URLs;
- project persistence should keep durable scene identity and reject non-durable media sources;
- generic Canvas editing behavior remains governed by Canvas contracts and tests.

### Detail And Preview Modal Authority

Detail and preview modals are explicit full-authority consumers:

- Reference Grid and Quick Slot double-clicks open `DetailModal`;
- Media Library, Character carriage, and Elements carriage double-clicks open the Media Library preview modal;
- modals resolve full/original media on demand;
- modal loading states must not flash false "media unavailable" while full authority is still resolving;
- modal recovery must not reintroduce Supabase image transformations.

### Persistence Authority

Durability comes from stable IDs and storage paths, not transient display URLs:

- Quick Slot uses durable output identity and curated reference IDs;
- saved/library media uses `savedMediaIds`, preview storage path, full storage path, and media row identity where applicable;
- Canvas persists durable scene items and cameras only;
- non-durable `blob:` and `data:` sources are not valid project-restore authority.

## Forbidden Routes

Do not introduce or preserve these as normal display behavior:

- Supabase `/storage/v1/render/image/` URLs;
- signed transform URLs;
- provider/result URL fallback as the normal card-grid route when preview storage exists or is expected;
- hot-path repair calls that block valid media first paint;
- workflow-local forks of Reference Grid, Quick Slot, Canvas, or media-grid display state;
- compatibility paths without an owner, proof, and removal condition.

## Implementation Sequence

1. Finish Reference Grid card-preview canonicalization.
   - Card grids sign and render preview/poster-preview authority only.
   - Tests should reject full/result fallback expectations in the card path.
   - Full authority remains available only for explicit detail/download consumers.

2. Add the global Canvas media-authority route.
   - Drops from Reference Grid and Quick Slot resolve durable output/media display authority.
   - Canvas persistence keeps durable identity and rejects non-durable restore sources.
   - Tests cover internal drops, file drops, and project restore for media items.

3. Harden the shared Media Library grid lane.
   - Main Media Library, Character carriage, and Elements carriage share one `MediaLibraryMediaGrid` / `MediaLibraryAllItemsGrid` preview resolver contract.
   - Grid/card display rejects Supabase render-image URLs.
   - Preview repair cannot block valid first paint.

4. Harden modal full-authority lanes.
   - `DetailModal` resolves full/original media for Reference Grid and Quick Slot.
   - Media Library preview modal resolves full/original media for main Media Library, Character carriage, and Elements carriage.
   - Loading/error states avoid flicker between valid media and false unavailable states.

5. Prove Quick Slot persistence.
   - Newly inserted media remains in Quick Slot after project restore when durable output/media authority exists.
   - If persistence fails outside media authority, stop media edits and hand off with evidence.

6. Retire hot-path repair/fallback behavior.
   - Repair can remain only as explicit maintenance or data-integrity tooling until removal.
   - Normal display routes must not depend on repair endpoints to show valid media.

7. Add surface inventory regression guards.
   - Tests or assertions prove every owned active surface uses the canonical route.
   - Deprecated Media Library custom-folder canvas stays outside the active performance route.

## Proof Before Stopping

Use the narrowest proof that covers the changed surfaces:

- Reference Grid / Quick Slot: `npm run test -- useReferenceGridSignedStorageUrlController useReferenceGridResolvedMediaController ReferenceGridCard ReferenceGrid.curated referenceProjections referenceDomain useReferenceGridOutputCollections useReferenceGridOutputViewModels`
- Canvas: `npm run test -- canvas useAiStudioPageMediaReferenceRuntime useAiStudioPageProjectSessionRuntime sessionSnapshotCanvas`
- Media grids and carriages: `npm run test -- MediaLibraryMediaGrid MediaLibraryAllItemsGrid MediaLibraryPanel EmbeddedMediaLibraryPanel CharacterEmbeddedMediaLibraryPanel ElementsEmbeddedMediaLibraryPanel mediaLibraryAdaptivePreview useMediaPreviewSigningController`
- Modals: `npm run test -- DetailModal.fullQuality MediaLibraryPanelPreviewModal`
- Docs/tooling after Holomony doc edits: `npm -C frontend run docs:check`, `bash scripts/ops/holomony/holomony_folder_audit.sh`, and `bash scripts/ops/holomony/holomony_media_display_command_map.sh` when those scripts are relevant to the changed doc paths.

Local tests prove code contracts. Production-facing behavior is not proven until `https://www.shortpulse.ai` shows media rendering without blank placeholders/flicker in the owned signed-in surfaces.

## Stop Condition

Stop this lane when:

- each owned active surface has one canonical route for its media authority level;
- tests cover the route at the owner boundaries;
- production-facing checks show no blank media, no flicker, no missing Quick Slot persistence for newly inserted media, and no transform/repair hot-path regression;
- remaining work would be deletion cleanup, broad refactor, or non-media domain ownership.

If any source problem traces to project persistence, auth, storage outage, provider output, or caller semantics outside media display, stop media edits and create a handoff with exact evidence.
