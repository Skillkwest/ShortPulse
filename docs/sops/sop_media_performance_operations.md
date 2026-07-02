# SOP: Media Performance Operations

## Purpose

Operate and troubleshoot Media Library and AI Studio Reference Grid performance under large media volumes while preserving UX requirements (including inline video autoplay in Reference Grid).

## Scope

- In scope:
  - AI Studio Media Library panel and embedded Media Library panels.
  - Reference Grid autoplay performance controls.
  - Signed URL hydration and batch signing behavior.
  - Local telemetry inspection for tuning and incident triage.
- Out of scope:
  - Provider model latency and generation queue incidents (see provider SOPs).
  - Schema/backfill design decisions (see ADRs and planning specs).

Use [docs/sops/sop_media_panel_performance_kpi.md](./sop_media_panel_performance_kpi.md) when you need a scored KPI report for the AI Studio media panel or the Elements embedded media panel rather than raw telemetry alone.

For Media Library deep-scroll or older-media browse work, run the fast local guard before closeout:

```bash
cd frontend
npm run media:checkpoint:deep-scroll-performance
```

This checkpoint protects the cursor append, panel runtime ordering, indexed virtualization, visible-scoped signing, and touched-file type-check seams. It is local implementation proof only. When authenticated browser or deployed-surface proof is required, run `npm run test:e2e:media-library-runtime` with a real audit account and the intended base URL.

## Key Components

- Client signing/cache:
  - `frontend/lib/mediaSignedUrlCache.ts`
- Batch signing API:
  - `frontend/pages/api/media/sign-batch.ts`
- Resolve-previews API:
  - `frontend/pages/api/media/resolve-previews.ts`
- Server-authoritative list API:
  - `frontend/pages/api/media/list.ts`
- AI Studio Media Library panel:
  - `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
  - `frontend/features/media-library/logic/mediaLibraryAdaptivePreview.ts`
- Shared route/modal virtualization math:
  - `frontend/features/media-library/logic/mediaGridVirtualization.ts`
- Shared adaptive browser-pressure sampler:
  - `frontend/lib/adaptive-media/sharedPressure.ts`
  - consumed by Media Library adaptive pressure and Reference Grid perf watchdog hooks
- Reference Grid autoplay budget:
  - `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- Reference Grid archive + output lifecycle controls:
  - `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- Upload preview ingestion path:
  - `frontend/features/ai-studio/logic/stateParsers.ts`
- Telemetry buffer + debug handle:
  - `frontend/lib/mediaPerfTelemetry.ts`
  - initialized via `frontend/pages/_app.tsx`
- AI Studio crash-adjacent stability telemetry:
  - `frontend/features/ai-studio/logic/aiStudioStabilityTelemetry.ts`
  - emitted as medium-severity `telemetry.ai_studio.stability.*` events so they reach `app_error_events` without grouped incidents
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

### 0) Isolate Browser Environment

Before treating an AI Studio freeze or console CSP violation as app-owned performance work, compare the affected browser profile with a clean browser profile or Incognito/private window with extensions disabled.

- If the issue disappears in the clean profile, treat the active browser extensions or profile state as the likely source and follow `docs/troubleshooting.md#ai-studio-freezes-or-browser-extension-csp-noise`.
- If the issue reproduces in the clean profile, continue with the Media Performance and Reference Grid telemetry workflow below.
- Do not relax CSP, add extension-specific product code, or use extension-triggered Google Fonts/style blocks as proof that ShortPulse owns those assets.

### 1) Validate Baseline Path

1. Open the AI Studio Media Library panel and modal.
2. Confirm media cards render quickly with placeholders first, then preview hydration.
3. Confirm pagination/search remains responsive with large tabs.
4. Confirm `POST /api/media/list` is active as the canonical Media Library list route.
5. Confirm the default mixed `All Media` first page on approved panel surfaces arrives with the tiny list-seeded preview path:
   - up to five non-audio preview URLs can be seeded directly by `/api/media/list`
   - search results, later pages, audio rows, and the modal should not rely on this seed
6. Confirm stale refresh is non-blocking in the AI Studio modal:
   - Existing cards remain visible while refresh is in-flight.
   - `Loading media library…` appears only when there are zero visible media rows.
   - `Refreshing media…` can appear while cards remain mounted.
