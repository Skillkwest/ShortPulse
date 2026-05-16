# Holomony Media Surface Inventory

Purpose: track the approved and candidate media-heavy surfaces Holomony may optimize, along with their owner files, measurement paths, correctness gates, and current onboarding state.

Use this as the cross-surface control sheet before expanding Holomony beyond a single surface.

## Current Operating Rule

Holomony does not treat a media-heavy surface as first-class until it has:
- a stable surface name,
- clear owner files,
- at least one usable measurement path,
- explicit correctness checks,
- and either a retained baseline packet or a retained baseline audit note.

## Inventory

| Surface | Surface ID | Current status | System row | Primary owner files | Current measurement path | Correctness gates | Baseline state | Next highest-ROI need |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AI Studio Media panel | `ai-studio-panel` | `approved-active` | `media-library-workflow` | `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`, `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`, `frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts`, `frontend/lib/mediaPerfTelemetry.ts` | `media_panel_kpi_capture.mjs`, `media_panel_kpi_score.mjs`, `media_library_checkpoint_runner.mjs`, focused live panel audit | no wrong-asset display, no empty-state mismatch, acceptable sign/resolve/fallback churn, save-browse trust preserved when tested | repeated retained packet now captured with `sampleCount: 5`; evidence improved from insufficient to low | verify and repair `uploaded_images` image derivative readiness so open-phase signing stops landing on originals; then drive sign-batch cost down |
| Elements embedded media panel | `elements-media-panel` | `approved-active` | `ai-studio-elements-workflow` plus shared `media-library-workflow` runtime | `frontend/features/ai-studio/components/ElementsEmbeddedMediaLibraryPanel.tsx`, `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`, `frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts`, `frontend/lib/mediaPerfTelemetry.ts` | `media_panel_kpi_capture.mjs`, `media_panel_kpi_score.mjs`, shared runtime telemetry, focused live panel audit | same core correctness gates as AI Studio panel, plus embedded-panel interaction stability | repeated retained packet now captured with `sampleCount: 5`; evidence improved from insufficient to low | verify and repair `uploaded_images` image derivative readiness so open-phase signing stops landing on originals; then drive sign-batch cost down |
| AI Studio Media modal | `ai-studio-modal` | `supporting-runtime-surface` | `media-library-workflow` | `frontend/features/ai-studio/components/MediaLibraryModal.tsx`, `frontend/features/media-library/hooks/useMediaTabDataController.ts`, `frontend/features/media-library/logic/mediaPreviewResolver.ts`, `frontend/lib/mediaPerfTelemetry.ts` | shared runtime telemetry, checkpoint runner, targeted tests | modal load stability, preview correctness, stale-refresh behavior, selection correctness | no Holomony KPI baseline; treated as companion surface for now | decide if modal should graduate to first-class KPI surface |
| Reference Grid | `reference-grid` | `candidate-awaiting-approval` | `ai-studio-reference-grid` | `frontend/features/ai-studio/components/ReferenceGrid.tsx`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridImageHydrationController.ts`, `frontend/lib/mediaPerfTelemetry.ts` | existing reference-grid perf audit tooling, runtime telemetry, adaptive-media audits; no Holomony KPI packet yet | wrong-asset prevention, autoplay/attach budget stability, drag/drop correctness, detail-preview correctness, archive/restore trust | no Holomony baseline packet yet | explicit user approval plus first Holomony baseline audit contract |
| Quick Slot Inventory | `quick-slot-inventory` | `candidate-awaiting-approval` | `ai-studio-reference-grid` | `frontend/features/ai-studio/components/ReferenceGrid.tsx`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts`, `frontend/features/ai-studio/reference-domain/selectors.ts` | indirect through reference-grid tooling; no first-class Holomony measurement path | reorder/remove correctness, dedupe correctness, drag/drop correctness, preview compaction correctness | no baseline | explicit user approval plus dedicated measurement design |

## Notes By Surface

### AI Studio Media panel

- This is the current primary Holomony surface.
- It already has the strongest KPI and capture support.
- The active milestone for this surface is now explicitly `stable and strong media panel`.
- The biggest remaining gap is no longer list-count churn; that lane improved.
- The main remaining weaknesses are low canonical preview coverage, high sign-batch cost, and still-high visible state churn.
- The strongest current live evidence narrows that further: open-phase signing is concentrated in `uploaded_images`, and those rows are still opening on original assets instead of durable thumbs.

### Elements embedded media panel

- This is already approved in Holomony scope and now has a dedicated capture path.
- The surface reuses much of the panel runtime, so it is a good control surface for shared-runtime audits.
- The active milestone for this surface is the same `stable and strong media panel` finish line.
- The repeated retained packets still show the same dominant weakness pattern as AI Studio: preview authority remains weak and sign-batch cost remains too high, even after list churn improved.
- The stronger open-phase capture confirms the same row class is involved here too: `uploaded_images` are still opening on original assets.

### AI Studio Media modal

- This is still a real runtime surface, but not currently the main Holomony product surface.
- Keep it as a companion surface unless repeated user-facing performance work makes it worth first-class KPI treatment.

### Reference Grid and Quick Slot Inventory

- These are valid future Holomony targets.
- They are not active first-class Holomony surfaces yet.
- Expanding into them should happen only with explicit approval and a retained onboarding packet.

## Current Priority Order

1. AI Studio Media panel
2. Elements embedded media panel
3. AI Studio Media modal if panel/runtime coupling makes it necessary
4. Reference Grid with explicit approval
5. Quick Slot Inventory with explicit approval

## Current Milestone

Holomony's current workspace milestone is:

- make the approved media panels `stable and strong`

Current read:

- the panels are usable and measurable
- they are not yet strong
- the clearest blockers are image derivative readiness for `uploaded_images`, sign-batch cost, and visible state churn

## Required Additions Before Holomony Can Fully Own Cross-Surface Work

1. Raise evidence quality on approved surfaces beyond low-confidence repeated packets.
2. Explicit onboarding packets for any newly approved surface family.
