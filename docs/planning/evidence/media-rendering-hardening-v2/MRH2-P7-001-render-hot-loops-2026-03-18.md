# MRH2-P7-001 Evidence Packet (2026-03-18)

## Slice
- `MRH2-P7-001`
- Lane: `Surface`
- Phase: `P7`
- Surface: `render hot loops`

## Scope Closed
- Remove avoidable full-list allocation from media-library masonry virtualization math.
- Stop building a separate id-to-item map in the virtualization hook when visible-window indexes already provide direct item lookup.
- Keep the layout result and visible ordering deterministic while reducing hot-loop work on every viewport/layout pass.

## Code Changes
- [mediaGridVirtualization.ts](../../../../frontend/features/media-library/logic/mediaGridVirtualization.ts)
- [useMediaMasonryVirtualization.ts](../../../../frontend/features/media-library/hooks/useMediaMasonryVirtualization.ts)

## Tests Updated
- [mediaGridVirtualization.test.ts](../../../../frontend/features/media-library/logic/__tests__/mediaGridVirtualization.test.ts)

## Targeted Tests
- `npm test -- --run features/media-library/logic/__tests__/mediaGridVirtualization.test.ts`

## Full Gates
- `npm run type-check`
- `npm run build`
- `npm run docs:check`
- `npm run check:architecture-boundary`
- `npm run check:size-budget`
- `npm run perf:ai-studio:release-check`

## Results
- Targeted tests: pass
- `type-check`: pass
- `build`: pass
- `docs:check`: pass
- `check:architecture-boundary`: pass
- `check:size-budget`: pass with pre-existing warn-mode size budget findings only
- `perf:ai-studio:release-check`: blocked locally because `PLAYWRIGHT_AUDIT_EMAIL` is not configured in this environment

## Risk Review
- The returned layout contract no longer includes a full `items` array because no production caller consumes it; only the visible window remains materialized.
- `useMediaMasonryVirtualization` now resolves visible items by `entry.index`, which removes a full-list map allocation while preserving deterministic ordering from the layout math.
- Because the authenticated perf gate could not run locally, this slice should be treated as functionally validated but awaiting perf-audit confirmation in an environment with Playwright audit credentials.

## Rollback
- Revert this slice to restore full layout-item materialization and id-map lookup in the media-library virtualization hot path.