7. For older-media browse or deep-scroll changes, require the deep-scroll checkpoint above before claiming the lane is locally guarded.

### 2) Validate Batch Signing Contract

1. Open browser network tab while loading media grids.
2. Confirm `POST /api/media/sign-batch` is called during lazy-sign passes.
3. Confirm response status is `200` and payload contains:
   - `urls: { "<storage_path>": "<signed_url>|null" }`
4. Confirm media-library surfaces (`modal/panel`) return `x-shortpulse-media-sign-preview-profile` and transform-free signed preview URLs for images.
5. Confirm failed entries degrade to placeholder (not a blocking error state).
6. For approved panel surfaces on the default mixed first-page open, treat any tiny `/api/media/list` preview seed as part of the canonical hot path:
   - the first lazy sign batch is incremental follow-up work, not proof that the open started with zero preview authority
   - modal opens should still behave as fully lazy-signed

### 2b) Validate Next Optimizer Bypass Contract

1. Load media-heavy `All Media` on the AI Studio modal and panel.
2. Confirm image card `src` values stay as Supabase signed URLs and are not rewritten to `/_next/image?...`.
3. Confirm `/api/media/resolve-previews` responses include `x-shortpulse-media-resolve-preview-profile`.
4. Confirm detail modal/download remain full-quality (no quality regression).

### 3) Validate Reference Grid Autoplay Budget

1. Open AI Studio with multiple visible video cards.
2. Confirm autoplay is viewport-gated and bounded.
3. Confirm on constrained conditions (`saveData`, low memory, very slow network) autoplay budget reduces.
4. Confirm offscreen cards pause/detach according to configured delay.

### 3a) Validate Reference Grid Active-Workset Cap

1. Confirm the Reference Grid counter displays `Media: <visible>/400`.
2. Add or restore references until the active workset reaches 400 visible items.
3. Confirm new visible references are refused with cap copy instead of entering the hot path.
4. Confirm restored or normalized over-cap active rows move into Archived with restore actions instead of being dropped.
5. Confirm high-density posture starts before the cap is reached, with the threshold at 300 visible items.

### 3b) Validate Curated Split Behavior

1. Confirm top `Canvas` section renders above `Quick Slot Inventory` and remains interactive.
2. Drag the top divider and confirm Canvas / Quick Slot resize without exposing shortcut controls.
3. Confirm `Quick Slot Inventory` remains empty by default and accepts both internal drags from `All refs` and Media Library media/prompt payloads.
4. Drag a card from bottom `All refs` into `Quick Slot Inventory`; verify add + dedupe semantics.
5. Drag media and prompt items from Media Library into `Quick Slot Inventory`; verify the drop lands in Quick Slot without shell reroute and preserves dedupe semantics.
6. Drag compatible content into right-rail `Canvas`; verify the drop lands on canvas rather than a shell fallback target.
7. Reorder quick-slot cards by dragging within top inventory section; verify before/after/end behavior.
8. Remove a quick-slot card using the explicit remove control on the active card.
9. Drag the lower horizontal divider with pointer and keyboard (`ArrowUp`, `ArrowDown`, `Home`, `End`) and verify quick-slot/all-refs resizing.

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
window.__shortpulseMediaPerf?.resolveStats();
window.__shortpulseMediaPerf?.fallbackStats();
```

Key indicators:

- `p95_duration_ms` for `media.sign.batch.completed`
- `failed_ratio` grouped by `surface`/`tab`/`query_mode`
- `resolve-previews` `failed_ratio` and `total_batch_size` grouped by `surface`
- storage-download fallback `failed_ratio` and `total_candidates` grouped by `surface`
- `total_primary_durable` / `total_resolved_durable` versus `total_primary_original` / `total_resolved_original`
- `source_class` and `error_kind` dimensions on `media.sign.batch.completed` / `media.sign.batch.failed`
- `resolved_count` / `failed_count` dimensions on `media.resolve_previews.completed` / `media.resolve_previews.failed`
- `candidate_count` / `succeeded_count` / `failed_count` dimensions on
  `media.storage_download_fallback.completed` / `media.storage_download_fallback.failed`
- `preview_delivery_mode` and `optimizer_bypassed` are debugging-only dimensions during media-rendering hardening; do not use them as pass/fail or rollout-gate evidence until the telemetry truth spec unblocks them
- first-card/first-media-paint timing trends
- open-to-first-media timers:
- `media.modal.open_to_first_media`
- bulk move timings/failures via `media.move.bulk.completed` and `media.move.bulk.failed`
- reference-grid render and heap trends via:
  - `media.grid.render.commit`
  - `media.grid.longtask.sample`
  - `media.grid.memory.sample`
  - `media.grid.archive.transition`
- AI Studio stability events via `app_error_events` source filters:
  - `telemetry.ai_studio.stability.session_started`
  - `telemetry.ai_studio.stability.visibility_hidden`
  - `telemetry.ai_studio.stability.pagehide`
  - `telemetry.ai_studio.stability.first_grid_commit`
  - `telemetry.ai_studio.stability.pressure_level_changed`
  - `telemetry.ai_studio.stability.pressure_quarantine_set`
- Under telemetry backpressure, non-critical long-task samples (`media.grid.longtask.sample`) are deferred/rate-limited before lower-value volume can crowd the browser.
- Release perf gates fail supported `performance.memory` heap growth above the crash-resilience threshold; browsers without heap metrics are recorded as not measurable instead of pass/fail proof.
- shell section isolation trends via `runStudioShellAudit` scenario fields:
  - `sectionRenderCounters`
  - `sectionCommit`
  - `nonGridRerendersPerOutputStatusTick`
- crash-adjacent local browser evidence via:
  - `window.__shortpulseAiStudioCrashEvidence?.snapshot()`
- When extension interference is suspected, run the same local telemetry flow once in the affected profile and once in a clean extension-disabled profile. Treat the clean profile as the app-owned baseline and the affected profile as environment evidence.

## Tuning Knobs

- Panel sign budget constants:
  - `MEDIA_LIBRARY_PANEL_SIGN_BUDGET_*` in `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
