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
- Server-authoritative list API:
  - `frontend/pages/api/media/list.ts`
- Media Library route:
  - `frontend/pages/media-library.tsx`
- AI Studio Media Library modal:
  - `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- Shared route/modal virtualization math:
  - `frontend/features/media-library/logic/mediaGridVirtualization.ts`
- Reference Grid autoplay budget:
  - `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- Reference Grid archive + output lifecycle controls:
  - `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- Upload preview ingestion path:
  - `frontend/features/ai-studio/logic/stateParsers.ts`
- Telemetry buffer + debug handle:
  - `frontend/lib/mediaPerfTelemetry.ts`
  - initialized via `frontend/pages/_app.tsx`
- Reference-grid modularization governance:
  - `docs/planning/ai-studio-reference-grid-modularization-program.md`
  - `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
  - `docs/planning/evidence/reference-grid-modularization/`

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
4. Confirm `POST /api/media/list` is active when `NEXT_PUBLIC_MEDIA_LIST_API_ENABLED=true`.
5. Confirm stale refresh is non-blocking in the AI Studio modal:
   - Existing cards remain visible while refresh is in-flight.
   - `Loading media library…` appears only when there are zero visible media rows.
   - `Refreshing media…` can appear while cards remain mounted.

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

### 3b) Validate Curated Split Behavior
1. Confirm top `Curated` section is empty by default and only accepts internal drags from `All refs`.
2. Drag a card from bottom `All refs` into top `Curated`; verify add + dedupe semantics.
3. Reorder curated cards by dragging within top section; verify before/after/end behavior.
4. Remove a curated card using the explicit remove control on the active card.
5. Drag the horizontal divider with pointer and keyboard (`ArrowUp`, `ArrowDown`, `Home`, `End`) and verify section resizing.

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
- open-to-first-media timers:
  - `media.route.open_to_first_media`
  - `media.modal.open_to_first_media`
- bulk move timings/failures via `media.move.bulk.completed` and `media.move.bulk.failed`
- reference-grid render and heap trends via:
  - `media.grid.render.commit`
  - `media.grid.longtask.sample`
  - `media.grid.memory.sample`
  - `media.grid.archive.transition`
- shell section isolation trends via `runStudioShellAudit` scenario fields:
  - `sectionRenderCounters`
  - `sectionCommit`
  - `nonGridRerendersPerOutputStatusTick`

## Tuning Knobs
- Media Library sign budget constants:
  - `MEDIA_ROUTE_SIGN_BUDGET_*` in `frontend/pages/media-library.tsx`
- Modal sign budget constants:
  - `MEDIA_MODAL_SIGN_BUDGET_*` in `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- Route/modal fetch-transition rules:
  - `resolveMediaFetchTransition` in `frontend/features/media-library/logic/mediaFetchTransition.ts`
  - fetch reasons: `initial`, `tab_or_query_reset`, `stale_refresh`, `load_more`
- Media list/runtime rollout gates:
  - `SHORTPULSE_MEDIA_LIST_API_ENABLED`
  - `NEXT_PUBLIC_MEDIA_LIST_API_ENABLED`
  - `NEXT_PUBLIC_MEDIA_LIBRARY_VIRTUALIZATION_ENABLED`
  - `NEXT_PUBLIC_MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED`
  - `NEXT_PUBLIC_MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED`
- Reference Grid autoplay caps:
  - `REFERENCE_AUTOPLAY_MAX_*` in `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- Reference Grid active/archived caps:
  - `NEXT_PUBLIC_REFERENCE_GRID_ACTIVE_LIMIT` (default `500`)
  - `NEXT_PUBLIC_REFERENCE_GRID_ARCHIVE_PREVIEW_KEEP_COUNT` (default `120`)
