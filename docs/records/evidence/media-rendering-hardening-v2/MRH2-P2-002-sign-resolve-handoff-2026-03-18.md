# MRH2-P2-002 Evidence Packet (2026-03-18)

## Slice
- `MRH2-P2-002`
- Lane: `Pipeline`
- Phase: `P2`
- Surface: `sign+resolve handoff`

## Scope Closed
- Make `sign-batch`, `resolve-previews`, and initial `media/list` signing treat stored preview variants as primary server truth.
- Remove transform-backed signed URL generation from steady-state route behavior.
- Preserve surface/profile telemetry headers while making actual signing behavior path-authoritative instead of transform-authoritative.

## Code Changes
- [sign-batch.ts](../../../../frontend/pages/api/media/sign-batch.ts)
- [resolve-previews.ts](../../../../frontend/pages/api/media/resolve-previews.ts)
- [list.ts](../../../../frontend/pages/api/media/list.ts)

## Targeted Tests
- `npm test -- --run tests/api/media-sign-batch.test.ts tests/api/media-resolve-previews.test.ts tests/api/media-list.test.ts`

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
- Transform flags are now compatibility debt only for these routes; if another caller still expects transform options, that expectation is now intentionally broken at the server handoff seam.
- Surface profile headers remain intact so downstream telemetry/review can still distinguish route/modal/panel callers while using the same direct-sign contract.

## Rollback
- Revert this slice to restore transform-option signing in `sign-batch`, `resolve-previews`, and initial `media/list` hydration.
