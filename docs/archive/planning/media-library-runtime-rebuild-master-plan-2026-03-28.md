# Media Library Runtime Rebuild Master Plan (2026-03-28)


> Archived on 2026-04-26 during docs cleanup because the Media Library runtime rebuild program is complete and the active follow-on work lives in `docs/planning/media-library-ui-redesign-plan-2026-03-28.md`.

Status: Complete  
Owner: Frontend Engineering  
Scope: Media Library route, AI Studio Media Library modal, AI Studio Media Library panel  
Primary branch: `generation-pipeline-rebuild`

## Purpose
Define one rebuild plan for the Media Library client runtime that removes the current main-thread overload risks without rewriting stable server contracts or mixing runtime work with future UI redesign.

## Problem Statement
The Media Library hot path is currently fragmented across three surface-owned runtimes:
- `frontend/pages/media-library.tsx`
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`

Each surface owns overlapping versions of:
- list and pagination orchestration,
- visible-window tracking,
- preview signing and retry,
- row mutation and cache application,
- observer lifecycle and render-driven state updates.

The resulting failure mode is browser-tab unresponsiveness caused by local CPU and render churn, not backend failure.

Observed architectural problems:
- repeated full-array rewrites during signed URL application,
- repeated full-map cloning for aspect metadata,
- duplicated `IntersectionObserver` and `ResizeObserver` lifecycles,
- surface-owned preview-signing loops driven by visibility and local nonce state,
- folder-canvas full-quality hydration living too close to browse-runtime concerns.

## Decision
Do an in-place runtime rebuild with strangler seams.

Keep the stable backend and transport contracts:
- `frontend/pages/api/media/list.ts`
- `frontend/pages/api/media/sign-batch.ts`
- `frontend/pages/api/media/resolve-previews.ts`
- `frontend/lib/mediaSignedUrlCache.ts`
- `frontend/features/media-library/logic/mediaGridVirtualization.ts`
- `frontend/features/media-library/logic/mediaPreviewResolver.ts`
- `frontend/features/media-library/logic/mediaPreviewRuntimeShared.ts`

Replace the distributed client runtime with one shared Media Library runtime substrate plus thin surface adapters.

Do not block this work on UI redesign. The runtime must be corrected first.

## Rebuild Entry Scorecard
| Criterion | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Contract lock completed | Pass | Existing SOPs and ADRs | `ADR 0032`, `0033`, `0035`, `0036`, `0037`, `0038`, `0039`, `0044` plus media SOPs already lock current product and delivery contracts. |
| Characterization baseline captured | Pass | Repo audit, targeted tests, and `MLR-0-S2` evidence packet set | Existing tests cover route hooks, modal behavior, panel behavior, and many shared helpers, and `MLR-0-S2` now includes both the characterization baseline and unified heavy browser packet. |
| Do-not-rebuild criteria evaluated | Pass | Current audit | This is not a styling issue, docs drift issue, or narrow seam extraction candidate. |
| Incremental strangler cutover defined | Pass | Phases below | Route first, modal second, panel third, legacy adapters retained until green. |
| Rollback within release window defined | Pass | Rollback section | Surface adapters preserve rollback to legacy implementation. |
| Security boundary verification defined | Pass | Existing APIs preserved | User-scoped auth, storage scope, and sign/list/resolve contracts remain server authoritative. |
| Performance parity baseline and thresholds defined | Pass | Acceptance section plus `MLR-0-S2` heavy browser packet | The track now has a repeatable route/modal/panel heavy browser audit for closeout verification. |
| One-seam PR slicing policy accepted | Pass | Execution policy | No mixed runtime plus UI redesign PRs. |

## Non-Goals
- No visual redesign of `/media-library`, AI Studio modal chrome, or AI Studio panel chrome.
- No rewrite of folder membership semantics, `All Media` root behavior, or preview modal product behavior.
- No backend schema redesign in this wave.
- No expansion into Character Manager, Reference Grid, or non-media-library surfaces beyond shared utility reuse.
- No attempt to unify folder canvas into the browse runtime.

## Contract Locks
The rebuild must preserve:
- `All Media` root semantics and folder membership model from `ADR 0032`, `0033`, and `0038`
- direct signed Media Library card rendering policy from `ADR 0036` and `ADR 0044`
- transform-sunset and derivative-first posture from `ADR 0039`
- route, modal, and panel browse behavior documented in:
  - `docs/sops/sop_media_library_ui.md`
  - `docs/sops/sop_ai_studio_media_library_operations.md`
  - `docs/sops/sop_media_performance_operations.md`

## What Is Sound Today
These parts are worth preserving:
- list, sign, and resolve APIs are bounded and user-scoped
- signed URL cache is directionally correct
- pure virtualization math is already isolated
- retry and preview fallback logic is bounded
- there is already broad test coverage around the existing hooks and components

## What Must Be Rebuilt
### Surface-owned browse runtime
- `frontend/pages/media-library.tsx`
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`