- Media list/runtime contract:
  - canonical Media Library list/signing runtime (`/api/media/list`, virtualization, video budget, sign prefetch)
- Reference Grid autoplay caps:
  - `REFERENCE_AUTOPLAY_MAX_*` in `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- Reference Grid active-workset cap:
  - `REFERENCE_GRID_MAX_VISIBLE_ITEMS` in `frontend/features/ai-studio/reference-grid/logic/referenceGridLimits.ts`
  - Over-cap active rows should archive through `archiveReason: "cleanup"` rather than disappear from project/session state.
- Reference Grid high-density threshold:
  - `REFERENCE_HIGH_DENSITY_CARD_COUNT` in `frontend/features/ai-studio/reference-grid/referenceGridConfig.ts`
- Reference Grid feature flags:
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
- Shared adaptive pressure runtime:
  - Media Library and Reference Grid use one visible-tab sampler for long-task, input-stall, and heap pressure, then apply surface-specific preview-quality recovery semantics.
  - The sampler pauses and resets while the document is hidden to avoid stale hidden-tab pressure driving visible-tab behavior.
  - AI Studio can apply a session-scoped 10-minute pressure quarantine after severe level-2 pressure, keeping new Media Library and Reference Grid renders conservative after a crash-adjacent event.
  - Critical pressure suppresses incidental hover-video attachment while preserving selected/active output behavior.
  - Media Library panel signing budgets are pressure-aware: constrained pressure trims signing fanout and critical pressure disables prefetch while keeping a minimal urgent signing lane.
  - Media Library grid video budgets are pressure-aware: constrained pressure uses the constrained attach budget and critical pressure suppresses incidental video attachment.
- Adaptive media controls:
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY`
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES` (csv allowlist for transform-free adaptive behavior only; not permission to emit Supabase `/storage/v1/render/image/`)
  - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_FORCE_FULL_QUALITY` (temporary no-transform containment switch)
  - AI Studio Media Library panel preview compaction may follow the shared adaptive resolver only when that resolver remains policy-compliant and transform-free.
  - `NEXT_PUBLIC_REFERENCE_GRID_*` and adaptive-media flags do not override the repo-wide prohibition on Supabase image transformations.
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

## Current panel baseline

- AI Studio Media Library panel is considered healthy when:
  - first-page mixed `All Media` open begins with the tiny list-seeded preview path (`up to five` non-audio cards) before follow-up lazy signing,
  - `surface: "media-library-panel"` stays on durable previews only (`total_resolved_original = 0`),
  - `failed_ratio = 0`,
  - first-open sign work stays close to the bounded list seed plus incremental lazy-sign pattern instead of longer repeated-batch churn,
  - perceived first-open panel load feels acceptable in manual testing.
