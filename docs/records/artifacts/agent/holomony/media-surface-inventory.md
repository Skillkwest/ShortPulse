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

Character panel media assignment remains outside the active approved-panel ownership boundary until it has its own direct audit/KPI contract and retained baseline evidence.

## Inventory

| Surface                          | Surface ID                         | Current status                | System row                                                                 | Primary owner files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Current measurement path                                                                                                                                            | Correctness gates                                                                                                                                                                                                                                                                        | Baseline state                                                                                                                                                                                                                                                                                                                                                                                                                   | Next highest-ROI need                                                                                                                                                |
| -------------------------------- | ---------------------------------- | ----------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI Studio Media panel            | `ai-studio-panel`                  | `approved-active`             | `media-library-workflow`                                                   | `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`, `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`, `frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts`, `frontend/lib/mediaPerfTelemetry.ts`                                                                                                                                                                                                                                                                                                                                                                                       | `media_panel_kpi_capture.mjs`, `media_panel_kpi_score.mjs`, `media_library_checkpoint_runner.mjs`, focused live panel audit, `media-panel-persistence.audit.js`     | no wrong-asset display, no empty-state mismatch, acceptable sign/resolve/fallback churn, save-browse trust preserved when tested, wide-panel density does not force unreadable cards                                                                                                     | fresh 2026-05-19 retained packet exists and same-day production persistence audit passed; five-column density implementation exists in code and KPI proof was refreshed; use the dated 2026-05-19 retained report for exact live metrics and current score details                                                                                                                                                               | reduce mixed-open sign cost and first paint while preserving current persistence and zero resolver/list churn                                                        |
| Elements embedded media panel    | `elements-media-panel`             | `approved-active`             | `ai-studio-elements-workflow` plus shared `media-library-workflow` runtime | `frontend/features/ai-studio/components/ElementsEmbeddedMediaLibraryPanel.tsx`, `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`, `frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts`, `frontend/lib/mediaPerfTelemetry.ts`                                                                                                                                                                                                                                                                                                                                                                       | `media_panel_kpi_capture.mjs`, `media_panel_kpi_score.mjs`, shared runtime telemetry, focused live panel audit, `media-panel-persistence.audit.js`                  | same core correctness gates as AI Studio panel, plus embedded-panel interaction stability and no forced five-column shrink when embedded width is too narrow                                                                                                                             | fresh 2026-05-19 retained packet exists and same-day production persistence audit passed; five-column density implementation exists in code and KPI proof was refreshed; use the dated 2026-05-19 retained report for exact live metrics and current score details                                                                                                                                                               | reduce mixed-open sign cost and first paint while preserving current persistence and zero resolver/list churn                                                        |
| Character panel media assignment | `character-panel-media-assignment` | `candidate-onboarded`         | `ai-studio-characters-workflow`                                            | `frontend/features/ai-studio/components/CharacterPanel.tsx`, `frontend/features/character-manager/components/CharacterPanelSplitHost.tsx`, `frontend/features/character-manager/components/CharacterPanelWorkspace.tsx`, `frontend/features/character-manager/hooks/useCharacterManagerDroppedReferenceController.ts`, `frontend/features/character-manager/hooks/useCharacterCardPreviewUrls.ts`, `frontend/features/character-manager/logic/characterManagerPersistenceCore.ts`, `frontend/features/character-manager/logic/characterQuickSwapPersistence.ts`, `frontend/features/ai-studio/components/ElementsEmbeddedMediaLibraryPanel.tsx` | focused browser audit path through the AI Studio Character panel, runtime/code audit, targeted tests for split-host/workspace wiring; no first-class KPI packet yet | image-only assignment to character refs, copy semantics into `character_media_assets`, no wrong-asset assignment, clear slot-full failure, save/reopen character trust, character-media isolation preserved, bottom embedded media browser inherits panel density only when width allows | user approval now explicit; retained onboarding audit note created in `reports/2026-05-18-character-panel-media-assignment-onboarding-audit.md`; shared embedded browse runtime already covered indirectly by `elements-media-panel`; no first-class Holomony KPI packet or direct assignment-latency audit yet; bottom embedded browser inherits five-column density implementation through `ElementsEmbeddedMediaLibraryPanel` | visually verify bottom embedded browser density and add a dedicated direct audit path for selection/drop-to-saved-character latency, failure rate, and restore trust |
| AI Studio Media modal            | `ai-studio-modal`                  | `supporting-runtime-surface`  | `media-library-workflow`                                                   | `frontend/features/ai-studio/components/MediaLibraryModal.tsx`, `frontend/features/media-library/hooks/useMediaTabDataController.ts`, `frontend/features/media-library/logic/mediaPreviewResolver.ts`, `frontend/lib/mediaPerfTelemetry.ts`                                                                                                                                                                                                                                                                                                                                                                                                     | shared runtime telemetry, checkpoint runner, targeted tests                                                                                                         | modal load stability, preview correctness, stale-refresh behavior, selection correctness                                                                                                                                                                                                 | no Holomony KPI baseline; treated as companion surface for now                                                                                                                                                                                                                                                                                                                                                                   | decide if modal should graduate to first-class KPI surface                                                                                                           |
| Reference Grid                   | `reference-grid`                   | `candidate-awaiting-approval` | `ai-studio-reference-grid`                                                 | `frontend/features/ai-studio/components/ReferenceGrid.tsx`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridImageHydrationController.ts`, `frontend/lib/mediaPerfTelemetry.ts`                                                                                                                                                                                                                                        | existing reference-grid perf audit tooling, runtime telemetry, adaptive-media audits; no Holomony KPI packet yet                                                    | wrong-asset prevention, autoplay/attach budget stability, drag/drop correctness, detail-preview correctness, archive/restore trust                                                                                                                                                       | no Holomony baseline packet yet                                                                                                                                                                                                                                                                                                                                                                                                  | explicit user approval plus first Holomony baseline audit contract                                                                                                   |
| Quick Slot Inventory             | `quick-slot-inventory`             | `candidate-awaiting-approval` | `ai-studio-reference-grid`                                                 | `frontend/features/ai-studio/components/ReferenceGrid.tsx`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridRuntimeScaffold.ts`, `frontend/features/ai-studio/reference-domain/selectors.ts`                                                                                                                                                                                                                                                                                                                                                                                                                            | indirect through reference-grid tooling; no first-class Holomony measurement path                                                                                   | reorder/remove correctness, dedupe correctness, drag/drop correctness, preview compaction correctness                                                                                                                                                                                    | no baseline                                                                                                                                                                                                                                                                                                                                                                                                                      | explicit user approval plus dedicated measurement design                                                                                                             |

