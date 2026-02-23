# Adaptive Media Change Control SOP

Purpose: prevent regressions while continuing development in other AI Studio and media-related pipelines.

## Scope
- Adaptive Media V2 module and policy/resolver paths.
- AI Studio Reference Grid + Quick Slot rendering paths.
- AI Studio Media Library modal grid and Character Manager grid/detail usage of adaptive delivery.

## Protected Code Paths
- `frontend/lib/adaptive-media/**`
- `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- `frontend/features/ai-studio/logic/referenceGridMedia.ts`
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- `frontend/features/ai-studio/reference-domain/**`
- `frontend/features/ai-studio/reference-ingestion/**`
- `frontend/features/ai-studio/reference-projections/**`
- `frontend/features/ai-studio/reference-media-runtime/**`
- `frontend/features/ai-studio/reference-dnd/**`
- `frontend/features/character-manager/components/CharacterManagerShell.tsx`
- `frontend/features/ai-studio/components/DetailModal.tsx`

## Baseline And Rollback
1. Keep the known-good checkpoint commit available:
- `31107ba8`
2. Tag and retain a rollback anchor before major adaptive changes.
3. Keep kill-switch support enabled:
- `NEXT_PUBLIC_MEDIA_ADAPTIVE_V2_FORCE_FULL_QUALITY`

## Required Automated Gate
Run this command for any PR touching protected paths:

```bash
cd frontend
npm run test:adaptive-v2-gate
```

This gate currently includes:
- `lint`
- `type-check`
- `ReferenceGrid.curated` suite
- `referenceGridMedia` + parity suites
- `MediaLibraryModal` suite
- `CharacterManagerShell.behavior` suite
- `adaptive-media policy` suite
- `check:architecture-boundary` (reference-grid boundary lane)
- `check:size-budget` (reference-grid budget lane)

## Reference Grid Foundation Program Controls
- Program plan: `docs/planning/ai-studio-reference-grid-modularization-program.md`
- Tracker: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
- Evidence root: `docs/planning/evidence/reference-grid-modularization/`
- CI mode variables:
  - `REFERENCE_GRID_BOUNDARY_MODE=warn|enforce`
  - `REFERENCE_GRID_SIZE_BUDGET_MODE=warn|enforce`
- Closeout requirement:
  - promote both variables to `enforce` only after phase-6 evidence packet is complete.

## Required Manual Smoke (10-15 minutes)
1. Ingress coverage:
- upload file
- drag/drop reference
- paste URL
- media-library select
- generated output
2. Surface coverage:
- Reference Grid
- Quick Slot
- AI Studio media-library modal grid
- Character manager/panel grids
3. Detail coverage:
- AI Studio detail modal opens on double click
- Character detail/overlay uses full-quality path
4. Failure checks:
- No stuck `loading preview...` or `generating...` cards
- No broken image placeholders after normal interactions
- No sustained flicker loops

## Change Policy
1. Keep changes small and scoped.
2. Avoid mixing adaptive policy tuning with unrelated feature work.
3. Do not remove or weaken adaptive parity/regression tests without replacing coverage.
4. Treat one-off visual flashes as separate stabilization work unless reproducible/blocking.

## PR Requirements
- Include test evidence for `test:adaptive-v2-gate`.
- Include evidence for `check:architecture-boundary` and `check:size-budget` when touching protected paths.
- Note active adaptive flags used during QA.
- Include any known low-severity issues and whether they are blocking or deferred.

## Deferred Stabilization Track
- Keep rare, non-reproducible visual instability work in backlog as non-blocking follow-up.
- Schedule stabilization work as dedicated PR(s) after feature checkpoint sign-off.
