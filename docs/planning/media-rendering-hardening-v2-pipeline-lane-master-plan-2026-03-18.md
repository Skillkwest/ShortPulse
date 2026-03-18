# Media Rendering Hardening v2 Pipeline Lane Master Plan (2026-03-18)

Last updated: 2026-03-18  
Status: Active  
Owner: Engineering  
Program anchors:
- [Master plan](./media-rendering-hardening-v2-master-plan-2026-03-16.md)
- [Master roadmap](./media-rendering-hardening-v2-master-roadmap-2026-03-16.md)
- [Execution tracker](./media-rendering-hardening-v2-execution-tracker-2026-03-16.md)
- [Risk register](./media-rendering-hardening-v2-risk-register-2026-03-16.md)
- [Decision log](./media-rendering-hardening-v2-decision-log-2026-03-16.md)
- [QA / release checklist](./media-rendering-hardening-v2-qa-release-checklist-2026-03-16.md)
- [Evidence root](./evidence/media-rendering-hardening-v2/README.md)

## Summary
Pipeline is the second execution lane for Media Rendering Hardening v2. It owns the server-authoritative media path that must be stable before Surface cutover work broadens across route, modal, panel, reference-grid, character, and detail experiences.

Pipeline owns:
1. canonical ingest and metadata authority,
2. media-list payload and query hardening,
3. canonical upload route migration with compatibility adapters,
4. explicit server contract handoff for list/sign/resolve assumptions needed by later surface slices,
5. derivative-first server truth for hot-path image cards so Surface does not build on transform-dependent preview assumptions.

Pipeline does not own final surface renderer policy, user-facing render cutovers, or render-cost optimization. It exists to make server truth reliable and boring before Surface lane changes exercise that truth more aggressively.

## Scope Lock
In scope:
1. Metadata and dimension authority from ingest through list/resolve consumers.
2. `/api/media/list` payload-profile hardening and folder-query scalability.
3. `/api/media/upload` canonicalization and compatibility-adapter governance for `/api/upload-image` and `/api/upload-video`.
4. Contract-matrix updates for server-owned list/upload/sign/resolve dependencies when Pipeline decisions change their meaning.
5. Caller inventory and migration sequencing for legacy upload consumers.
6. Server-authored durable preview/derivative readiness semantics for hot-path card surfaces.

Out of scope:
1. Surface renderer behavior changes.
2. Adaptive-media policy decisions owned by Foundation.
3. Reference-grid or media-library UI parity work owned by Surface.
4. Long-tail image-surface sweep work.
5. `mini-ecosystem/` planning or implementation work.

## Audited Repo Context
Pipeline planning is grounded in current repo seams:
1. Canonical upload already exists at `frontend/pages/api/media/upload.ts` and is exercised by:
   - `frontend/features/media-library/hooks/useMediaUploadController.ts`
   - `frontend/features/ai-studio/logic/mediaLibraryPanelApi.ts`
2. Legacy upload routes still have direct callers:
   - `frontend/features/ai-studio/utils/imageUpload.ts` -> `/api/upload-image`
   - `frontend/features/ai-studio/utils/videoUpload.ts` -> `/api/upload-video`
3. Metadata authority currently spans:
   - `frontend/lib/server/mediaUploadService.ts`
   - `frontend/pages/api/upload-image.ts`
   - `frontend/pages/api/media/copy-from-url.ts`
   - `frontend/lib/server/imageDimensions.ts`
   - `frontend/pages/api/media/list.ts`
4. The MIME/parser contract is still mismatched: AVIF/HEIC/HEIF are allowed in upload/copy paths while `imageDimensions.ts` only parses PNG/JPEG/GIF/WEBP.
5. Hot-path list consumers flow through:
   - `frontend/features/media-library/logic/mediaListApi.ts`
   - `frontend/lib/mediaSignedUrlCache.ts`
   - `frontend/features/media-library/logic/mediaPreviewResolver.ts`
6. Protected and legacy route inventory also includes `frontend/lib/server/api/protectedApiPaths.ts`, so adapter retirement must stay aligned with route-protection and route-inventory docs.