### Duplicated preview runtime
- `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`
- `frontend/features/media-library/hooks/useMediaPreviewRecoveryController.ts`

### Duplicated data orchestration
- `frontend/features/media-library/hooks/useMediaTabDataController.ts`
- `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`

### Route-level render amplification
- `frontend/pages/media-library.tsx`
- `frontend/features/media-library/components/MediaAssetGallery.tsx`

## Architectural Direction
Build one shared runtime with five modules.

### 1. `media-runtime-store`
Responsibilities:
- normalized entities keyed by id
- ordered ids by scope and tab or folder
- selection, preview, and aspect metadata state
- loading and error state

Explicitly excluded:
- DOM refs
- observer ownership
- folder-canvas scene state

### 2. `media-surface-controller`
Responsibilities:
- route, modal, and panel query and pagination control
- surface config for page size, list profile, observer root, and active scope
- derivation of render-ready ids and view models

### 3. `media-preview-engine`
Responsibilities:
- sign-batch
- resolve-previews fallback
- retry and invalidation policy
- preview hydration lifecycle

Rule:
- no surface may own its own sign loop after cutover

### 4. `media-viewport-engine`
Responsibilities:
- visible and near-viewport tracking
- load-more triggering
- video-budget signals
- virtualization input signals

Rule:
- route, modal, and panel consume shared viewport signals instead of owning parallel observers

### 5. `media-mutation-engine`
Responsibilities:
- upload
- rename
- move
- delete
- folder assignment or unassignment
- invalidation and store event publishing

Rule:
- mutation flows update shared runtime state through one path, not several local state setters

## Domain Boundaries
### Browse-runtime family
Included:
- route
- AI Studio modal
- AI Studio panel

### Separate domain
Excluded from the shared browse runtime:
- `frontend/features/ai-studio/components/MediaLibraryFolderCanvas.tsx`

Folder canvas may consume shared preview helpers, but its scene, persistence, and hydration policy remain independent.

## Hook Fate Map
### Preserve as-is or with small integration changes
- `frontend/lib/mediaSignedUrlCache.ts`
- `frontend/features/media-library/logic/mediaGridVirtualization.ts`
- `frontend/features/media-library/logic/mediaPreviewResolver.ts`
- `frontend/features/media-library/logic/mediaPreviewRuntimeShared.ts`
- server APIs under `frontend/pages/api/media/*`

### Replace or absorb into shared runtime
- `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`
- `frontend/features/media-library/hooks/useMediaTabDataController.ts`
- `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`

### Keep, but reroute through shared runtime
- `frontend/features/media-library/hooks/useMediaPreviewRecoveryController.ts`
- `frontend/features/media-library/hooks/useMediaGridVideoBudgetController.ts`
- `frontend/features/media-library/hooks/useMediaTabLoadMoreController.ts`
- surface mutation controllers

## Execution Policy
- Use strangler seams only.
- One behavior-changing seam per PR.
- Route first, then modal, then panel.
- No runtime plus UI redesign mixed PRs.
- No legacy-path removal until the replacement seam has passed its gates.
- Prefer extracting stable interfaces before moving behavior.