- If panel performance regresses, inspect `window.__shortpulseMediaPerf?.signStats()` and `snapshot()` before changing code. Re-open this lane only when the data shows either:
  - original-fallback drift, or
  - materially higher sign-batch latency/churn than the current baseline.

## Adaptive Media Runbook

Use this runbook together with `docs/sops/sop_adaptive_media_change_control.md` for PR gating and regression-control requirements.

1. Permanent policy:

- Supabase image transformations are prohibited on every path, including signed transform parameters and any `/storage/v1/render/image/` URL emission.
- `SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED=false`
- `NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED=false`

2. Temporary containment:

- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_FORCE_FULL_QUALITY=true`

3. Transform-free adaptive tuning:

- Only after runtime and regression tests prove no Supabase `/storage/v1/render/image/` usage remains.
- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_TUNED_POLICY=true|false`
- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES=<explicit transform-free surface set>`

Monitor these events during rollout:

- `media.adaptive.policy.applied`
- `media.adaptive.resolve.mismatch`
- `media.adaptive.local_transcode.applied`
- `media.adaptive.recovery.level_changed`
- `media.adaptive.detail.full_quality_used`
- `media.adaptive.error`

## Stable Performance Defaults

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
  - If Supabase Storage egress is suspected, run `sql/check_storage_object_egress_risk_breakdown.sql` with the hosted `SUPABASE_DB_URL` to separate tracked originals, tracked variants, dashboard tutorial objects, and untracked storage classes before changing signing budgets.
  - If Supabase Database/PostgREST egress is suspected, run `sql/check_database_egress_query_stats.sql` with the hosted `SUPABASE_DB_URL` to separate high-frequency API/query behavior from high-row payload behavior and to confirm hot table scan/cache/index posture before proposing schema changes.
  - If PostgREST egress is confirmed or strongly suspected, run `sql/check_postgrest_payload_projection_risk.sql` with the hosted `SUPABASE_DB_URL` to verify whether hot generation reads are selecting heavy replay/reload/style/metadata payload columns before changing AI Studio restore or polling behavior.
  - If internal scheduler traffic looks inflated in Vercel or Supabase logs, run `sql/check_scheduler_egress_activity.sql` with the hosted `SUPABASE_DB_URL` before changing cron cadence; raw Vercel CLI log output can repeat identical log ids and should be deduped before inferring request volume.
  - Reduce batch/prefetch budgets for constrained profiles.
  - For `private` tab specifically, prefer narrower per-pass signing fanout:
    - lower `signBatchSize`
    - lower `prefetchWindow`
    - cap signing-candidate paths per row before batch signing
  - Increase modal initial sign seeding for `private` rows on `/api/media/list` before broad budget increases.
- Symptom: autoplay decode storms.
  - Verify autoplay budget constants and viewport gating behavior.
  - Confirm constrained profile budget is active when expected.
- Symptom: `All Media` `generations_images` cards fill slowly in AI Studio panel.
  - Verify adaptive surfaces include the active panel/grid surfaces:
    - `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_SURFACES` includes `media-library-grid` and `media-library-panel-grid`.
  - Run diagnostics script:
    - `sql/check_media_preview_variant_coverage_and_size.sql`
  - If `ai_studio` image rows show low variant coverage and high p50/p90 bytes, enable and verify derivative worker rollout:
    - `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED=true`
    - `SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET=<secret>`
    - scheduler/ops call `POST /api/internal/media-derivatives/run`
    - preferred guarded replay:
      - `SHORTPULSE_MEDIA_DERIVATIVES_RUN_URL=<full-run-url> SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET=<secret> SUPABASE_DB_URL=<db-url> ./scripts/media_derivative_backlog_replay.sh`
      - add `SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN=<bypass-token>` when the target deployment is protected
    - backlog diagnostics: `sql/check_media_derivative_processing_backlog.sql`
    - terminal diagnostics: `sql/check_media_derivative_terminal_failures.sql`
  - Validate worker metrics (`triggerSource`, `durationMs`, `claimed`, `ready`, `failed`, `retryScheduled`, `exhausted`, `variantRowsUpserted`) and check `media_files.processing_last_error` for exhausted rows.
  - Use replay artifacts to verify throughput, not just queue drain:
    - `/tmp/media_derivative_backlog_replay/cycle_summaries.jsonl` for per-cycle `variantRowsUpserted`
    - `/tmp/media_derivative_backlog_replay/final_summary.json` for total `variantRowsUpserted`
  - Treat the derivative lane as healthy only when all of these are true:
    - `sql/check_control_plane_scheduler_health.sql` reports `shortpulse_media_derivatives_every_minute` as present, active, and schedule-matched.
    - `sql/check_media_derivative_processing_backlog.sql` does not show a growing `pending` queue after replay/steady-state observation.
    - Hosted route returns `401` with a dummy secret instead of `404`, which proves the worker is enabled and auth-gated rather than absent/disabled.
    - Hosted route returns `200` with the real secret and non-error worker metrics.
  - Interpret failures by class:
    - `404`: target deployment drift or `SHORTPULSE_MEDIA_DERIVATIVES_ENABLED=false`
    - `401`: secret mismatch or deployment protection/auth drift
    - backlog grows with cron green: inspect the hosted route target before changing client/runtime code
  - Treat replay exit code `2` as “bounded run stopped at safety cap before claims drained”; inspect the final summary in `/tmp/media_derivative_backlog_replay/combined.log`, `/tmp/media_derivative_backlog_replay/final_summary.json`, and `/tmp/media_derivative_backlog_replay/cycle_summaries.jsonl` before increasing the cycle cap.
  - Terminal handling contract for local derivative errors (`unsupported_input`, `decode_failed`, `upload_failed`, `variant_upsert_failed`):
    - Keep exhausted deterministic failures terminal (`processing_attempts >= 5`, `processing_next_retry_at is null`) to avoid retry churn.
    - Re-queue only after source asset repair/replacement via `sql/repair_media_derivative_requeue_terminal_row.sql`.
  - Monitoring thresholds:
    - Warning: terminal failures > 3 or > 0.5% of image rows.
    - Critical: terminal failures > 20 or > 2% of image rows.
- Symptom: repeated `/_next/image` `500` responses for Supabase signed media URLs.
  - Verify media-library card previews are not being rewritten to `/_next/image`.
  - Verify API headers:
    - `/api/media/sign-batch` -> `x-shortpulse-media-sign-preview-profile`
    - `/api/media/resolve-previews` -> `x-shortpulse-media-resolve-preview-profile`
  - If responses are healthy but failures persist, clear stale page state and re-open the media surface to flush previously wrapped URLs.

## Release Checklist

1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. When adaptive paths are touched: `npm -C frontend run test:adaptive-media-runtime`
4. When AI Studio browser-crash resilience paths are touched: `npm -C frontend run test:ai-studio-crash-resilience`
5. `npm -C frontend run build`
6. `npm -C frontend run check:architecture-boundary`
7. `npm -C frontend run check:size-budget`
   - For media-rendering guardrail slices, prefer the combined enforcement bundle:
     - `npm -C frontend run validate:media-rendering-guardrails`
8. For reference-grid modularization phases, include phase report:
   - `docs/planning/evidence/reference-grid-modularization/phase-*/`
9. Run in-browser gate audit from DevTools on `/ai-studio`:
   - `await window.__shortpulseAiStudioPerf?.runReferenceGridAudit()`
   - `await window.__shortpulseAiStudioPerf?.runStudioShellAudit()`
10. Production-mode verification (release signal):

- Run the one-command release check (build + start + authenticated perf audit + teardown):
  - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<audit-password> npm run perf:ai-studio:release-check`
