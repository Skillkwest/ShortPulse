# Media Optimization Phase 0 Measurement Spec

Status: draft  
Date: February 12, 2026  
Scope: Media Library route, AI Studio Media Library modal, AI Studio Reference Grid

## Purpose
Define baseline measurements, instrumentation points, datasets, and acceptance gates before implementation of the media optimization architecture.

## Success criteria for Phase 0
- Baseline metrics are captured reproducibly across at least three dataset sizes.
- Metrics are attributable to explicit flow boundaries (query, signing, render, autoplay start).
- Regression gates are defined and approved for each implementation phase.

## Test datasets
Use three fixture profiles per test user:
- `small`: 120 assets (80 images, 40 videos).
- `medium`: 1,500 assets (1,050 images, 450 videos).
- `large`: 10,000 assets (7,000 images, 3,000 videos).

Video mix targets:
- 60% portrait 9:16
- 30% landscape 16:9
- 10% square 1:1

Size distribution targets:
- Images: 0.2 MB to 8 MB (median 1.5 MB).
- Videos: 2 MB to 200 MB (median 22 MB).

## Measurement environments
- Desktop profile: modern MacBook-class hardware, latest Chromium.
- Lower-power profile: mid-tier laptop, latest Chromium.
- Network profiles:
  - `fast` (office broadband baseline).
  - `constrained` (simulated bandwidth and latency).

## Metrics to collect
### User-perceived metrics
- Route paint -> first visible card shell.
- Route paint -> first visible media paint.
- Modal open -> first visible card shell.
- Modal open -> first visible media paint.
- Reference insert click -> card visible in grid.

### System metrics
- List query latency per page.
- Signed URL generation latency per batch.
- URL signing error rate.
- Media decode failures.
- Long task count and duration during scroll.
- Scroll FPS samples.
- Active autoplay video count.

### Capacity metrics
- DOM node count for grid container.
- JS heap delta during:
  - first page load,
  - three-page scroll,
  - autoplay steady state.

## Instrumentation points
Primary UI surfaces:
- `legacy standalone Media Library page`
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- `frontend/features/ai-studio/components/ReferenceCanvas.tsx`

Data/signing paths:
- existing Supabase media queries and signed URL fetch helpers in Media Library + modal.

Event naming convention:
- `media.route.first_card_shell`
- `media.route.first_media_paint`
- `media.modal.first_card_shell`
- `media.modal.first_media_paint`
- `media.sign.batch.completed`
- `media.sign.batch.failed`
- `media.grid.scroll.sample`
- `media.grid.autoplay.started`
- `media.grid.autoplay.stopped`

All events should include:
- `surface` (`media-library-route` | `media-library-modal` | `reference-grid`)
- `tab`
- `dataset_profile`
- `network_profile`
- `page_size`
- `visible_item_count`

## Baseline execution protocol
Per environment/profile:
1. Clear app cache/session state as required.
2. Run cold load once, warm load three times.
3. Open each tab and capture initial + scroll measurements.
4. For Reference Grid, capture autoplay behavior over 60s steady state.
5. Export metrics snapshot and attach to planning notes.

## Phase gates (for later implementation phases)
- Phase 1 gate:
  - >= 35% improvement in first-card-shell latency on medium dataset.
- Phase 2 gate:
  - >= 50% reduction in grid DOM nodes under large dataset.
  - scroll FPS >= 55 median on desktop profile.
- Phase 3/4 gate:
  - >= 40% reduction in first-media-paint latency for video-heavy tabs.
  - autoplay error rate < 1% in steady state.

## Risks and controls
- Risk: synthetic datasets do not reflect production media mix.
  - Control: run one additional “real-user sample” validation pass before rollout.
- Risk: noisy measurements across environments.
  - Control: use fixed hardware/network presets and repeat-run medians.

## Deliverables
- Baseline report with charts/tables.
- Approved gate thresholds for implementation phases.
- Instrumentation checklist mapped to each surface.
