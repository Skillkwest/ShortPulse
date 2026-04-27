# Media Rendering Hardening v2 Surface Lane Master Plan (2026-03-18)

Last updated: 2026-03-18  
Status: active  
Owner: Engineering  
Program anchors:
- [Master plan](./media-rendering-hardening-v2-master-plan-2026-03-16.md)
- [Master roadmap](./media-rendering-hardening-v2-master-roadmap-2026-03-16.md)
- [Execution tracker](./media-rendering-hardening-v2-execution-tracker-2026-03-16.md)
- [Risk register](./media-rendering-hardening-v2-risk-register-2026-03-16.md)
- [Decision log](./media-rendering-hardening-v2-decision-log-2026-03-16.md)
- [QA / release checklist](./media-rendering-hardening-v2-qa-release-checklist-2026-03-16.md)
- [Evidence root](../records/evidence/media-rendering-hardening-v2/README.md)

## Summary
Surface is the third execution lane for Media Rendering Hardening v2. It owns the user-visible render surfaces that consume the contracts locked by Foundation and the server truth hardened by Pipeline.

Surface owns:
1. cross-surface read/render contract adoption,
2. route/modal/panel/file-modal/panel-preview/reference-grid/character/quick-swap/detail surface parity,
3. render-cost and anti-bloat work on hot render loops,
4. long-tail consistency sweep,
5. rollout and decommission closeout.

Surface does not own policy selection already locked by Foundation or server-authoritative ingest/list/upload contracts owned by Pipeline. It is responsible for applying those decisions to real renderers without regressions.

## Scope Lock
In scope:
1. Media Library route, modal, and panel render adoption.
2. Reference-grid and quick-slot render adoption.
3. Character-grid, quick-swap, and detail-modal render adoption.
4. Render-cost reduction, virtualization, hydration scheduling, and anti-bloat enforcement for image-heavy surfaces.
5. Long-tail image surface parity and final rollout/decommission coordination.

Out of scope:
1. Foundation policy decisions that remain unresolved.
2. Pipeline-owned metadata/list/upload contract work.
3. Net-new product features or design refreshes.
4. `mini-ecosystem/` planning or implementation work.

## Audited Repo Context
Surface planning is grounded in current repo contradictions:
1. Media Library route/modal adaptive helper currently returns signed Supabase URLs unchanged in `frontend/features/media-library/logic/mediaLibraryAdaptivePreview.ts`.
2. Reference-grid currently forces many signed/object URLs through `/_next/image` in `frontend/features/ai-studio/logic/referenceGridMedia.ts`.
3. Character surfaces still rely on `next/image` with `unoptimized` in key paths inside `frontend/features/character-manager/components/CharacterManagerShell.tsx` and related quick-swap rendering.
4. Detail modal intentionally prefers full-quality media and logs detail full-quality usage in `frontend/features/ai-studio/components/DetailModal.tsx`.
5. Media Library also has separate detail/preview modal surfaces in:
   - `frontend/features/media-library/components/MediaFileModal.tsx`
   - `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPanelPreviewModal.tsx`
   These need explicit treatment instead of being folded silently into parent grid surfaces.
6. Media Library virtualization currently computes full layout for the entire list before culling visible items in:
   - `frontend/features/media-library/logic/mediaGridVirtualization.ts`
   - `frontend/features/media-library/hooks/useMediaMasonryVirtualization.ts`
7. Long-tail render surfaces are still mixed across raw `<img>` and `next/image`, including prompt-step attachment previews and canvas/editor image surfaces; the policy matrix must keep them per surface rather than one bucket.