- Optional fast rerun without rebuild:
  - `cd frontend && AI_STUDIO_PERF_SKIP_BUILD=true PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<audit-password> npm run perf:ai-studio:release-check`
- Optional port override:
  - `cd frontend && AI_STUDIO_PERF_PORT=3200 PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<audit-password> npm run perf:ai-studio:release-check`

11. Manual verification:

- AI Studio modal search + paging + selection
- Reference Grid autoplay behavior on desktop and small-screen widths
- Canvas + split interactions (top canvas divider + quick-slot/all-refs divider)

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
- Production automation command:
  - `cd frontend && PLAYWRIGHT_BASE_URL=https://shortpulse.ai PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<audit-password> npm run test:perf:ai-studio`
- Runtime API (development, or production when `NEXT_PUBLIC_AI_STUDIO_PERF_AUDIT_RUNTIME=true`):
  - `window.__shortpulseAiStudioPerf.seedReferenceGrid(count)`
  - `window.__shortpulseAiStudioPerf.seedReferenceGrid(count, { activeCapOverride: 400 })` for explicit 400-active workset stress.
  - `window.__shortpulseAiStudioPerf.clearReferenceGrid()`
  - `window.__shortpulseAiStudioPerf.runReferenceGridAudit(options?)`
  - `window.__shortpulseAiStudioPerf.runStudioShellAudit(options?)`
