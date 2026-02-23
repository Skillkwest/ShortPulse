# Naming Decision Log

Purpose: immutable log of naming decisions and stop-point approvals.

## 2026-02-23: Program Initialization
- Decision: use phased, risk-first canonicalization.
- Decision: canonical user-facing term is `Reference Grid`.
- Decision: canonical create panel term is `CreatePropertiesPanel`.
- Decision: keep `EditPropertiesPanel` and `VideoPropertiesPanel` as canonical workflow panel names.
- Decision: historical/dead docs are non-authoritative for naming decisions and should be marked/ignored.
- Decision: asset naming migration uses dual-path compatibility.

## 2026-02-23: Stop-Point 1 (Active docs)
- Phase/Stop point: Phase 1 completion
- Decision: approved active-doc canonicalization for `Reference Grid` language and panel naming drift.
- Preconditions reviewed:
  - docs checks pass
  - active SOP component paths validated during edits
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-1/2026-02-23-phase-1-active-docs-canonicalization.md`
- Next allowed action: Phase 3 bridge-layer expansion.

## 2026-02-23: Stop-Point 2 (User-facing copy)
- Phase/Stop point: Phase 2 completion
- Decision: approved user-facing copy canonicalization closeout; no active UI surfaces expose `Reference Canvas` or `Text Properties Panel`.
- Preconditions reviewed:
  - frontend term scan shows no user-facing legacy term matches
  - `validate`, `test:adaptive-v2-gate`, `build`, and `docs:check` pass
  - Playwright perf gate intentionally not executed per explicit no-Playwright direction
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-2/2026-02-23-phase-2-user-facing-copy-canonicalization.md`
- Next allowed action: continue bridge/callsite/path migration phases.

## 2026-02-23: Stop-Point 3 (Bridge layer)
- Phase/Stop point: Phase 3 completion
- Decision: approved compatibility bridge (`CreatePropertiesPanel`, `ReferenceGrid`, `useAiStudioReferenceGridProps`) with deprecated legacy aliases retained.
- Preconditions reviewed:
  - type-check and targeted suites pass
  - no runtime behavior changes introduced
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-3/2026-02-23-phase-3-bridge-layer-expand.md`
- Next allowed action: bounded callsite migration slices.

## 2026-02-23: Stop-Point 4 (Callsite migration slice A)
- Phase/Stop point: Phase 4 slice A completion
- Decision: approved runtime callsite migration to canonical prop/import names in page/shell boundaries.
- Preconditions reviewed:
  - validate/adaptive/docs/boundary/size gates pass
  - perf release check remains blocked by missing environment credentials
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-4/2026-02-23-phase-4-callsite-migration-runtime-slice-a.md`
- Next allowed action: continue Phase 4 bounded slices (tests/internal module symbol families), then Phase 5 path rename planning.

## 2026-02-23: Stop-Point 4 (Callsite migration slice B)
- Phase/Stop point: Phase 4 slice B completion
- Decision: approved internal reference-grid drop-mode symbol canonicalization (`ReferenceGridDropMode`) with legacy alias retained.
- Preconditions reviewed:
  - type-check and targeted reference-grid suites pass
  - legacy type alias remains available for compatibility
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-4/2026-02-23-phase-4-callsite-migration-internal-drop-mode-slice-b.md`
- Next allowed action: continue Phase 4 bounded slices.

## 2026-02-23: Stop-Point 4 (Callsite migration slice C)
- Phase/Stop point: Phase 4 slice C completion
- Decision: approved canonical runtime prop callsites (`propertiesCreate`, `referenceGrid*`) and canonical panel/grid symbol usage in active AI Studio tests while preserving deprecated aliases.
- Preconditions reviewed:
  - targeted suites pass for touched modules
  - `validate` and `test:adaptive-v2-gate` pass
  - perf release check remains blocked by missing `PLAYWRIGHT_AUDIT_EMAIL`
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-4/2026-02-23-phase-4-callsite-migration-canonical-props-and-tests-slice-c.md`
- Next allowed action: continue Phase 4 bounded slices focused on remaining legacy file/symbol families before Phase 5 path renames.

