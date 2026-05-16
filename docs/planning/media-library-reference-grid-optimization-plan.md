# Media Library + Reference Grid Optimization Plan

Status: draft  
Date: February 12, 2026  
Owners: Frontend + Platform

## Companion docs
- Architecture decision: `docs/adr/0009-media-derivatives-virtualized-grid-autoplay-budget.md`
- Baseline metrics and gates: `docs/planning/media-optimization-phase0-measurement-spec.md`
- Schema and migration design: `docs/planning/media-optimization-schema-and-migration-spec.md`

## Purpose
Define a high-scale architecture that keeps Media Library and AI Studio Reference Grid interactions near-instant as asset counts and file sizes grow, while preserving autoplay video behavior in the Reference Grid.

## Goals
- Keep per-user media browsing fast at 1k-10k assets.
- Preserve Reference Grid video autoplay UX (muted inline looping previews).
- Reduce client memory pressure and render jank from large image/video assets.
- Maintain strict user isolation (private storage + RLS).

## Non-goals
- No code implementation in this document.
- No visual redesign of Media Library or AI Studio layout.
- No change to billing/credit logic.

## Current bottlenecks (from audit)
- Eagerly loading and signing all media rows per view open.
- Rendering unbounded grids without virtualization/paging.
- Autoplaying full source videos in grid cards.
- Converting dropped media to large base64 data URLs in client state.
- Sequential upload/persist loops for multi-file flows.

## Architecture options considered
### Option A: Query/render-only optimization
- Add pagination, lazy signing, and virtualization only.
- Pros: fastest to ship.
- Cons: weak for very large/large-video libraries; decode and bandwidth costs remain high.

### Option B: Derivatives only, minimal UI refactor
- Generate thumbnails/posters/previews but keep existing list/render flow mostly intact.
- Pros: strong media decode/network gains.
- Cons: still leaves state/render bottlenecks from unbounded lists.

### Option C: Full tiered media delivery + virtualized UI + adaptive autoplay (Selected)
- Combine derivative pipeline, paged querying, lazy URL signing, virtualization, and playback budget control.
- Pros: best sustained performance and user-perceived speed at scale.
- Cons: highest upfront complexity and migration effort.

## Selected approach
Adopt Option C with staged rollout:
1. Data plane: add derivative variants and variant metadata.
2. Read path: cursor-based paging + minimal-column queries + lazy/batched signing.
3. Render path: virtualized grid and staged media hydration.
4. Playback path: autoplay preserved using lightweight preview variants and viewport budgeting.

## Target UX and SLOs
- Media Library first visible content: <= 700ms after route paint (warm session, median network).
- AI Studio modal open-to-first-grid-content: <= 500ms.
- Reference Grid scroll: >= 55 FPS on modern laptops with 500+ cards loaded virtually.
- Card media paint for visible viewport set: <= 1.2s for first 30 visible cards.
- Reference selection action (modal pick -> card inserted): <= 150ms UI response.

## Formal system design
### 1) Media asset model
Keep `media_files` as canonical asset record. Add variant records for delivery optimization.

Proposed new table: `media_asset_variants`
- `id` uuid pk
- `media_file_id` uuid fk -> `media_files.id`
- `variant_kind` text (`thumb_240`, `thumb_480`, `poster_720`, `preview_loop_360p`, `playback_720p`, `original`)
- `storage_path` text
- `mime_type` text
- `width` int nullable
- `height` int nullable
- `duration_seconds` numeric nullable
- `byte_size` bigint nullable
- `status` text (`pending`, `ready`, `failed`)
- `created_at` timestamptz
- `updated_at` timestamptz

Index strategy:
- `(media_file_id, variant_kind, status)`
- `(variant_kind, status, updated_at desc)`

### 2) Upload + ingest pipeline
For each upload:
1. Store original asset in private bucket.
2. Insert `media_files` row with `processing_status`.
3. Queue derivative jobs (image thumb set, video poster + preview loop + playback ladder).
4. Persist variants in `media_asset_variants`.
5. Mark original record ready when required variants are ready.

Processing tiers:
- Required for listing: `thumb_240` (images), `poster_720` + `preview_loop_360p` (videos).
- Optional enhanced: `thumb_480`, `playback_720p`.

Fallback rules:
- If derivative missing, render placeholder and retry poll.
- If preview loop fails, use poster-only card and keep modal playback functional.