## Characterization Baseline Requirements
Before tracker closeout and freeze-signoff, capture:
- current route hot-path behavior
- current modal hot-path behavior
- current panel hot-path behavior
- known freeze-risk scenarios
- current targeted tests that must remain green

The baseline inventory must explicitly link:
- route hook tests
- modal tests
- panel tests
- helper and API contract tests

## Phases
### Phase `MLR-0`: Contract lock and characterization baseline
Goals:
- lock shared runtime interfaces
- lock adapter boundaries
- capture baseline repro matrix and thresholds

Deliverables:
- runtime interface contract
- hook fate map confirmed against repo
- characterization inventory and baseline packet

Exit gate:
- first behavior-changing slice is defined and bounded

### Phase `MLR-1`: Normalized route store
Goals:
- introduce normalized entity store and selectors
- remove route-level `files` plus `mediaTabCache` duplication from the hot path
- preserve route behavior behind a legacy-compatible adapter

Deliverables:
- normalized route read model
- route adapter consuming selectors

Exit gate:
- route behavior unchanged under targeted tests

### Phase `MLR-2`: Shared preview engine on route
Goals:
- centralize sign-batch, resolve, retry, and invalidation
- remove route dependency on surface-owned visibility plus nonce-driven signing loop
- eliminate broad row-array rewriting for single-row preview updates

Deliverables:
- shared preview engine
- route cutover to shared preview engine

Exit gate:
- route no longer depends on a route-specific preview wrapper or `useMediaPreviewSigningController` as primary hot-path owners

### Phase `MLR-3`: Shared viewport engine on route and modal
Goals:
- unify visibility, near-viewport, load-more, and video-budget signaling
- remove duplicated route and modal observer ownership

Deliverables:
- shared viewport engine
- route cutover
- modal cutover

Exit gate:
- route and modal no longer own parallel observer stacks for equivalent behavior

### Phase `MLR-4`: Panel cutover and folder-canvas boundary cleanup
Goals:
- move AI Studio panel browse runtime onto shared substrate
- keep folder canvas isolated
- remove duplicated panel fetch and preview orchestration

Deliverables:
- panel adapter on shared runtime
- explicit folder-canvas helper boundary

Exit gate:
- panel browse state no longer owns its own parallel preview and pagination state machine

### Phase `MLR-5`: Legacy removal and closeout
Goals:
- remove genuinely dead surface-owned runtime paths as they appear
- complete docs and evidence
- leave UI redesign as a separate next lane

Deliverables:
- dead runtime path removal
- closeout evidence

Exit gate:
- no hidden consumers remain on legacy runtime seams