## 2026-02-23: Stop-Point 4 (Callsite migration slice D)
- Phase/Stop point: Phase 4 slice D completion
- Decision: approved canonical ownership of reference-grid hook implementation in `useAiStudioReferenceGridProps`, with `useAiStudioReferenceCanvasProps` retained as a compatibility wrapper alias.
- Preconditions reviewed:
  - targeted hook/shell suites pass
  - `validate` and `test:adaptive-v2-gate` pass
  - Playwright perf gate intentionally not executed in this run per explicit user direction
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-4/2026-02-23-phase-4-reference-grid-hook-canonicalization-slice-d.md`
- Next allowed action: continue Phase 4 bounded slices for residual symbol families, then prepare Phase 5 file/path rename batch plan.

## 2026-02-23: Stop-Point 4 (Callsite migration slice E)
- Phase/Stop point: Phase 4 slice E completion
- Decision: approved canonical file ownership for create panel implementation in `CreatePropertiesPanel.tsx`, with `TextPropertiesPanel.tsx` retained as a compatibility wrapper alias.
- Preconditions reviewed:
  - targeted create-panel/page suites pass
  - `validate`, `test:adaptive-v2-gate`, and production `build` pass
  - Playwright perf gate intentionally not executed per explicit no-Playwright direction
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-4/2026-02-23-phase-4-create-panel-file-ownership-canonicalization-slice-e.md`
- Next allowed action: continue Phase 4 bounded slices for residual reference-grid/canvas file-ownership and alias families; then Phase 5 path rename planning.

## 2026-02-23: Stop-Point 4 (Callsite migration slice F)
- Phase/Stop point: Phase 4 slice F completion
- Decision: approved canonical file ownership for reference-grid implementation in `ReferenceGrid.tsx`, with `ReferenceCanvas.tsx` retained as a compatibility wrapper alias.
- Preconditions reviewed:
  - targeted reference-grid/canvas suites pass
  - `validate`, `test:adaptive-v2-gate`, and production `build` pass
  - Playwright perf gate intentionally not executed per explicit no-Playwright direction
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-4/2026-02-23-phase-4-reference-grid-file-ownership-canonicalization-slice-f.md`
- Next allowed action: continue Phase 4 cleanup for remaining legacy symbol/file-name usage in tests/scripts/docs references before Phase 5 path rename batches.

## 2026-02-23: Stop-Point 4 (Callsite migration slice G)
- Phase/Stop point: Phase 4 slice G completion
- Decision: approved internal reference-grid symbol canonicalization (`ReferenceGridSections`, `ReferenceGridArchiveControls`, `ReferenceGridCard`) with deprecated `ReferenceCanvas*` aliases preserved.
- Preconditions reviewed:
  - targeted reference-grid suites pass
  - `validate`, `test:adaptive-v2-gate`, and production `build` pass
  - Playwright perf gate intentionally not executed per explicit no-Playwright direction
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-4/2026-02-23-phase-4-reference-grid-internal-symbol-canonicalization-slice-g.md`
- Next allowed action: continue Phase 4 cleanup for remaining legacy test/script/doc references, then prepare Phase 5 file/path rename batches.

## 2026-02-23: Stop-Point 5 (File/path rename batch A)
- Phase/Stop point: Phase 5 batch A completion
- Decision: approved internal reference-grid component file path canonicalization (`ReferenceGridArchiveControls.tsx`, `ReferenceGridSections.tsx`, `ReferenceGridCard.tsx`) with legacy-path shim files retained.
- Preconditions reviewed:
  - targeted reference-grid suites pass
  - `validate`, `test:adaptive-v2-gate`, `build`, `docs:check`, `check:architecture-boundary`, and `check:size-budget` pass
  - Playwright perf gate intentionally not executed per explicit no-Playwright direction
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-5/2026-02-23-phase-5-reference-grid-internal-file-path-canonicalization-batch-a.md`
- Next allowed action: continue Phase 5 in bounded batches for remaining legacy file-name families (tests/hooks/wrappers/assets) using the same shim-first strategy.

## 2026-02-23: Stop-Point 5 (File/path rename batch B)
- Phase/Stop point: Phase 5 batch B completion
- Decision: approved drop-controller canonicalization to `useReferenceGridDropController` (file path + primary symbol), retaining legacy path/symbol compatibility aliases.
- Preconditions reviewed:
  - targeted reference-grid suites pass
  - `validate`, `test:adaptive-v2-gate`, `build`, `docs:check`, `check:architecture-boundary`, and `check:size-budget` pass
  - Playwright perf gate intentionally not executed per explicit no-Playwright direction
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-5/2026-02-23-phase-5-reference-grid-drop-controller-path-canonicalization-batch-b.md`
- Next allowed action: continue Phase 5 shim-first canonicalization batches for remaining legacy file-name families.