- Reference Grid feature flags:
  - `NEXT_PUBLIC_AI_STUDIO_PERF_PROFILE` (`stable` default, `legacy` rollback profile)
  - `NEXT_PUBLIC_REFERENCE_GRID_SOFT_ARCHIVE`
  - `NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW`
  - `NEXT_PUBLIC_REFERENCE_GRID_CURATED_SPLIT`
  - `NEXT_PUBLIC_REFERENCE_GRID_STRICT_PREVIEW_LADDER`
  - `NEXT_PUBLIC_REFERENCE_GRID_UPDATE_BACKPRESSURE`
  - `NEXT_PUBLIC_REFERENCE_GRID_DECODE_BUDGET`
  - `NEXT_PUBLIC_REFERENCE_GRID_DYNAMIC_VIRTUALIZATION`
  - `NEXT_PUBLIC_REFERENCE_GRID_DENSE_VISUAL_SIMPLIFY`
  - `NEXT_PUBLIC_REFERENCE_GRID_MEMORY_GUARD`
  - `NEXT_PUBLIC_REFERENCE_GRID_PERF_WATCHDOG`
  - `NEXT_PUBLIC_REFERENCE_GRID_HARD_VIEWPORT_CAP`
  - `NEXT_PUBLIC_REFERENCE_GRID_CSS_CONTAINMENT`
  - `NEXT_PUBLIC_REFERENCE_GRID_LOADING_PLACEHOLDER_TIMEOUT`
  - `NEXT_PUBLIC_REFERENCE_GRID_GLOBAL_MEDIA_BUDGET`
  - `NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY`
  - `NEXT_PUBLIC_REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION` (default `false`)
  - `NEXT_PUBLIC_REFERENCE_GRID_TELEMETRY_BACKPRESSURE`
  - `NEXT_PUBLIC_REFERENCE_GRID_PRECONNECT_HINTS`
  - `NEXT_PUBLIC_REFERENCE_GRID_TRANSITION_NONURGENT`
  - Effective adaptive preview routing requires both:
    - `NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW=true`
    - `NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY=true`
- Adaptive Media V2 rollout flags:
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_ENABLED`
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SHADOW_COMPARE`
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY`
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES` (csv allowlist)
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_FORCE_FULL_QUALITY` (global kill switch)
- AI Studio shell performance flags:
  - `NEXT_PUBLIC_AI_STUDIO_SHELL_DECOUPLE`
  - `NEXT_PUBLIC_AI_STUDIO_DND_BACKPRESSURE`
  - `NEXT_PUBLIC_AI_STUDIO_PANEL_MEMOIZATION`
  - `NEXT_PUBLIC_AI_STUDIO_HIGH_DENSITY_SHELL_MODE`
  - `NEXT_PUBLIC_AI_STUDIO_OUTPUT_SELECTOR_STORE`
  - `NEXT_PUBLIC_AI_STUDIO_SHELL_BOUNDARY_SPLIT`
  - `NEXT_PUBLIC_AI_STUDIO_SELECTOR_CALLBACKS`
  - `NEXT_PUBLIC_AI_STUDIO_PAGE_OUTPUT_DECOUPLE`
  - `NEXT_PUBLIC_AI_STUDIO_RAF_STATUS_FLUSH`
  - `NEXT_PUBLIC_AI_STUDIO_PERF_AUDIT_RUNTIME` (default `false`; enable only for controlled production audits)
- Reference-grid modularization migration flags:
  - `NEXT_PUBLIC_REFERENCE_GRID_DOMAIN_BRIDGE`
  - `NEXT_PUBLIC_REFERENCE_GRID_INGESTION_UNIFIED`
  - `NEXT_PUBLIC_REFERENCE_GRID_PROJECTION_V2`
  - `NEXT_PUBLIC_REFERENCE_GRID_MEDIA_RUNTIME_SHARED`
  - `NEXT_PUBLIC_REFERENCE_GRID_CONTROLLER_SPLIT`

Adjust only after telemetry review; keep desktop/mobile/constrained profiles distinct.

## Adaptive Media V2 Runbook
Use this runbook together with `docs/sops/sop_adaptive_media_change_control.md` for PR gating and regression-control requirements.

1. Shadow compare (no rendering change):
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_ENABLED=true`
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SHADOW_COMPARE=true`
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY=false`
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES=reference-grid`
2. Cutover in parity mode:
  - keep same values above
  - set `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SHADOW_COMPARE=false`
3. Tuned policy rollout:
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY=true`
4. Surface expansion example:
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES=reference-grid,quick-slot,media-library-grid,media-library-modal-grid,character-grid`
5. Emergency rollback:
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_FORCE_FULL_QUALITY=true`

Monitor these events during rollout:
- `media.adaptive.policy.applied`
- `media.adaptive.resolve.mismatch`
- `media.adaptive.local_transcode.applied`
- `media.adaptive.recovery.level_changed`
- `media.adaptive.detail.full_quality_used`
- `media.adaptive.error`

