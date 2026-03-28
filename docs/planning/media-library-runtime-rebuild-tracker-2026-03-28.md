# Media Library Runtime Rebuild Tracker (2026-03-28)

Status: Active planning tracker  
Owner: Frontend Engineering  
Companion plan: `docs/planning/media-library-runtime-rebuild-master-plan-2026-03-28.md`

## Tracker Rules
- One runtime seam per PR.
- No UI redesign slices in this tracker.
- No backend schema redesign slices in this tracker.
- Route first, modal second, panel third.
- Do not mark a phase complete without linked validation evidence and rollback notes.

## Phase Status
| Phase | Status | Exit Gate |
| --- | --- | --- |
| `MLR-0` Contract lock and characterization baseline | In Progress | interface contract, hook fate map, and baseline packet complete |
| `MLR-1` Normalized route store | In Progress | route reads normalized store without hot-path duplication |
| `MLR-2` Shared preview engine on route | Planned | route no longer depends on legacy surface-owned sign loop |
| `MLR-3` Shared viewport engine on route and modal | In Progress | route and modal observer duplication removed |
| `MLR-4` Panel cutover and folder-canvas boundary cleanup | Complete | panel browse runtime on shared substrate; folder canvas still separate |
| `MLR-5` Legacy removal and closeout | Planned | dead runtime paths removed after green cycles |

## Slice Tracker
| Slice ID | Phase | Scope | Status | Acceptance | Validation | Rollback Note | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `MLR-0-S1` | `MLR-0` | Lock shared runtime interfaces, adapter boundaries, and hook fate map | Complete | contract doc and implementation seam map reviewed | docs check, lint, build | no code-path change | `frontend/features/media-library/runtime/types.ts`, `frontend/features/media-library/runtime/surfaceConfig.ts`, `frontend/features/media-library/runtime/index.ts`; `npm run docs:check`; `npm run lint`; `npm run build` |
| `MLR-0-S2` | `MLR-0` | Capture characterization inventory, freeze repro matrix, and cutover thresholds | Planned | baseline packet linked | docs check | no code-path change | Pending |
| `MLR-1-S1` | `MLR-1` | Introduce normalized media entity store and selectors | Complete | store supports route read model | lint, build, targeted tests | revert to legacy page state owner | `frontend/features/media-library/runtime/store.ts`, `frontend/features/media-library/runtime/__tests__/store.test.ts`; `npm run test -- features/media-library/runtime/__tests__/store.test.ts`; `npm run lint`; `npm run build` |
| `MLR-1-S2` | `MLR-1` | Route adapter reads normalized store | In Progress | route parity maintained without broad duplication | lint, build, targeted tests | restore legacy route adapter | `frontend/features/media-library/runtime/useMediaLibraryRouteRuntime.ts`, `frontend/pages/media-library.tsx`; `npm run lint`; `npm run build`; `npm run test -- features/media-library/runtime/__tests__/store.test.ts features/media-library/hooks/__tests__/useMediaPreviewRuntime.test.ts` |
| `MLR-2-S1` | `MLR-2` | Add shared preview engine and integrate with store | In Progress | preview state centralized | lint, build, targeted tests | restore legacy preview runtime | Route preview overlay active via `frontend/features/media-library/runtime/store.ts`, `frontend/features/media-library/runtime/useMediaLibraryRouteRuntime.ts`, `frontend/features/media-library/hooks/useMediaPreviewRuntime.ts`; shared surface preview hook extracted to `frontend/features/media-library/hooks/useMediaSurfacePreviewRuntime.ts`; sign-pass follow-up scheduling now bounded in `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`; `npm run test -- features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts features/media-library/hooks/__tests__/useMediaPreviewRuntime.test.ts features/media-library/runtime/__tests__/store.test.ts`; `npm run lint`; `npm run build` |
| `MLR-2-S2` | `MLR-2` | Route cutover from legacy signing runtime | Planned | route no longer depends on legacy sign loop in hot path | lint, build, targeted tests | restore legacy route preview hooks | Pending |
| `MLR-3-S1` | `MLR-3` | Shared viewport engine for route | Planned | route no longer owns duplicate observer stack | lint, build, targeted tests | restore legacy route observer hooks | Pending |
| `MLR-3-S2` | `MLR-3` | Modal cutover to shared viewport and browse runtime | In Progress | modal parity maintained | lint, build, targeted tests, adaptive gate if required | restore legacy modal runtime | `frontend/features/ai-studio/components/MediaLibraryModal.tsx` now consumes `frontend/features/media-library/hooks/useMediaSurfacePreviewRuntime.ts` for modal preview recovery, sign budget refresh, visibility tracking, and signed-url application; modal regression harness updated in `frontend/features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx`; `npm run test -- features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx features/media-library/hooks/__tests__/useMediaPreviewRuntime.test.ts features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts features/media-library/runtime/__tests__/store.test.ts` |
| `MLR-4-S1` | `MLR-4` | Panel cutover to shared browse runtime | Complete | panel parity maintained | lint, build, targeted tests, adaptive gate if required | restore legacy panel runtime | `frontend/features/ai-studio/components/MediaLibraryPanel.tsx` now consumes `frontend/features/media-library/hooks/useMediaSurfacePreviewRuntime.ts` for panel preview recovery, sign budget refresh, visibility tracking, and signed-url application while keeping folder-canvas hydration separate; panel regression harness aligned in `frontend/features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx`; `npm run test -- features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx features/media-library/hooks/__tests__/useMediaPreviewRuntime.test.ts features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts`; targeted eslint on panel/runtime files passed |
| `MLR-4-S2` | `MLR-4` | Folder-canvas helper boundary cleanup | Complete | folder canvas remains separate from browse runtime | lint, build, targeted tests | restore prior helper boundary | Folder-canvas full-quality URL hydration and row shaping moved from `frontend/features/ai-studio/components/MediaLibraryPanel.tsx` into `frontend/features/ai-studio/hooks/useMediaLibraryPanelFolderCanvasController.ts`, leaving browse-surface preview runtime in the shared substrate and folder-canvas state isolated; targeted eslint on panel/folder-canvas files passed; `npm run test -- features/ai-studio/components/__tests__/MediaLibraryPanel.test.tsx`; broader panel/media-runtime validation and build/lint/docs checks completed for the slice |
| `MLR-5-S1` | `MLR-5` | Remove dead legacy runtime paths | Planned | no hidden consumer remains | lint, build, targeted tests, docs check | revert removal commit | Pending |