## 2026-02-23: Stop-Point 5 (File/path rename batch C)
- Phase/Stop point: Phase 5 batch C completion
- Decision: approved canonical test file path migration (`ReferenceGrid*`, `CreatePropertiesPanel*`, `useAiStudioReferenceGridProps*`) and adaptive gate script alignment.
- Preconditions reviewed:
  - targeted renamed suites pass
  - `validate`, `test:adaptive-v2-gate`, `build`, `docs:check`, `check:architecture-boundary`, and `check:size-budget` pass
  - Playwright perf gate intentionally not executed per explicit no-Playwright direction
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-5/2026-02-23-phase-5-test-and-gate-script-path-canonicalization-batch-c.md`
- Next allowed action: continue Phase 5 bounded batches for remaining runtime/file wrapper legacy families and asset-path canonicalization prep.

## 2026-02-23: Stop-Point 4 (Phase closeout audit)
- Phase/Stop point: Phase 4 closeout
- Decision: approved Phase 4 completion; legacy naming usage in `frontend` callsites is now confined to explicit compatibility bridges and deprecated alias surfaces.
- Preconditions reviewed:
  - targeted callsite scan shows no active runtime consumer usage of legacy prop/file-input/handler names outside bridge points
  - all Phase 4 slices A-G completed with passing non-Playwright validation evidence
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-4/2026-02-23-phase-4-callsite-migration-runtime-slice-a.md`
  - `docs/planning/evidence/naming-canonicalization/phase-4/2026-02-23-phase-4-callsite-migration-internal-drop-mode-slice-b.md`
  - `docs/planning/evidence/naming-canonicalization/phase-4/2026-02-23-phase-4-callsite-migration-canonical-props-and-tests-slice-c.md`
  - `docs/planning/evidence/naming-canonicalization/phase-4/2026-02-23-phase-4-reference-grid-hook-canonicalization-slice-d.md`
  - `docs/planning/evidence/naming-canonicalization/phase-4/2026-02-23-phase-4-create-panel-file-ownership-canonicalization-slice-e.md`
  - `docs/planning/evidence/naming-canonicalization/phase-4/2026-02-23-phase-4-reference-grid-file-ownership-canonicalization-slice-f.md`
  - `docs/planning/evidence/naming-canonicalization/phase-4/2026-02-23-phase-4-reference-grid-internal-symbol-canonicalization-slice-g.md`
- Next allowed action: continue Phase 5 file/path canonicalization and Phase 6 asset-path dual-path rollout planning.

## 2026-02-23: Stop-Point 6 (Asset canonicalization batch A)
- Phase/Stop point: Phase 6 batch A completion
- Decision: approved canonical public asset path migration for active AI Studio + dashboard/saved-creators references, with legacy asset files retained for dual-path compatibility.
- Preconditions reviewed:
  - targeted suites pass for touched surfaces
  - `validate`, `test:adaptive-v2-gate`, `build`, `docs:check`, `check:architecture-boundary`, and `check:size-budget` pass
  - Playwright perf gate intentionally not executed per explicit no-Playwright direction
- Evidence links:
  - `docs/planning/evidence/naming-canonicalization/phase-6/2026-02-23-phase-6-asset-path-canonicalization-batch-a.md`
- Next allowed action: continue Phase 6 with residual asset inventory/sunset prep, then Phase 7 alias-sunset entry planning after stability window.

## Stop-Point Approval Template
- Date:
- Phase/Stop point:
- Approver:
- Decision:
- Preconditions reviewed:
- Evidence links:
- Next allowed action:
