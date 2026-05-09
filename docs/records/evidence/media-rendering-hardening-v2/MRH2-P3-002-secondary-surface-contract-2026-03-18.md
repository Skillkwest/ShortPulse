# MRH2-P3-002 Evidence Packet (2026-03-18)

## Slice
- `MRH2-P3-002`
- Lane: `Surface`
- Phase: `P3`
- Surface: `character+quick-swap+detail+modal-preview`

## Scope Closed
- Preserve durable preview assets on character-grid and quick-swap card surfaces instead of reprocessing obvious stored variant URLs.
- Lock panel preview modal behavior to the resolved selection URL so the preview/detail path stays deliberate rather than inheriting card-preview semantics by accident.
- Lock detail-modal behavior to the resolved full-quality URL so full-quality hero rendering remains explicit and tested.
- Confirm the Media Library file modal remains on the direct signed focused-file path without introducing new preview-transform behavior.

## Code Changes
- [CharacterManagerShell.tsx](../../../../frontend/features/character-manager/components/CharacterManagerShell.tsx)
- [characterGridPreviewUrl.ts](../../../../frontend/features/character-manager/logic/characterGridPreviewUrl.ts)

## Tests Added Or Updated
- [characterGridPreviewUrl.test.ts](../../../../frontend/features/character-manager/logic/__tests__/characterGridPreviewUrl.test.ts)
- [useMediaLibraryPanelSelectionController.test.tsx](../../../../frontend/features/ai-studio/hooks/__tests__/useMediaLibraryPanelSelectionController.test.tsx)
- [DetailModal.fullQuality.test.tsx](../../../../frontend/features/ai-studio/components/__tests__/DetailModal.fullQuality.test.tsx)

Additional targeted coverage rerun:
- Historical file at slice time: `features/character-manager/components/__tests__/CharacterQuickSwapDeckSection.windowing.test.tsx` (no longer present in the current repo tree)
- Historical file at slice time: `features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx` (no longer present in the current repo tree)

## Targeted Tests
- `npm test -- --run features/character-manager/logic/__tests__/characterGridPreviewUrl.test.ts features/ai-studio/hooks/__tests__/useMediaLibraryPanelSelectionController.test.tsx features/ai-studio/components/__tests__/DetailModal.fullQuality.test.tsx features/character-manager/components/__tests__/CharacterQuickSwapDeckSection.windowing.test.tsx features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx`

## Full Gates
- `npm run test:adaptive-v2-gate`
- `npm run type-check`
- `npm run build`
- `npm run docs:check`
- `npm run check:architecture-boundary`
- `npm run check:size-budget`

## Results
- Targeted tests: pass
- `test:adaptive-v2-gate`: pass
- `type-check`: pass
- `build`: pass
- `docs:check`: pass
- `check:architecture-boundary`: pass
- `check:size-budget`: pass with pre-existing warn-mode size budget findings only

## Risk Review
- Character-grid and quick-swap still render through `next/image` with `unoptimized` in key paths. This slice intentionally did not replace those renderers; it tightened the preview-source contract instead.
- Detail-modal and panel preview modal behavior is now explicitly tested around full/direct URL preference, which reduces future drift risk without widening the slice into renderer rewrites.
- Media Library file modal behavior remained on the existing direct focused-file signed path in [media-library.tsx](../../../../frontend/pages/media-library.tsx); no code change was needed there for this slice.

## Rollback
- Revert this slice to restore the previous inline character-grid preview helper and remove the new secondary-surface policy tests.