## Validation
Required per behavior-changing slice:
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && npm run docs:check`
- targeted tests for touched seams
- `cd frontend && npm run test:adaptive-v2-gate` when protected adaptive paths are touched

Recommended targeted suites should include:
- route browse and mutation flows
- modal browse and selection flows
- panel browse and folder flows
- preview resolution and retry behavior

## Acceptance Thresholds
Cutover is acceptable only if:
- the known heavy media-library scenarios no longer produce a browser-tab unresponsive repro
- route, modal, and panel preserve current product behavior and folder semantics
- placeholder-first loading remains non-blocking
- single-row preview updates do not require broad array rewrite behavior in the primary hot path
- auth and storage-scope behavior for sign/list/resolve remain unchanged

## Rollback Strategy
- Preserve legacy route, modal, and panel adapters until the replacement seam is green.
- Roll back by switching the affected adapter back to legacy runtime.
- Do not remove legacy code until:
  - targeted validation is green
  - no open P0 or P1 regression exists for the surface
  - tracker evidence is complete
  - no hidden consumer is observed

## Done State
This track is done only when all of the following are true:

1. The shared Media Library runtime is the primary hot-path owner for:
   - route browse state
   - modal browse state
   - panel browse state
   - preview resolution and retry flow
   - visibility and load-more signaling

2. The legacy distributed hot-path ownership is removed or reduced to non-authoritative compatibility glue:
   - `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`
   - `frontend/features/media-library/hooks/useMediaTabDataController.ts`
   - `frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts`
   These files may remain only if they are thin adapters over the shared runtime rather than independent state machines.

3. Product behavior is preserved across the protected surfaces:
   - `/media-library`
   - AI Studio Media Library modal
   - AI Studio Media Library panel
   - `All Media` root semantics
   - folder membership semantics
   - preview-only modal behavior
   - move, delete, rename, upload, and folder operations

4. Folder canvas remains a separate domain:
   - no browse-runtime coupling of folder-canvas scene state
   - no regression of `user + folder` persistence behavior

5. The known freeze class is resolved:
   - the previous heavy media-library scenarios no longer reproduce a browser-tab unresponsive state
   - no equivalent uncapped client-side feedback loop remains in the rebuilt browse runtime

6. The hot path is structurally improved:
   - no broad array rewrite is required for steady-state single-row preview updates
    - no parallel duplicated observer ownership remains across route, modal, and panel for equivalent browse behavior

7. The characterization and repro evidence are complete:
   - `MLR-0-S2` baseline packet is complete
   - heavy media-library repro coverage has been executed for route, modal, and panel before declaring the rebuild done
   - route, modal, and panel consume the shared runtime instead of reimplementing equivalent logic

7. Validation and evidence are complete:
   - required docs checks are green
   - required frontend validation for each behavior-changing seam is green
   - targeted runtime tests exist for the rebuilt seams
   - tracker evidence packets are complete for route, modal, panel, and legacy removal slices

8. Legacy-path removal is complete:
   - no hidden consumer remains on the retired runtime seams
   - rollback notes are recorded for the final cutover
   - the tracker is moved to complete and no further rebuild slices remain open

When every item above is true, this task stops. Any later UI redesign, polish work, or backend redesign must open as a separate lane.

## Risks
| Risk | Severity | Mitigation |
| --- | --- | --- |
| Mutation invalidation breaks during store migration | High | Route-first migration plus mutation-focused targeted tests |
| Modal and panel contain hidden surface assumptions | High | Keep separate adapters and cut over one surface at a time |
| Folder canvas accidentally gets coupled into browse runtime | High | Keep explicit exclusion in contract and dedicated cleanup slice |
| Plan drifts into UI redesign or backend redesign | Medium | Non-goals and one-seam PR rule |

## Evidence Index
Implementation evidence for this track belongs under:
- `docs/planning/evidence/media-library-runtime-rebuild/`

Suggested packet naming:
- `YYYY-MM-DD-mlr-phase-slice-summary.md`

## Related Docs
- `docs/planning/foundation-rebuild-playbook-2026-03-16.md`
- `docs/planning/media-rendering-hardening-v2-master-plan-2026-03-16.md`
- `docs/sops/sop_media_library_ui.md`
- `docs/sops/sop_ai_studio_media_library_operations.md`
- `docs/sops/sop_media_performance_operations.md`
- `docs/adr/0032-ai-studio-media-library-target-ux-and-folder-canvas-domains.md`
- `docs/adr/0033-ai-studio-media-library-folder-canvas-persistence-and-gesture-v2.md`
- `docs/adr/0035-media-library-all-media-completeness-and-preview-contract.md`
- `docs/adr/0036-media-library-signed-preview-delivery-and-next-optimizer-bypass.md`
- `docs/adr/0037-media-library-supabase-first-derivative-worker-and-claim-rpcs.md`
- `docs/adr/0038-ai-studio-media-library-all-media-inline-tabs.md`
- `docs/adr/0039-media-library-transform-sunset-and-local-derivative-engine.md`
- `docs/adr/0044-media-rendering-surface-delivery-policy-and-adr-reconciliation.md`
- `docs/adr/0049-ai-studio-right-rail-surface-ownership-and-media-resolution-contract.md`