## Required Characterization Inventory
Before `MLR-1-S1`, inventory and link the current targeted tests for:
- route data and pagination behavior
- route preview runtime behavior
- modal browse and select behavior
- panel browse and folder behavior
- preview resolve and retry behavior
- mutation behavior for upload, move, delete, and rename

## Risks
| Risk ID | Description | Severity | Mitigation | Status |
| --- | --- | --- | --- | --- |
| `MLR-R1` | Store migration breaks move, delete, rename, or upload invalidation | High | Route-first migration plus mutation-focused tests | Open |
| `MLR-R2` | Modal contains hidden assumptions not covered by route-first work | High | Keep separate modal adapter and independent cutover slice | Open |
| `MLR-R3` | Panel and folder semantics drift during cutover | High | Panel cutover isolated from folder-canvas runtime | Open |
| `MLR-R4` | Folder canvas becomes coupled to browse runtime | High | Dedicated boundary cleanup slice and explicit non-goal | Open |
| `MLR-R5` | Runtime rebuild drifts into UI redesign or backend redesign | Medium | Enforce non-goals and one-seam PR rule | Open |

## Evidence Checklist
- shared runtime interface contract
- hook fate map
- baseline repro matrix and thresholds
- route cutover packet
- modal cutover packet
- panel cutover packet
- legacy removal packet

## Done State Gate
Mark this tracker complete only when all of the following are true:
- `MLR-0` through `MLR-5` are complete or explicitly closed with evidence
- route, modal, and panel browse runtimes are on the shared substrate
- the legacy hot-path runtime seams are no longer independent state machines
- folder canvas remains isolated and verified
- the known browser unresponsive repro no longer reproduces on the heavy media-library scenarios
- required validation and evidence packets are complete
- no further rebuild slices are needed to achieve runtime stability and parity

Anything after that point is out of scope for this tracker and must be opened as a separate lane.

## Readiness
Current state: `implementation_active_route-store-foundation`

Promotion to implementation-ready requires:
- `MLR-0-S1` complete
- `MLR-0-S2` complete
- first behavior-changing slice selected
- targeted validation plan attached to that slice