## Notes By Surface

### AI Studio Media panel

- This is the current primary Holomony surface.
- It already has the strongest KPI and capture support.
- The active milestone for this surface is now explicitly `stable and strong media panel`.
- Historical optimization detail belongs in retained reports, not here.
- Current operational read for this surface lives in `docs/agents/holomony/memory.md` and the retained KPI/persistence reports.

### Elements embedded media panel

- This is already approved in Holomony scope and now has a dedicated capture path.
- The surface reuses much of the panel runtime, so it is a good control surface for shared-runtime audits.
- The active milestone for this surface is the same `stable and strong media panel` finish line.
- Historical optimization detail belongs in retained reports, not here.
- Current operational read for this surface lives in `docs/agents/holomony/memory.md` and the retained KPI/persistence reports.

### Character panel media assignment

- This is now an onboarded Holomony candidate surface.
- It is not part of the existing panel KPI family.
- Treat it as a hybrid seam:
  - shared embedded browse/runtime below
  - character-owned assignment, copy, persistence, and restore path above
- Its first-class promotion depends on character-specific evidence, not just panel-open KPI results.
- Until that contract exists, it stays adjacent to Holomony's approved-panel work rather than inside the active approved-panel source of truth.

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
3. Character panel media assignment
4. AI Studio Media modal if panel/runtime coupling makes it necessary
5. Reference Grid with explicit approval
6. Quick Slot Inventory with explicit approval

## Current Milestone

Holomony's current workspace milestone is:

- make the approved media panels `stable and strong`

Current approved-panel ownership means:

- `ai-studio-panel`
- `elements-media-panel`

Canonical current-state read lives in:

- `docs/agents/holomony/memory.md`

Exact snapshot metrics and scores live in dated retained reports, especially:

- `reports/2026-05-19-approved-panel-baseline-refresh.md`
- `reports/2026-05-20-ai-studio-media-library-incident-hotfix.md`
- `reports/2026-05-18-media-library-five-column-density-plan.md`

## Required Additions Before Holomony Can Fully Own Cross-Surface Work

1. Reduce mixed-open sign batch p95 and first useful media paint on the approved panels without harming persistence trust.
2. Raise evidence quality on approved surfaces beyond low-confidence repeated packets.
3. Build a direct audit path for `character-panel-media-assignment` before promoting it beyond candidate status.