## Stable Performance Profile (Current Default)
- Profile selector:
  - `NEXT_PUBLIC_AI_STUDIO_PERF_PROFILE=stable`
- Reference Grid:
  - `NEXT_PUBLIC_REFERENCE_GRID_UPDATE_BACKPRESSURE=true`
  - `NEXT_PUBLIC_REFERENCE_GRID_DECODE_BUDGET=true`
  - `NEXT_PUBLIC_REFERENCE_GRID_DYNAMIC_VIRTUALIZATION=true`
  - `NEXT_PUBLIC_REFERENCE_GRID_DENSE_VISUAL_SIMPLIFY=true`
  - `NEXT_PUBLIC_REFERENCE_GRID_MEMORY_GUARD=true`
  - `NEXT_PUBLIC_REFERENCE_GRID_PERF_WATCHDOG=true`
  - `NEXT_PUBLIC_REFERENCE_GRID_HARD_VIEWPORT_CAP=true`
  - `NEXT_PUBLIC_REFERENCE_GRID_CSS_CONTAINMENT=true`
  - `NEXT_PUBLIC_REFERENCE_GRID_LOADING_PLACEHOLDER_TIMEOUT=true`
  - `NEXT_PUBLIC_REFERENCE_GRID_GLOBAL_MEDIA_BUDGET=true`
  - `NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY=true`
  - `NEXT_PUBLIC_REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION=false`
  - `NEXT_PUBLIC_REFERENCE_GRID_TELEMETRY_BACKPRESSURE=true`
  - `NEXT_PUBLIC_REFERENCE_GRID_PRECONNECT_HINTS=true`
  - `NEXT_PUBLIC_REFERENCE_GRID_TRANSITION_NONURGENT=true`
- Shell:
  - `NEXT_PUBLIC_AI_STUDIO_PAGE_OUTPUT_DECOUPLE=true`
  - `NEXT_PUBLIC_AI_STUDIO_RAF_STATUS_FLUSH=true`
- Debug-only:
  - `NEXT_PUBLIC_REFERENCE_GRID_RENDER_COMMIT_TELEMETRY=false`
  - `NEXT_PUBLIC_AI_STUDIO_PERF_AUDIT_RUNTIME=false`

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
3. When adaptive paths are touched: `npm -C frontend run test:adaptive-v2-gate`
4. `npm -C frontend run build`
5. `npm -C frontend run check:architecture-boundary`
6. `npm -C frontend run check:size-budget`
7. For reference-grid modularization phases, include phase report:
   - `docs/planning/evidence/reference-grid-modularization/phase-*/`
8. Run in-browser gate audit from DevTools on `/ai-studio`:
   - `await window.__shortpulseAiStudioPerf?.runReferenceGridAudit()`
   - `await window.__shortpulseAiStudioPerf?.runStudioShellAudit()`