- Scenarios: 20 / 40 / 50 / 60 / 100 / 400 seeded reference cards. The production release check runs the capped 40 / 60 / 100 path, separately verifies the 500-total / 400-active workset cap, and runs an explicit 400-active workset through `activeCapOverride`.
- Viewport posture:
  - The canonical release-check viewport is `1720x980`.
  - Wider/taller desktop observation runs may render additional virtualized rows. The rendered-item gates stay strict at the canonical height, then add a bounded allowance of 3 items per extra 50 px of viewport height above 980 px. Treat interaction, long-task, media-work-token, decode, and restore gates as unchanged across these desktop viewports.
- Gates:
  - grid click p95 at 40 cards: `<= 90ms`
  - grid long-task p95 at 40 cards: `<= 70ms`
  - grid max input stall at 40 cards: `<= 450ms`
  - rendered item count p95 at 40 cards: `<= 24` at the canonical viewport; viewport-adjusted for taller desktop observation runs
  - grid click p95 at 60 cards: `<= 120ms`
  - grid long-task p95 at 60 cards: `<= 100ms`
  - grid max input stall at 60 cards: `<= 800ms`
  - rendered item count p95 at 60 cards: `<= 28` at the canonical viewport; viewport-adjusted for taller desktop observation runs
  - crash-resilience rendered item count p95 at 100 cards: `<= 36`
  - crash-resilience long-task p95 at 100 cards: `<= 140ms`
  - crash-resilience max input stall at 100 cards: `<= 1000ms`
  - crash-resilience image decode inflight p95 at 100 cards: `<= 6`
  - crash-resilience video attach budget p95 at 100 cards: `<= 3`
  - crash-resilience media work-token p95 at 100 cards: `<= 8`
  - audit output includes:
    - `rendered_item_count_p95_at_count`
    - `image_hydration_queue_p95_at_count`
    - `image_decode_inflight_p95_at_count`
    - `crash_resilience_*_at_100`

## Studio Shell Perf Harness

- Browser command (DevTools Console on `/ai-studio`):
  - `await window.__shortpulseAiStudioPerf?.runStudioShellAudit()`
- Scenarios: 20 / 50 / 60 / 100 / 400 seeded references while exercising toolbar/panel/drop interactions.
- Gates:
  - toolbar switch p95 at 60 refs: `<= 120ms`
  - panel interaction p95 at 60 refs: `<= 140ms`
  - tool-switch visual commit p95 at 60 refs: `<= 180ms`
  - long-task p95 during shell actions: `<= 120ms`
  - max input stall during shell actions: `<= 1000ms`
  - non-grid rerenders per output-status tick (toolbar/properties): `<= 1`

## Related Docs

- `docs/adr/0009-media-derivatives-virtualized-grid-autoplay-budget.md`
- `docs/adr/0037-media-library-supabase-first-derivative-worker-and-claim-rpcs.md`
- `docs/adr/0014-ai-studio-shell-decoupling-and-event-backpressure.md`
- `docs/adr/0015-ai-studio-selector-subscribed-shell-isolation.md`
- `docs/adr/0016-ai-studio-reference-grid-adaptive-delivery-and-watchdog.md`
- `docs/adr/0017-ai-studio-curated-reference-split-grid.md`
- `docs/adr/0022-reference-grid-domain-modular-architecture.md`
- `docs/planning/ai-studio-reference-grid-stabilization-v4-plan.md`
- `docs/planning/ai-studio-reference-grid-modularization-program.md`
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- `docs/planning/media-library-reference-grid-optimization-plan.md`
- `docs/archive/planning/ai-studio-shell-render-isolation-v3-plan.md`
- `docs/planning/media-optimization-phase0-measurement-spec.md`
- `docs/troubleshooting.md`
