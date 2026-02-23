# Naming Canonicalization Tracker

Status key: `pending` | `in_progress` | `blocked` | `completed`

## Phase Status

| Phase | Status | Owner | Exit criteria | Evidence |
| --- | --- | --- | --- | --- |
| 0 Baseline freeze | blocked | Frontend + Docs | Baseline gates captured and canonical map frozen | `docs/planning/evidence/naming-canonicalization/phase-0/` |
| 1 Active docs canonicalization | completed | Docs | Active docs path/naming drift resolved | `docs/planning/evidence/naming-canonicalization/phase-1/` |
| 2 User-facing copy canonicalization | pending | Frontend | UI copy canonical with no UX regressions | `docs/planning/evidence/naming-canonicalization/phase-2/` |
| 3 Bridge layer (expand) | completed | Frontend | Canonical aliases added and backward compatibility preserved | `docs/planning/evidence/naming-canonicalization/phase-3/` |
| 4 Callsite migration (migrate) | in_progress | Frontend | Legacy callsites migrated in bounded slices | `docs/planning/evidence/naming-canonicalization/phase-4/` |
| 5 File/path renames | pending | Frontend | Renamed files stable with shim strategy | `docs/planning/evidence/naming-canonicalization/phase-5/` |
| 6 Asset canonicalization | pending | Frontend | Canonical asset paths in use with dual-path window | `docs/planning/evidence/naming-canonicalization/phase-6/` |
| 7 Alias sunset (contract) | pending | Frontend + Docs | Alias removals approved after stability window | `docs/planning/evidence/naming-canonicalization/phase-7/` |

## Slice Log

| Date | Slice | Status | Scope | Validation | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-02-23 | Program docs + baseline scaffold | blocked | Planning/docs governance artifacts | partial pass | Perf release check blocked by missing audit credentials (`PLAYWRIGHT_AUDIT_EMAIL`) |
| 2026-02-23 | Phase 1 active docs canonicalization | completed | Active docs naming/path drift | pass | Evidence: `phase-1/2026-02-23-phase-1-active-docs-canonicalization.md` |
| 2026-02-23 | Phase 3 bridge layer aliases | completed | Canonical export/type/hook aliases and shims | pass | Evidence: `phase-3/2026-02-23-phase-3-bridge-layer-expand.md` |
| 2026-02-23 | Phase 4 runtime callsite migration slice A | completed | Runtime imports and prop keys | pass (perf blocked) | Evidence: `phase-4/2026-02-23-phase-4-callsite-migration-runtime-slice-a.md` |
| 2026-02-23 | Phase 4 internal type migration slice B | completed | Reference-grid drop-mode type symbol migration | pass | Evidence: `phase-4/2026-02-23-phase-4-callsite-migration-internal-drop-mode-slice-b.md` |

## Active Risks
1. Perf-release gate cannot execute without Playwright audit credentials in environment.
2. Residual `ReferenceCanvas*` symbol families remain in lower-level reference-grid internal modules.
3. File/path rename phase can silently break imports without explicit shim coverage.