## Required Companion Docs
Pipeline work must stay aligned with:
1. [Contract matrix](./media-rendering-hardening-v2-contract-matrix-2026-03-16.md)
2. [Metadata authority spec](./media-rendering-hardening-v2-metadata-authority-spec-2026-03-16.md)
3. [API list profile spec](./media-rendering-hardening-v2-api-list-profile-spec-2026-03-16.md)
4. [Folder query scalability spec](./media-rendering-hardening-v2-folder-query-scalability-spec-2026-03-16.md)
5. [Legacy adapter sunset spec](./media-rendering-hardening-v2-legacy-adapter-sunset-spec-2026-03-16.md)
6. [Foundation lane master plan](./media-rendering-hardening-v2-foundation-lane-master-plan-2026-03-18.md)
7. [Foundation lane execution plan](./media-rendering-hardening-v2-foundation-lane-execution-plan-2026-03-18.md)

Operational context remains anchored to [docs/operator-map.md](../operator-map.md), especially rows `media_upload_list_sign_resolve` and `adaptive_media_reference_grid_rendering`.

## Entry Gate
Pipeline may start planning and low-risk preparation before Foundation is complete, but behavior-changing pipeline slices may not merge until:
1. Foundation `P0` stop/go passes,
2. Foundation `P1` policy decisions are accepted for surfaces affected by the change,
3. telemetry truth rules are available for post-change evidence.

Vendor-coupled note:
1. Any Pipeline change that depends on signed-transform mutability, remote optimizer rewriting, or CDN invalidation assumptions must cite official Next.js or Supabase behavior in the slice evidence.

## Phase Map
### G0: Pipeline Entry And Dependency Lock
Maps to master `P2`, `P5`, and `P6` readiness.

Outputs:
1. Caller inventory for canonical and legacy upload paths.
2. Producer/consumer trace for metadata, list, sign, and resolve dependencies.
3. Clear handoff contract from Foundation to Pipeline.
4. Explicit server handoff contract from Pipeline to Surface for sign/resolve/list assumptions.

### G1: Metadata And Dimension Authority
Maps to master `P2`.

Outputs:
1. One authoritative width/height and metadata propagation contract.
2. Deterministic fallback behavior for allowed-but-unparsed image formats.
3. Invariant-test plan that covers upload and copy-from-url paths.
4. Explicit derivative-readiness semantics so stored preview assets, direct-source fallback, and compatibility-only transform paths are not conflated.

### G2: List Payload And Query Hardening
Maps to master `P5`.

Outputs:
1. `minimal` vs `expanded` list profile contract locked to real consumers.
2. Scalable replacement for folder-id fan-in query behavior.
3. Compatibility notes for any consumer that still needs heavy metadata.

### G3: Upload Consolidation And Adapter Control
Maps to master `P6`.

Outputs:
1. Canonical `/api/media/upload` migration sequencing.
2. Compatibility contract for `/api/upload-image` and `/api/upload-video`.
3. Sunset-readiness telemetry and rollback posture.
4. No migration step assumes transform output or remote optimization behavior that is not supported by official vendor docs.

### G4: Pipeline Handoff To Surface
Cross-lane closeout for Surface `P3`.

Outputs:
1. Pipeline-owned server contracts are stable enough for Surface read/render unification.
2. Contract matrix, decision log, and execution tracker agree on the server truth Surface will consume.
3. No unresolved high-severity gap remains in metadata, sign/resolve handoff, list profile, query shape, or upload compatibility.
4. Surface does not need to assume Supabase on-demand transforms are the steady-state source of card previews.

## Execution Rules
1. One seam per PR.
2. No lane-local tracker. The [master execution tracker](./media-rendering-hardening-v2-execution-tracker-2026-03-16.md) remains the only operational status source.
3. Keep server changes parity-first; migration work must preserve user-visible behavior unless a later Surface slice owns the cutover.
4. Every completed slice must attach evidence under [docs/planning/evidence/media-rendering-hardening-v2/](./evidence/media-rendering-hardening-v2/README.md).
5. Any change that materially alters list/upload/sign/resolve contract meaning must update the contract matrix and decision log in the same slice.

## Exit Criteria
Pipeline may close only when:
1. Metadata authority is accepted and invariant tests are defined or passing for the touched seam.
2. List payload and folder-query contracts are accepted with consumer compatibility accounted for.
3. Upload migration sequencing is clear and legacy callers are mapped.
4. Sign/resolve handoff assumptions are either explicitly accepted or deliberately deferred with owner and unblock criterion.
5. Contract matrix, decision log, tracker, and supporting specs agree on Pipeline-owned server truth.
6. Surface lane has a stable server contract to consume for `P3` and later rollout work.
