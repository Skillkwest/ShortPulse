# MRH2-P7-002 Evidence Packet (2026-03-18)

## Slice
- `MRH2-P7-002`
- Lane: `Surface`
- Phase: `P7`
- Surface: `guardrails`

## Scope Closed
- Add enforceable media-rendering size budgets for the shared render-contract hotspots that changed during `P2`, `P3`, and `P7`.
- Add enforceable architecture-boundary rules for adaptive-media and media-library logic so shared render foundations cannot silently drift back toward UI-layer coupling.
- Publish one repo-native validation command for media-rendering guardrail enforcement instead of relying on ad hoc environment-variable bundles.

## Code Changes
- [check_size_budgets.js](../../../../scripts/check_size_budgets.js)
- [check_architecture_boundaries.js](../../../../scripts/check_architecture_boundaries.js)
- [package.json](../../../../frontend/package.json)
- [sop_media_performance_operations.md](../../../sops/sop_media_performance_operations.md)

## Guardrails Added
- `MEDIA_RENDERING_SIZE_BUDGET_MODE`
  - Enforces current no-bloat ceilings for:
    - `frontend/features/ai-studio/components/ReferenceGrid.tsx`
    - `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
    - `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
    - `frontend/features/ai-studio/logic/referenceGridMedia.ts`
    - `frontend/features/media-library/components/MediaAssetGallery.tsx`
    - `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`
    - `frontend/lib/adaptive-media/resolver.ts`
    - `frontend/lib/mediaPreviewPath.ts`
- `MEDIA_RENDERING_BOUNDARY_MODE`
  - Enforces that:
    - `frontend/lib/adaptive-media/*`
    - `frontend/features/media-library/logic/*`
    do not import page/component/hook layers from AI Studio, Media Library, or Character Manager.
- `npm run validate:media-rendering-guardrails`
  - Runs the media-rendering size-budget enforcement bundle, the required boundary checks, and `docs:check`.

## Validation
- `npm run validate:media-rendering-guardrails`
- `npm run lint`
- `npm run type-check`
- `npm run build`

## Results
- `validate:media-rendering-guardrails`: pass
- `lint`: pass with the same two pre-existing unrelated warnings
- `type-check`: pass
- `build`: pass

## Explicit Warn-Mode Carryover
- The older `REFERENCE_GRID_TARGET_BUDGETS` group remains a separate warn-mode carryover:
  - `frontend/features/ai-studio/components/ReferenceGrid.tsx` remains above the older `900`-line target.
  - `frontend/features/ai-studio/hooks/useAiStudioState.ts` remains above its older `650`-line target.
- This slice does not treat those legacy warn-mode targets as authoritative blockers for media-rendering hardening. The new media-rendering enforcement group is the active no-bloat guardrail for this program surface.

## Risk Review
- The new boundary rules are intentionally limited to shared render foundations (`adaptive-media` and `media-library/logic`) to avoid noisy false positives in feature-specific UI modules.
- The enforced size ceilings are set slightly above current line counts where needed so the repo gains real regression protection immediately without inventing artificial failure churn.
- Existing stricter warn-mode target budgets remain visible, which preserves future shrink incentives without blocking the current surface lane on unrelated hotspot decomposition.

## Rollback
- Revert this slice to remove the dedicated media-rendering guardrail modes and the combined validation command.
