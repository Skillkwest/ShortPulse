# SOP: Media Performance Operations

## Purpose
Operate and troubleshoot Media Library and AI Studio Reference Grid performance under large media volumes while preserving UX requirements (including inline video autoplay in Reference Grid).

## Scope
- In scope:
  - Media Library route (`/media-library`) and AI Studio Media Library modal.
  - Reference Grid autoplay performance controls.
  - Signed URL hydration and batch signing behavior.
  - Local telemetry inspection for tuning and incident triage.
- Out of scope:
  - Provider model latency and generation queue incidents (see provider SOPs).
  - Schema/backfill design decisions (see ADRs and planning specs).

## Key Components
- Client signing/cache:
  - `frontend/lib/mediaSignedUrlCache.ts`
- Batch signing API:
  - `frontend/pages/api/media/sign-batch.ts`
- Media Library route:
  - `frontend/pages/media-library.tsx`
- AI Studio Media Library modal:
  - `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- Reference Grid autoplay budget:
  - `frontend/features/ai-studio/components/ReferenceCanvas.tsx`
- Reference Grid archive + output lifecycle controls:
  - `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- Upload preview ingestion path:
  - `frontend/features/ai-studio/logic/stateParsers.ts`
- Telemetry buffer + debug handle:
  - `frontend/lib/mediaPerfTelemetry.ts`
  - initialized via `frontend/pages/_app.tsx`

## Prerequisites
- User can authenticate in-app (bearer token required for `/api/media/sign-batch`).
- Supabase storage bucket is private and user-scoped path rules are active.
- Variant/backfill migrations are applied where required:
  - `sql/migrations/005_add_media_processing_and_variants.sql`
  - `sql/migrations/006_backfill_media_variant_hints.sql`
  - `sql/migrations/007_harden_media_source_and_usage_rpc.sql`

## Operational Workflow

### 1) Validate Baseline Path
1. Open Media Library route and AI Studio modal.
2. Confirm media cards render quickly with placeholders first, then preview hydration.
3. Confirm pagination/search remains responsive with large tabs.

### 2) Validate Batch Signing Contract
1. Open browser network tab while loading media grids.
2. Confirm `POST /api/media/sign-batch` is called during lazy-sign passes.
3. Confirm response status is `200` and payload contains:
   - `urls: { "<storage_path>": "<signed_url>|null" }`
4. Confirm failed entries degrade to placeholder (not a blocking error state).

### 3) Validate Reference Grid Autoplay Budget
1. Open AI Studio with multiple visible video cards.
2. Confirm autoplay is viewport-gated and bounded.
3. Confirm on constrained conditions (`saveData`, low memory, very slow network) autoplay budget reduces.
4. Confirm offscreen cards pause/detach according to configured delay.

### 4) Validate Usage Accuracy
1. Confirm Media Library storage usage uses RPC-backed total:
   - `get_media_library_usage_bytes()`
2. Confirm usage updates after upload/delete operations.

## Telemetry Procedure (Local)
Use DevTools Console:

```js
window.__shortpulseMediaPerf?.clear();
```

Reproduce a media-heavy flow, then inspect:

```js
window.__shortpulseMediaPerf?.durationStats();
window.__shortpulseMediaPerf?.signStats();
```

Key indicators:
- `p95_duration_ms` for `media.sign.batch.completed`
- `failed_ratio` grouped by `surface`/`tab`/`query_mode`
- first-card/first-media-paint timing trends
- bulk move timings/failures via `media.move.bulk.completed` and `media.move.bulk.failed`
- reference-grid render and heap trends via:
  - `media.grid.render.commit`
  - `media.grid.longtask.sample`
  - `media.grid.memory.sample`
  - `media.grid.archive.transition`

## Tuning Knobs
- Media Library sign budget constants:
  - `MEDIA_ROUTE_SIGN_BUDGET_*` in `frontend/pages/media-library.tsx`
- Modal sign budget constants:
  - `MEDIA_MODAL_SIGN_BUDGET_*` in `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- Reference Grid autoplay caps:
  - `REFERENCE_AUTOPLAY_MAX_*` in `frontend/features/ai-studio/components/ReferenceCanvas.tsx`
- Reference Grid active/archived caps:
  - `NEXT_PUBLIC_REFERENCE_GRID_ACTIVE_LIMIT` (default `500`)
  - `NEXT_PUBLIC_REFERENCE_GRID_ARCHIVE_PREVIEW_KEEP_COUNT` (default `120`)
- Reference Grid feature flags:
  - `NEXT_PUBLIC_REFERENCE_GRID_NORMALIZED_STATE`
  - `NEXT_PUBLIC_REFERENCE_GRID_SOFT_ARCHIVE`
  - `NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW`
  - `NEXT_PUBLIC_REFERENCE_GRID_UPDATE_BACKPRESSURE`

Adjust only after telemetry review; keep desktop/mobile/constrained profiles distinct.

## Security Guardrails
- `/api/media/sign-batch` must enforce:
  - authenticated user (`requireApiUser`)
  - fixed bucket: `media_library`
  - signed paths only under `<auth.uid()>/...`
  - bounded request size and TTL limits
- Never expose service-role keys in client-side code.

## Failure Modes And Actions
- Symptom: high sign failure ratio.
  - Check path scope validity and `preview_*` variant hints.
  - Validate API response shape and auth headers.
- Symptom: slow p95 sign duration.
  - Confirm batched signing calls are used (not per-item direct signing fallback).
  - Reduce batch/prefetch budgets for constrained profiles.
- Symptom: autoplay decode storms.
  - Verify autoplay budget constants and viewport gating behavior.
  - Confirm constrained profile budget is active when expected.

## Release Checklist
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. Manual verification:
   - Media Library route (images/videos/private/AI tabs)
   - AI Studio modal search + paging + selection
   - Reference Grid autoplay behavior on desktop and small-screen widths

## Related Docs
- `docs/adr/0009-media-derivatives-virtualized-grid-autoplay-budget.md`
- `docs/planning/media-library-reference-grid-optimization-plan.md`
- `docs/planning/media-optimization-phase0-measurement-spec.md`
- `docs/troubleshooting.md`