## Required Companion Docs
Surface work must stay aligned with:
1. [Surface policy matrix](./media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md)
2. [Image surface inventory lock](./media-rendering-hardening-v2-image-surface-inventory-lock-2026-03-16.md)
3. [Test realignment matrix](./media-rendering-hardening-v2-test-realignment-matrix-2026-03-18.md)
4. [Foundation lane master plan](./media-rendering-hardening-v2-foundation-lane-master-plan-2026-03-18.md)
5. [Foundation lane execution plan](./media-rendering-hardening-v2-foundation-lane-execution-plan-2026-03-18.md)
6. [Pipeline lane master plan](./media-rendering-hardening-v2-pipeline-lane-master-plan-2026-03-18.md)
7. [Pipeline lane execution plan](./media-rendering-hardening-v2-pipeline-lane-execution-plan-2026-03-18.md)

Operational context remains anchored to [docs/operator-map.md](../operator-map.md), especially rows `adaptive_media_reference_grid_rendering` and `media_upload_list_sign_resolve`.

## Entry Gate
Surface may not begin behavior-changing implementation until:
1. Foundation `P0` stop/go passes,
2. Foundation `P1` policy decisions are accepted for the surfaces being touched,
3. Pipeline server contracts required by the slice are accepted or explicitly deferred with owner and unblock criterion,
4. test realignment has removed or classified drift-locking assertions for the affected seam.
5. Any surface decision that relies on vendor-specific delivery behavior is backed by official Next.js or Supabase documentation, not blog-level guidance.

## Phase Map
### S0: Surface Entry And Dependency Lock
Maps to master `P3`, `P7`, `P8`, and `P9` readiness.

Outputs:
1. Clear mapping from Foundation policy rows to concrete UI surfaces.
2. Clear mapping from Pipeline server truth to consuming renderers.
3. Protected-surface gate requirements per slice.

### S1: Cross-Surface Read/Render Unification
Maps to master `P3`.

Outputs:
1. Hot-path surface adoption for route/modal/panel/reference-grid.
2. Explicit parity coverage for character-grid and detail-modal.
3. Deterministic fallback order and surface assertions in real renderers.
4. Surface renderer choices remain compatible with documented Next.js remote-image constraints and Supabase signed-transform behavior.

### S2: Render Cost And Anti-Bloat Enforcement
Maps to master `P7`.

Outputs:
1. Hot-loop render-cost reduction for masonry/virtualization and hydration.
2. Visible-window-first rendering/scheduling where applicable.
3. Enforced size and architecture guardrails for media hotspots.

### S3: Long-Tail Surface Sweep
Maps to master `P8`.

Outputs:
1. Inventory-driven long-tail surface parity work.
2. Per-surface treatment for dashboard, landing, performance, saved-creators, prefabs, and other discovered long-tail surfaces.
3. Removal of unnecessary or inconsistent `unoptimized` usage where policy allows.

### S4: Rollout And Decommission Closeout
Maps to master `P9`.

Outputs:
1. Ring rollout evidence.
2. Legacy adapter/surface path decommission coordination.
3. Final closeout packet with no open P0/P1 regression.

## Execution Rules
1. One seam per PR.
2. No lane-local tracker. The [master execution tracker](./media-rendering-hardening-v2-execution-tracker-2026-03-16.md) remains the only operational status source.
3. Surface slices must not silently invent new delivery policy; they must implement accepted policy or stop and escalate to Foundation/Pipeline docs.
4. Every completed slice must attach evidence under [docs/records/evidence/media-rendering-hardening-v2/](../records/evidence/media-rendering-hardening-v2/README.md).
5. Protected adaptive/reference-grid paths must honor the adaptive change gate before merge.
6. Surface slices must not assume AVIF-transform parity or post-sign transform rewriting unless that behavior is explicitly documented by the vendor and accepted in the decision log.

## Exit Criteria
Surface may close only when:
1. Hot-path render surfaces have accepted and tested parity behavior.
2. Render-cost and anti-bloat checks are in enforce mode for targeted hotspots.
3. Long-tail surfaces are represented per surface and either brought into parity or explicitly deferred with owner/date.
4. Rollout and decommission evidence is complete.
5. Master tracker, decision log, policy matrix, and QA checklist agree on the user-visible end state.
