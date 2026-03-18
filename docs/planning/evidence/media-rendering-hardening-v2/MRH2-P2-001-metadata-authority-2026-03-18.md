# MRH2-P2-001 Evidence Packet (2026-03-18)

## Slice
- `MRH2-P2-001`
- Lane: `Pipeline`
- Phase: `P2`
- Surface: `metadata`

## Scope Closed
- Preserve canonical source image dimensions when derivative thumbs are generated.
- Make missing image dimensions explicit in canonical metadata instead of silently omitting width/height truth.
- Prefer persisted durable preview assets over request preview hints in `copy-from-url` delivery resolution.

## Code Changes
- [mediaDimensionMetadata.ts](../../../../frontend/lib/mediaDimensionMetadata.ts)
- [mediaPreviewPath.ts](../../../../frontend/lib/mediaPreviewPath.ts)
- [processMediaDerivative.ts](../../../../frontend/lib/server/mediaDerivatives/processMediaDerivative.ts)
- [run.ts](../../../../frontend/pages/api/internal/media-derivatives/run.ts)
- [copy-from-url.ts](../../../../frontend/pages/api/media/copy-from-url.ts)

## Targeted Tests
- `npm test -- --run lib/__tests__/mediaDimensionMetadata.test.ts lib/__tests__/mediaPreviewPath.test.ts lib/server/mediaDerivatives/__tests__/processMediaDerivative.test.ts tests/api/internal-media-derivatives-run.test.ts`

## Full Gates
- `npm run lint`
- `npm run type-check`
- `npm run build`
- `npm run docs:check`

## Results
- Targeted tests: pass
- `lint`: pass with pre-existing unrelated warnings only
- `type-check`: pass
- `build`: pass
- `docs:check`: pass

## Risk Review
- Canonical metadata now emits explicit `dimension_status` / `dimension_source`; callers that depended on dimension-key absence should be watched.
- `copy-from-url` now trusts persisted preview/storage authority before request hints, which is intended and validated by shared preview-path tests plus type/build coverage.

## Rollback
- Revert this slice to restore prior metadata canonicalization, derivative ready-width behavior, and request-hint preview precedence.
