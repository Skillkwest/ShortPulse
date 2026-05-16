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
| AI Studio Media panel | `ai-studio-panel` | `approved-active` | `media-library-workflow` | `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`, `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`, `frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts`, `frontend/lib/mediaPerfTelemetry.ts` | `media_panel_kpi_capture.mjs`, `media_panel_kpi_score.mjs`, `media_library_checkpoint_runner.mjs`, focused live panel audit | no wrong-asset display, no empty-state mismatch, acceptable sign/resolve/fallback churn, save-browse trust preserved when tested | one retained production KPI run exists, but repeated baseline packets are still needed | repeated packets and regression comparison |
| Elements embedded media panel | `elements-media-panel` | `approved-active` | `ai-studio-elements-workflow` plus shared `media-library-workflow` runtime | `frontend/features/ai-studio/components/ElementsEmbeddedMediaLibraryPanel.tsx`, `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`, `frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts`, `frontend/lib/mediaPerfTelemetry.ts` | `media_panel_kpi_capture.mjs`, `media_panel_kpi_score.mjs`, shared runtime telemetry, focused live panel audit | same core correctness gates as AI Studio panel, plus embedded-panel interaction stability | no retained baseline packet yet | capture the first retained baseline packet and start repeated runs |
| AI Studio Media modal | `ai-studio-modal` | `supporting-runtime-surface` | `media-library-workflow` | `frontend/features/ai-studio/components/MediaLibraryModal.tsx`, `frontend/features/media-library/hooks/useMediaTabDataController.ts`, `frontend/features/media-library/logic/mediaPreviewResolver.ts`, `frontend/lib/mediaPerfTelemetry.ts` | shared runtime telemetry, checkpoint runner, targeted tests | modal load stability, preview correctness, stale-refresh behavior, selection correctness | no Holomony KPI baseline; treated as companion surface for now | decide if modal should graduate to first-class KPI surface |
| Reference Grid | `reference-grid` | `candidate-awaiting-approval` | `ai-studio-reference-grid` | `frontend/features/ai-studio/components/ReferenceGrid.tsx`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridImageHydrationController.ts`, `frontend/lib/mediaPerfTelemetry.ts` | existing reference-grid perf audit tooling, runtime telemetry, adaptive-media audits; no Holomony KPI packet yet | wrong-asset prevention, autoplay/attach budget stability, drag/drop correctness, detail-preview correctness, archive/restore trust | no Holomony baseline packet yet | explicit user approval plus first Holomony baseline audit contract |
| Quick Slot Inventory | `quick-slot-inventory` | `candidate-awaiting-approval` | `ai-studio-reference-grid` | `frontend/features/ai-studio/components/ReferenceGrid.tsx`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts`, `frontend/features/ai-studio/reference-domain/selectors.ts` | indirect through reference-grid tooling; no first-class Holomony measurement path | reorder/remove correctness, dedupe correctness, drag/drop correctness, preview compaction correctness | no baseline | explicit user approval plus dedicated measurement design |

## Notes By Surface

### AI Studio Media panel

- This is the current primary Holomony surface.
- It already has the strongest KPI and capture support.
- The biggest remaining gaps are repeated packet history and regression comparison.

### Elements embedded media panel

- This is already approved in Holomony scope and now has a dedicated capture path.
- The surface reuses much of the panel runtime, so it is a good next expansion target after the current AI Studio panel lane.
- The next real leverage is repeated retained packet capture, not more measurement scaffolding.

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

## Required Additions Before Holomony Can Fully Own Cross-Surface Work

1. Repeated retained baseline packets for each approved surface.
2. KPI regression/compare mode across retained packets.
3. Explicit onboarding packets for any newly approved surface family.
