# Media Rendering Hardening v2 Telemetry Baseline Truth Spec (2026-03-18)

Last updated: 2026-03-18
Status: Active

## Purpose
Define which telemetry fields are trustworthy enough to support baseline capture, rollout evaluation, and parity evidence for this program.

## Baseline Rule
No performance or rollout baseline may be treated as authoritative until every required metric below is either:
1. marked `Trusted`, or
2. explicitly excluded from decision-making with a documented replacement metric.

## Metric Truth Table
| metric | current source | trust status | issue | required action before baseline signoff |
| --- | --- | --- | --- | --- |
| first card render timing | `frontend/pages/media-library.tsx`, `frontend/features/ai-studio/components/MediaLibraryModal.tsx` | Trusted with scope limit | Route and modal emit first-card shell today; panel, file modal, panel preview modal, reference-grid, character-grid, and detail-modal do not | Restrict baseline timing signoff to route/modal until replacement metrics or new emitters exist |
| first media paint timing | `frontend/features/media-library/hooks/useMediaSurfacePreviewRuntime.ts`, `frontend/features/ai-studio/components/MediaLibraryModal.tsx` | Trusted with scope limit | Route and modal emit first-media paint today; panel, file modal, panel preview modal, reference-grid, character-grid, and detail-modal do not | Restrict timing baseline to route/modal and document exclusions explicitly |
| sign failure count | `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts` sign-batch completion/failure events | Trusted with validation | Trust depends on consistent unresolved classification after resolver fallback | Align unresolved taxonomy across sign/resolve |
| transformed count | URL inspection for `/storage/v1/render/image/` and optimizer URLs | Trusted with caveat | Detects transforms but not policy intent | Use only as transform-occurrence field, not delivery-mode truth |
| preview delivery mode | media preview signing controller | Blocked | Currently derived from preview profile rather than actual transform usage | Reclassify or replace before baseline approval |
| optimizer bypassed | controller-level constant/asserted flags | Blocked | Current value can be policy-assumed, not observed | Replace with observed URL-shape-based field or exclude |
| fallback count | `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts` result classification | Trusted with validation | Depends on consistent fallback taxonomy | Lock fallback taxonomy in P3/P4 |
| reference-grid render commit | `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridTelemetryController.ts` | Trusted with validation | Useful for reference-grid baseline, but not equivalent to first-card/first-media timing | Use as reference-grid supplemental baseline metric only |
| reference-grid longtask/memory sample | `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridTelemetryController.ts`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridScrollController.ts` | Trusted with validation | Browser support and workload shape vary; not a direct user-visible timing metric | Use as reference-grid perf-pressure evidence, not as sole pass/fail signal |
| list payload size | API response shape / row select contract | Trusted | Static and testable | Attach payload snapshots to P5 evidence |
| folder query latency | API benchmark packet | Trusted once benchmarked | Not yet captured in this program | Add benchmark dataset tiers in P5 |

## Required Baseline Packet Fields
Each baseline packet must include:
1. surface
2. dataset size/profile
3. first card render timing when a trusted emitter exists for that surface
4. first media paint timing when a trusted emitter exists for that surface
5. sign failure count
6. fallback count
7. transformed count
8. notes on blocked or excluded metrics
9. approved replacement metrics when the surface lacks trusted timing emitters

## Emitter Coverage Map
| baseline metric | emitting code path | currently covered surfaces | notes |
| --- | --- | --- | --- |
| first card render timing | `frontend/pages/media-library.tsx`, `frontend/features/ai-studio/components/MediaLibraryModal.tsx` | `media-library-route`, `media-library-modal` | No parallel first-card emitter exists today for panel/file/detail/character/reference surfaces |
| first media paint timing | `frontend/features/media-library/hooks/useMediaSurfacePreviewRuntime.ts`, `frontend/features/ai-studio/components/MediaLibraryModal.tsx` | `media-library-route`, `media-library-modal` | Tied to image/video load handlers |
| open-to-first-media | `frontend/pages/media-library.tsx`, `frontend/features/ai-studio/components/MediaLibraryModal.tsx` | `media-library-route`, `media-library-modal` | Useful timing companion for route/modal only |
| sign failure / fallback / transformed counts | `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts` | `media-library-route`, `media-library-modal`, `media-library-panel` | Same controller emits blocked policy-derived fields; only count fields are baseline-safe today |
| reference-grid render pressure | `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridTelemetryController.ts`, `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridScrollController.ts` | `reference-grid` | Use as supplemental reference-grid evidence until a direct paint/timing baseline exists |

## Current Surface Coverage Gaps
The following protected or user-visible surfaces do not currently have trusted first-card / first-media baseline emitters:
1. `media-library-panel`
2. `media-library-file-modal`
3. `media-library-panel-preview-modal`
4. `reference-grid`
5. `character-grid`
6. `detail-modal`

These gaps do not block planning closure, but they do block any claim that those surfaces have authoritative timing baselines in `P0`.

## Explicitly Blocked Fields Until Repaired
1. `preview_delivery_mode`
2. `optimizer_bypassed`

## Stop/Go Rule
Planning may continue while blocked fields exist. Behavior-changing implementation may not cite them as pass/fail evidence until this spec marks them `Trusted`.

`P0` baseline signoff is limited to route/modal timing, route/modal/panel sign/fallback counts, and reference-grid supplemental perf-pressure metrics unless later slices add trusted emitters or approved replacements.