9. Production-mode verification (release signal):
   - Run the one-command release check (build + start + authenticated perf audit + teardown):
     - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<audit-password> npm run perf:ai-studio:release-check`
   - Optional fast rerun without rebuild:
     - `cd frontend && AI_STUDIO_PERF_SKIP_BUILD=true PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<audit-password> npm run perf:ai-studio:release-check`
   - Optional port override:
     - `cd frontend && AI_STUDIO_PERF_PORT=3200 PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<audit-password> npm run perf:ai-studio:release-check`
10. Manual verification:
   - Media Library route (images/videos/private/AI tabs)
   - AI Studio modal search + paging + selection
   - Reference Grid autoplay behavior on desktop and small-screen widths
   - Curated split interactions (drag add/reorder/remove + divider resize)
11. CI perf gate (internal branches with audit creds):
   - `.github/workflows/ci.yml` job `ai_studio_perf_gate`
   - Uses `PLAYWRIGHT_AUDIT_EMAIL` + `PLAYWRIGHT_AUDIT_PASSWORD` secrets
   - Runs `npm run test:perf:ai-studio` against production build/start.
   - On pull requests, runs only when AI Studio perf-impacting files changed.
   - Gate mode defaults to `warn` and can be switched to `enforce` with repo variable `AI_STUDIO_PERF_GATE_MODE`.
   - If secrets are missing, the same job records a skip summary and exits cleanly.

## CI Secret And Variable Setup
- GitHub UI:
  - Repository `Settings -> Secrets and variables -> Actions -> New repository secret`
  - Add:
    - `PLAYWRIGHT_AUDIT_EMAIL`
    - `PLAYWRIGHT_AUDIT_PASSWORD`
  - Repository `Settings -> Secrets and variables -> Actions -> Variables`
  - Add:
    - `AI_STUDIO_PERF_GATE_MODE=warn` during stabilization
    - switch to `AI_STUDIO_PERF_GATE_MODE=enforce` after one stable week
    - `REFERENCE_GRID_BOUNDARY_MODE=warn` during decomposition; `enforce` at Phase 6 closeout
    - `REFERENCE_GRID_SIZE_BUDGET_MODE=warn` during decomposition; `enforce` at Phase 6 closeout
- GitHub CLI (maintainer machine):
  - `gh secret set PLAYWRIGHT_AUDIT_EMAIL --body "<audit-email>"`
  - `gh secret set PLAYWRIGHT_AUDIT_PASSWORD --body "<audit-password>"`
  - `gh variable set AI_STUDIO_PERF_GATE_MODE --body "warn"`
  - `gh variable set AI_STUDIO_PERF_GATE_MODE --body "enforce"`
  - `gh variable set REFERENCE_GRID_BOUNDARY_MODE --body "warn"`
  - `gh variable set REFERENCE_GRID_SIZE_BUDGET_MODE --body "warn"`

## Reference Grid Perf Harness
- Browser command (DevTools Console on `/ai-studio`):
  - `await window.__shortpulseAiStudioPerf?.runReferenceGridAudit()`
- Runtime API (development, or production when `NEXT_PUBLIC_AI_STUDIO_PERF_AUDIT_RUNTIME=true`):
  - `window.__shortpulseAiStudioPerf.seedReferenceGrid(count)`
  - `window.__shortpulseAiStudioPerf.clearReferenceGrid()`
  - `window.__shortpulseAiStudioPerf.runReferenceGridAudit(options?)`
  - `window.__shortpulseAiStudioPerf.runStudioShellAudit(options?)`
- Scenarios: 20 / 40 / 50 / 60 / 100 / 300 seeded reference cards.
- Gates:
  - grid click p95 at 40 cards: `<= 90ms`
  - grid long-task p95 at 40 cards: `<= 70ms`
  - grid max input stall at 40 cards: `<= 450ms`
  - rendered item count p95 at 40 cards: `<= 24`
  - grid click p95 at 60 cards: `<= 120ms`
  - grid long-task p95 at 60 cards: `<= 100ms`
  - grid max input stall at 60 cards: `<= 800ms`
  - rendered item count p95 at 60 cards: `<= 28`
  - audit output includes:
    - `rendered_item_count_p95_at_count`
    - `image_hydration_queue_p95_at_count`
    - `image_decode_inflight_p95_at_count`

## Studio Shell Perf Harness
- Browser command (DevTools Console on `/ai-studio`):
  - `await window.__shortpulseAiStudioPerf?.runStudioShellAudit()`
- Scenarios: 20 / 50 / 60 / 100 / 300 seeded references while exercising toolbar/panel/drop interactions.
- Gates:
  - toolbar switch p95 at 60 refs: `<= 120ms`
  - panel interaction p95 at 60 refs: `<= 140ms`
  - tool-switch visual commit p95 at 60 refs: `<= 180ms`
  - long-task p95 during shell actions: `<= 120ms`
  - max input stall during shell actions: `<= 1000ms`
  - non-grid rerenders per output-status tick (toolbar/properties): `<= 1`

## Related Docs
- `docs/adr/0009-media-derivatives-virtualized-grid-autoplay-budget.md`
- `docs/adr/0014-ai-studio-shell-decoupling-and-event-backpressure.md`
- `docs/adr/0015-ai-studio-selector-subscribed-shell-isolation.md`
- `docs/adr/0016-ai-studio-reference-grid-adaptive-delivery-and-watchdog.md`
- `docs/adr/0017-ai-studio-curated-reference-split-grid.md`
- `docs/adr/0022-reference-grid-domain-modular-architecture.md`
- `docs/planning/ai-studio-reference-grid-stabilization-v4-plan.md`
- `docs/planning/ai-studio-reference-grid-modularization-program.md`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- `docs/planning/media-library-reference-grid-optimization-plan.md`
- `docs/planning/ai-studio-shell-render-isolation-v3-plan.md`
- `docs/planning/media-optimization-phase0-measurement-spec.md`
- `docs/troubleshooting.md`
