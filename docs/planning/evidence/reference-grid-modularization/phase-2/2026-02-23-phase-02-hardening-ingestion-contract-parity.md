# Phase 2 Hardening: Ingestion Contract Parity

Date (UTC): 2026-02-23
Phase: 2 (Ingestion Unification Hardening)
Owner: Frontend
Program doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`
Tracker doc: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Scope
In scope:
1. Close post-implementation ingestion deltas before Phase 3 promotion.
2. Preserve no-regression behavior while tightening canonical contract fidelity.
3. Expand contract tests for picker/drop source parity and library full/preview URL semantics.

Out of scope:
1. Phase 3 projection semantics extraction.
2. Media runtime unification.
3. Keyboard quick-slot reorder implementation.

## Files Updated
- `frontend/features/ai-studio/reference-ingestion/buildFromInput.ts`
- `frontend/features/ai-studio/reference-ingestion/__tests__/buildFromInput.test.ts`
- `frontend/features/ai-studio/logic/stateParsers.ts`
- `frontend/features/ai-studio/logic/__tests__/stateParsers.uploads.test.ts`
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- `frontend/features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx`

## Behavioral Notes
- Canonical ingestion now preserves full-url intent for library media via `resultUrls` while retaining `previewUrl` contract.
- File ingestion source is now explicit in low-level upload mapping (`filePicker` vs `drop`) and covered by ingestion tests.
- Upload mapping now dedupes identical file entries across picker/drop pathways to remove source-path divergence.
- Media-library selection payload now preserves distinct `previewStoragePath` and `fullStoragePath` values.

## Tests Run
| Command | Result | Notes |
| --- | --- | --- |
| `npm -C frontend run test -- features/ai-studio/reference-ingestion/__tests__/buildFromInput.test.ts features/ai-studio/logic/__tests__/stateParsers.uploads.test.ts features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx` | Pass | 25 tests passing |
| `npm -C frontend run type-check` | Pass | no type errors |
| `npm -C frontend run lint` | Pass | no lint errors |
| `npm -C frontend run check:architecture-boundary` | Pass | boundary guardrail green |
| `npm -C frontend run docs:check` | Pass | docs governance checks green |
| `npm -C frontend run check:size-budget` | Pass (warn lane expected) | legacy hotspots still above target caps |

## Regression Review
- Regressions found: none in hardened ingestion and modal selection pathways.
- Non-blocking test noise (pre-existing):
  - React `act(...)` warning in `MediaLibraryModal` test.
  - unresolved preview row console logs in modal tests.

## Remaining Open Deltas
1. End-to-end integration coverage for flow: media-library select -> reference insertion -> quick-slot reorder -> archive/restore.
2. Keyboard quick-slot reorder interaction parity coverage in curated UI tests.

## Rollback Readiness
- Rollback path: revert this hardening commit and keep prior Phase 2 foundation commit intact.
- Estimated rollback time: <= 30 minutes.

## Promotion Decision
- Decision: Conditional go for next implementation slice; Phase 3 kickoff remains held until remaining open deltas are closed or formally waived.
