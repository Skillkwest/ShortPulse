# Naming Phase 7 Entry Readiness

Status: active  
Last updated: 2026-02-23

Purpose: define the exact contract-entry checklist for alias sunset (Phase 7), track release-window requirements, and inventory remaining compatibility aliases that are intentionally retained.

## Executive Decision
1. Do not remove aliases yet.
2. Hold compatibility aliases until the minimum deprecation window is met (two release cycles).
3. Enforce no-new-legacy-terms in active docs via automated check (`scripts/check_naming_canonical_drift.js`).
4. Prepare deterministic removal batches now, execute only after Stop-Point 7 approval.

## Done-State Self-Check

| Requirement | Status | Notes |
| --- | --- | --- |
| Active docs use canonical naming | pass | Active SOPs and active docs sweep completed. |
| User-facing copy canonicalized | pass | Phase 2 complete. |
| Runtime references use canonical asset paths | pass | Phase 6 batches A-B complete; legacy files intentionally retained. |
| Compatibility aliases isolated and explicit | pass | Aliases are marked `@deprecated` and centralized to known bridge files/symbols. |
| Two release cycles since alias introduction | pending | Required before any alias deletion. |
| Stop-Point 7 contraction approval | pending | Must be approved after stability evidence review. |

## Release Window Tracker (Phase 7 Entry Gate)

| Gate | Requirement | Current state |
| --- | --- | --- |
| R1 | Release cycle 1 shipped with aliases in place and no naming regressions | pending |
| R2 | Release cycle 2 shipped with aliases in place and no naming regressions | pending |
| G1 | No active code/docs imports of alias paths/symbols outside compatibility wrappers | pass |
| G2 | Removal batch rollback plan prepared and reviewed | in_progress |
| G3 | Stop-Point 7 approval logged in `naming-decision-log.md` | pass |

## Compatibility Alias Inventory (Current)

### Wrapper Files (path-level compatibility)
1. `frontend/features/ai-studio/components/ReferenceCanvas.tsx` -> canonical `ReferenceGrid.tsx`
2. `frontend/features/ai-studio/components/TextPropertiesPanel.tsx` -> canonical `CreatePropertiesPanel.tsx`
3. `frontend/features/ai-studio/hooks/useAiStudioReferenceCanvasProps.ts` -> canonical `useAiStudioReferenceGridProps.ts`
4. `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasCard.tsx` -> canonical `ReferenceGridCard.tsx`
5. `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasSections.tsx` -> canonical `ReferenceGridSections.tsx`
6. `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasArchiveControls.tsx` -> canonical `ReferenceGridArchiveControls.tsx`

### Deprecated Symbol Aliases (export-level compatibility)
1. `ReferenceCanvasProps` in `frontend/features/ai-studio/components/ReferenceGrid.tsx`
2. `ReferenceCanvas` in `frontend/features/ai-studio/components/ReferenceGrid.tsx`
3. `TextPropertiesPanelProps` in `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`
4. `TextPropertiesPanel` in `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`
5. `useAiStudioReferenceCanvasProps` in `frontend/features/ai-studio/hooks/useAiStudioReferenceGridProps.ts`
6. `ReferenceCanvasDropMode` in `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropController.ts`
7. `ReferenceCanvasCardProps` and `ReferenceCanvasCard` in `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx`
8. `ReferenceCanvasSectionsProps` and `ReferenceCanvasSections` in `frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx`
9. `ReferenceCanvasArchiveControlsProps` and `ReferenceCanvasArchiveControls` in `frontend/features/ai-studio/reference-grid/components/ReferenceGridArchiveControls.tsx`

### Deprecated Prop-Key Bridges (runtime compatibility)
1. `referenceCanvasFileInputRef` -> `referenceGridFileInputRef`
2. `referenceCanvasProps` -> `referenceGridProps`
3. `handleReferenceCanvasFiles` -> `handleReferenceGridFiles`
4. `propertiesText` -> `propertiesCreate`

Source: `frontend/features/ai-studio/components/AiStudioPageContent.tsx` (deprecated optional props preserved for compatibility).

## Pre-Contract Removal Plan (Draft)
1. Batch A: remove wrapper files after import graph reaches zero references.
2. Batch B: remove symbol aliases with codemod-backed callsite migration validation.
3. Batch C: remove deprecated prop-key bridges in `AiStudioPageContentProps` after downstream parity check.
4. Batch D: remove residual legacy public asset files after dual-path window and zero-reference verification.

Each batch requires:
1. `npm -C frontend run validate`
2. `npm -C frontend run test:adaptive-v2-gate`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. `npm -C frontend run check:architecture-boundary`
6. `npm -C frontend run check:size-budget`
7. Optional perf gate when Playwright credentials are available: `npm -C frontend run perf:ai-studio:release-check`

## Drift Prevention Control (Now Active)
1. `scripts/check_naming_canonical_drift.js` enforces canonical naming in active docs surfaces (`docs/sops`, `docs/product`, and selected root docs).
2. `npm -C frontend run docs:check` now includes this guard, blocking reintroduction of legacy naming in active docs.
3. `scripts/check_naming_legacy_usage.js` enforces that runtime legacy alias terms remain confined to approved compatibility files.
4. `npm -C frontend run validate` now includes `check:naming-legacy-usage`.

## Release Window Evidence Procedure
1. At each production release boundary during the deprecation window, create a checkpoint file from:
- `docs/planning/evidence/naming-canonicalization/phase-7/phase-7-release-window-checkpoint-template.md`
2. Save checkpoint artifacts as:
- `docs/planning/evidence/naming-canonicalization/phase-7/YYYY-MM-DD-phase-7-r1-release-window-checkpoint.md`
- `docs/planning/evidence/naming-canonicalization/phase-7/YYYY-MM-DD-phase-7-r2-release-window-checkpoint.md`
3. Attach validation outputs for:
- `validate`, `docs:check`, `test:adaptive-v2-gate`, `build`, `check:architecture-boundary`, `check:size-budget`
4. If Playwright credentials are available, include `perf:ai-studio:release-check`; otherwise record waiver.
5. Update:
- `docs/planning/naming-canonicalization-tracker.md` (slice log + risk notes)
- `docs/planning/naming-decision-log.md` (R1/R2 checkpoint decision entries)
6. Only request contraction approval after both `R1` and `R2` checkpoint files are `pass`.