### 3) Query + retrieval design
Use cursor pagination (not full-table load), with tab-filtered server query shape:
- Cursor: `(created_at desc, id desc)` for stable paging.
- Page sizes:
  - Media Library route: 60
  - AI Studio media modal: 36
  - Prefetch next page when scroll reaches 70% of current window.
- Return only listing fields:
  - `id, filename, file_type, source, created_at, primary_variant_paths, dimensions_hint`

Signing strategy:
- Sign only visible-window + small prefetch buffer.
- Batch sign variant paths per page.
- Reuse signed URLs from in-memory LRU cache keyed by `(storage_path, expires_at_bucket)`.

### 4) Render architecture
Adopt virtualized grid rendering for:
- `legacy standalone Media Library page`
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- `frontend/features/ai-studio/components/ReferenceCanvas.tsx`

Render phases:
1. Skeleton card shell.
2. Poster/thumb hydration.
3. Video preview autoplay hydration when viewport-qualified.

State constraints:
- Cap active in-memory reference outputs by windowed rendering (not full DOM list).
- Replace base64 data URL ingestion for large dropped files with object URL strategy and explicit lifecycle cleanup.

### 5) Reference Grid autoplay strategy (required UX)
Autoplay remains enabled, but controlled:
- Card autoplay source is `preview_loop_360p` derivative, not original full asset.
- Playback starts only when card is viewport-visible (IntersectionObserver threshold >= 0.6).
- Global decode budget:
  - Max simultaneous autoplay videos: 4 (desktop), 2 (small screens).
- Offscreen cards:
  - Pause and detach source (`src=""`) after short idle delay to free decoders/memory.
- On select/open detail:
  - Switch to `playback_720p` (or original if missing).

This preserves autoplay UX while preventing decode storms.

### 6) Caching layers
- L1 memory: signed URL LRU (short TTL aware).
- L2 IndexedDB (optional phase): variant manifest cache by `media_file_id + updated_at`.
- Query cache: SWR/React cache for paged list data.

Cache invalidation:
- On upload/delete/rename, invalidate affected pages and manifest entries.
- On signed URL expiry, lazy re-sign per card (already visible behavior), not full list refresh.

### 7) Resilience and security
- Keep bucket private and user-scoped paths under `auth.uid()`.
- Preserve RLS model (`user_id = auth.uid()`).
- Never expose service role in client.
- All optimization surfaces must preserve existing auth boundaries.

### 8) Observability and performance telemetry
Track metrics for:
- Query latency per page load.
- Signed URL batch time and refresh failures.
- Time-to-first-card, time-to-first-media-paint.
- Scroll FPS/jank long tasks.
- Video autoplay start success rate and decode errors.

Log dimensions:
- tab, page size, asset type mix, viewport type, network class.

## Implementation phases
### Phase 0: Baseline + instrumentation
- Add measurement hooks and baseline dashboards.
- Define pass/fail thresholds for each SLO.

### Phase 1: Read-path hardening
- Cursor pagination, lazy tab load, batched lazy signing.
- Keep existing UI behavior with minimal UX delta.

### Phase 2: Virtualized rendering
- Introduce virtualized grids and staged hydration.
- Remove unbounded full-list DOM rendering.

### Phase 3: Derivative pipeline
- Add `media_asset_variants` and background generation flow.
- Migrate listing cards to derivative-first delivery.

### Phase 4: Autoplay budget engine
- IntersectionObserver + playback concurrency caps.
- Preview-loop autoplay in Reference Grid with fallback handling.

### Phase 5: Backfill + rollout gates
- Backfill derivatives for existing library media.
- Progressive rollout with feature flags and rollback switches.

## Risks and mitigations
- Derivative job backlog:
  - Mitigation: required vs optional variants, queue prioritization by recency.
- URL signing overhead under burst:
  - Mitigation: batched signing + per-page caches.
- Autoplay regressions on low-end devices:
  - Mitigation: dynamic budget reduction and poster-only fallback.
- Complexity creep:
  - Mitigation: phased delivery with explicit exit criteria per phase.

## ADR and governance follow-ups
- Before implementation, add an ADR for this architecture decision and any new processing/runtime components.
- On schema changes, update:
  - `docs/supabase_full_schema.sql`
  - `docs/data-dictionary.md`
  - `docs/security-checklist.md`
- Update SOPs for media library and AI Studio reference flows once shipped.

## Open decisions to lock before build
- Derivative generation runtime choice (Supabase Edge function orchestration vs external worker service).
- Exact variant set and bitrate/resolution ladder.
- Signed URL TTL policy for listing variants vs detail playback variants.
- Desktop/mobile autoplay budget defaults.
