# Naming Canonicalization Tracker

Status key: `pending` | `in_progress` | `blocked` | `completed`

## Phase Status

| Phase | Status | Owner | Exit criteria | Evidence |
| --- | --- | --- | --- | --- |
| 0 Baseline freeze | blocked | Frontend + Docs | Baseline gates captured and canonical map frozen | `docs/planning/evidence/naming-canonicalization/phase-0/` |
| 1 Active docs canonicalization | completed | Docs | Active docs path/naming drift resolved | `docs/planning/evidence/naming-canonicalization/phase-1/` |
| 2 User-facing copy canonicalization | completed | Frontend | UI copy canonical with no UX regressions | `docs/planning/evidence/naming-canonicalization/phase-2/` |
| 3 Bridge layer (expand) | completed | Frontend | Canonical aliases added and backward compatibility preserved | `docs/planning/evidence/naming-canonicalization/phase-3/` |
| 4 Callsite migration (migrate) | completed | Frontend | Legacy callsites migrated in bounded slices | `docs/planning/evidence/naming-canonicalization/phase-4/` |
| 5 File/path renames | in_progress | Frontend | Renamed files stable with shim strategy | `docs/planning/evidence/naming-canonicalization/phase-5/` |
| 6 Asset canonicalization | in_progress | Frontend | Canonical asset paths in use with dual-path window | `docs/planning/evidence/naming-canonicalization/phase-6/` |
| 7 Alias sunset (contract) | in_progress | Frontend + Docs | Alias removals approved after stability window | `docs/planning/evidence/naming-canonicalization/phase-7/` |

## Slice Log

