# MRH2-P3-001 Evidence Packet (2026-03-18)

## Slice
- `MRH2-P3-001`
- Lane: `Surface`
- Phase: `P3`
- Surface: `hot-path surfaces`

## Scope Closed
- Make the AI Studio media-library panel a first-class adaptive surface instead of inheriting modal-grid semantics indirectly.
- Preserve durable preview assets on protected hot paths so reference-grid compaction does not reprocess stored preview variants.
- Keep route/modal/reference-grid parity aligned with the accepted derivative-first surface policy.

## Code Changes
- [types.ts](../../../../frontend/lib/adaptive-media/types.ts)
- [flags.ts](../../../../frontend/lib/adaptive-media/flags.ts)
- [policy.ts](../../../../frontend/lib/adaptive-media/policy.ts)
- [mediaLibraryAdaptivePreview.ts](../../../../frontend/features/media-library/logic/mediaLibraryAdaptivePreview.ts)
- [MediaLibraryPanel.tsx](../../../../frontend/features/ai-studio/components/MediaLibraryPanel.tsx)
- [referenceGridMedia.ts](../../../../frontend/features/ai-studio/logic/referenceGridMedia.ts)

## Targeted Tests
- `npm test -- --run lib/adaptive-media/__tests__/flags.test.ts features/media-library/logic/__tests__/mediaLibraryAdaptivePreview.test.ts features/ai-studio/logic/__tests__/referenceGridMedia.test.ts features/ai-studio/logic/__tests__/referenceGridMedia.parity.test.ts features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx`

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
- Panel adaptive behavior is now explicitly owned by `media-library-panel-grid`; route/modal flags no longer implicitly change panel behavior.
- Reference-grid still supports adaptive compaction for mixed-source assets, but durable stored preview assets now bypass re-compaction so the derivative-first contract survives the surface layer.
- Telemetry fields such as `preview_delivery_mode` remain partially profile-derived in the media-library signing controller. That drift is outside this slice and does not change render-source correctness.

## Rollback
- Revert this slice to restore modal-grid-derived panel adaptive behavior and previous reference-grid adaptive compaction handling for signed durable preview assets.