| Date | Slice | Status | Scope | Validation | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-02-23 | Program docs + baseline scaffold | blocked | Planning/docs governance artifacts | partial pass | Perf release check blocked by missing audit credentials (`PLAYWRIGHT_AUDIT_EMAIL`) |
| 2026-02-23 | Phase 1 active docs canonicalization | completed | Active docs naming/path drift | pass | Evidence: `phase-1/2026-02-23-phase-1-active-docs-canonicalization.md` |
| 2026-02-23 | Phase 1 active SOP canonical terminology sweep | completed | Canonicalized residual active SOP references from `TextPropertiesPanel`/`ReferenceCanvas` to `CreatePropertiesPanel`/`ReferenceGrid` | pass | Evidence: `phase-1/2026-02-23-phase-1-active-sops-canonical-terminology-sweep.md` |
| 2026-02-23 | Phase 2 user-facing copy canonicalization | completed | Verified user-facing AI Studio vocabulary is canonical (`Reference Grid`, `Create`) with no legacy UI terms exposed | pass (non-Playwright gates) | Evidence: `phase-2/2026-02-23-phase-2-user-facing-copy-canonicalization.md` |
| 2026-02-23 | Phase 3 bridge layer aliases | completed | Canonical export/type/hook aliases and shims | pass | Evidence: `phase-3/2026-02-23-phase-3-bridge-layer-expand.md` |
| 2026-02-23 | Phase 4 runtime callsite migration slice A | completed | Runtime imports and prop keys | pass (perf blocked) | Evidence: `phase-4/2026-02-23-phase-4-callsite-migration-runtime-slice-a.md` |
| 2026-02-23 | Phase 4 internal type migration slice B | completed | Reference-grid drop-mode type symbol migration | pass | Evidence: `phase-4/2026-02-23-phase-4-callsite-migration-internal-drop-mode-slice-b.md` |
| 2026-02-23 | Phase 4 canonical props/tests migration slice C | completed | Canonical page callsites and panel/grid test symbols | pass (perf blocked) | Evidence: `phase-4/2026-02-23-phase-4-callsite-migration-canonical-props-and-tests-slice-c.md` |
| 2026-02-23 | Phase 4 reference-grid hook canonicalization slice D | completed | Canonical hook implementation ownership with legacy wrapper alias | pass (non-Playwright gates) | Evidence: `phase-4/2026-02-23-phase-4-reference-grid-hook-canonicalization-slice-d.md` |
| 2026-02-23 | Phase 4 create panel file-ownership canonicalization slice E | completed | Canonical create panel file ownership with legacy wrapper alias | pass (non-Playwright gates) | Evidence: `phase-4/2026-02-23-phase-4-create-panel-file-ownership-canonicalization-slice-e.md` |
| 2026-02-23 | Phase 4 reference-grid file-ownership canonicalization slice F | completed | Canonical reference-grid file ownership with legacy wrapper alias | pass (non-Playwright gates) | Evidence: `phase-4/2026-02-23-phase-4-reference-grid-file-ownership-canonicalization-slice-f.md` |
| 2026-02-23 | Phase 4 reference-grid internal symbol canonicalization slice G | completed | Canonical internal `ReferenceGrid*` symbols for sections/card/archive controls with alias compatibility | pass (non-Playwright gates) | Evidence: `phase-4/2026-02-23-phase-4-reference-grid-internal-symbol-canonicalization-slice-g.md` |
| 2026-02-23 | Phase 5 file/path canonicalization batch A | completed | Internal `ReferenceCanvas*` reference-grid component file names renamed to canonical `ReferenceGrid*` paths with legacy-path shim files | pass (non-Playwright gates) | Evidence: `phase-5/2026-02-23-phase-5-reference-grid-internal-file-path-canonicalization-batch-a.md` |
| 2026-02-23 | Phase 5 file/path canonicalization batch B | completed | Drop-controller file path and primary hook symbol canonicalized to `useReferenceGridDropController` with legacy path/symbol compatibility retained | pass (non-Playwright gates) | Evidence: `phase-5/2026-02-23-phase-5-reference-grid-drop-controller-path-canonicalization-batch-b.md` |
| 2026-02-23 | Phase 5 file/path canonicalization batch C | completed | Canonicalized AI Studio test file paths (`ReferenceGrid*`, `CreatePropertiesPanel*`, `useAiStudioReferenceGridProps*`) and aligned adaptive gate script/skill references | pass (non-Playwright gates) | Evidence: `phase-5/2026-02-23-phase-5-test-and-gate-script-path-canonicalization-batch-c.md` |
| 2026-02-23 | Phase 4 closeout audit | completed | Confirmed legacy naming usage in `frontend` callsites is limited to explicit compatibility bridges/deprecated aliases | pass (non-Playwright gates) | Evidence: `phase-4/` slices A-G + callsite audit |
| 2026-02-23 | Phase 6 asset canonicalization batch A | completed | Canonicalized active logo/background asset paths to lowercase/kebab-case filenames with legacy files retained | pass (non-Playwright gates) | Evidence: `phase-6/2026-02-23-phase-6-asset-path-canonicalization-batch-a.md` |
| 2026-02-23 | Phase 6 asset canonicalization batch B | completed | Canonicalized dashboard media-library card image path, corrected Saved Creators SOP asset naming drift, and recorded residual legacy asset inventory for sunset planning | pass (non-Playwright gates) | Evidence: `phase-6/2026-02-23-phase-6-asset-path-canonicalization-batch-b.md`, `phase-6/2026-02-23-phase-6-residual-asset-inventory.md` |
| 2026-02-23 | Phase 7 contract entry readiness + drift guard | completed | Added alias-sunset readiness plan and enforced active-doc canonical naming checks in `docs:check` | pass (non-Playwright gates) | Evidence: `phase-7/2026-02-23-phase-7-entry-readiness-and-drift-guard.md` |
| 2026-02-23 | Phase 7 runtime legacy usage guard | completed | Added runtime guard to keep legacy alias terms confined to approved compatibility files and wired it into `validate` | pass (non-Playwright gates) | Evidence: `phase-7/2026-02-23-phase-7-runtime-legacy-usage-guard.md` |

## Active Risks
1. Perf-release gate is intentionally deferred in this execution track because Playwright runs are out-of-scope.
2. Residual legacy symbol families remain in compatibility aliases and runtime/file wrapper paths (`ReferenceCanvas*`, `TextPropertiesPanel*`).
3. Some legacy public asset filenames still exist intentionally during dual-path compatibility window; residual inventory is now tracked for explicit sunset batching.
4. Alias sunset removal cannot begin until two release cycles complete with no naming regressions.
