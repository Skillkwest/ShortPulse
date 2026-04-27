# Media Rendering Hardening v2 Pipeline Lane Execution Plan (2026-03-18)

Last updated: 2026-03-18  
Status: active  
Primary control docs:
- [Pipeline lane master plan](./media-rendering-hardening-v2-pipeline-lane-master-plan-2026-03-18.md)
- [Master execution tracker](./media-rendering-hardening-v2-execution-tracker-2026-03-16.md)
- [Decision log](./media-rendering-hardening-v2-decision-log-2026-03-16.md)
- [Contract matrix](./media-rendering-hardening-v2-contract-matrix-2026-03-16.md)
- [Metadata authority spec](./media-rendering-hardening-v2-metadata-authority-spec-2026-03-16.md)
- [API list profile spec](./media-rendering-hardening-v2-api-list-profile-spec-2026-03-16.md)
- [Folder query scalability spec](./media-rendering-hardening-v2-folder-query-scalability-spec-2026-03-16.md)
- [Legacy adapter sunset spec](./media-rendering-hardening-v2-legacy-adapter-sunset-spec-2026-03-16.md)
- [Evidence root](./evidence/media-rendering-hardening-v2/README.md)

## Purpose
Convert the Pipeline lane strategy into concrete, low-bloat slices that harden server truth before Surface lane consumes it. This plan is execution guidance only; status must stay in the master media-rendering tracker.

## Scope Lock
Allowed in this lane:
1. Metadata and dimension authority changes.
2. List payload/query contract changes.
3. Upload migration and compatibility-adapter sequencing.
4. Contract-matrix and decision-log updates required by server contract changes.

Not allowed in this lane:
1. Surface renderer policy changes owned by Foundation.
2. UI render cutovers owned by Surface.
3. Long-tail parity sweeps.
4. Render-cost and anti-bloat implementation owned by Surface `P7`.

## Slice Backlog
### MRH2-P2-001: Metadata Authority
Acceptance:
1. One authoritative width/height contract is defined from ingest through list/resolve/render consumers.
2. Allowed MIME signatures and parser support are either aligned or covered by deterministic fallback policy.
3. Upload and copy-from-url paths follow the same canonical metadata rules.
4. Durable preview/derivative references are treated as server truth when available, with direct-source fallback made explicit instead of inferred from transform behavior.

Repo seams:
1. `frontend/lib/server/mediaUploadService.ts`
2. `frontend/pages/api/upload-image.ts`
3. `frontend/pages/api/media/copy-from-url.ts`
4. `frontend/lib/server/imageDimensions.ts`
5. `frontend/pages/api/media/list.ts`

Required docs:
1. [Metadata authority spec](./media-rendering-hardening-v2-metadata-authority-spec-2026-03-16.md)
2. [Contract matrix](./media-rendering-hardening-v2-contract-matrix-2026-03-16.md)

### MRH2-P2-002: Sign/Resolve Server Handoff
Acceptance:
1. Server-owned sign/resolve assumptions that Surface `P3` depends on are explicit in docs, not implicit in mixed current behavior.
2. Contract matrix and decision log make clear whether current sign/resolve semantics are accepted, constrained, or deferred.
3. Any material sign/resolve semantic change is either given a dedicated slice or explicitly held out of the current Pipeline change set.
4. Sign/resolve docs distinguish durable preview assets, direct signed-source fallback, and compatibility-only transform URLs so Surface does not inherit transform-first assumptions.

Repo seams:
1. `frontend/lib/mediaSignedUrlCache.ts`
2. `frontend/features/media-library/logic/mediaPreviewResolver.ts`
3. `frontend/pages/api/media/sign-batch.ts`
4. `frontend/pages/api/media/resolve-previews.ts`
5. `frontend/tests/api/media-sign-batch.test.ts`
6. `frontend/tests/api/media-resolve-previews.test.ts`

Required docs:
1. [Contract matrix](./media-rendering-hardening-v2-contract-matrix-2026-03-16.md)
2. [Decision log](./media-rendering-hardening-v2-decision-log-2026-03-16.md)

### MRH2-P5-001: Media List Profile Contract
Acceptance:
1. `minimal` default and `expanded` opt-in are tied to actual consumer needs.
2. Hot-path consumers do not implicitly depend on metadata-heavy fields.
3. Pagination, sorting, and access semantics remain identical across profiles.

Repo seams:
1. `frontend/pages/api/media/list.ts`
2. `frontend/features/media-library/logic/mediaListApi.ts`
3. `frontend/features/media-library/logic/mediaPreviewResolver.ts`

Required docs:
1. [API list profile spec](./media-rendering-hardening-v2-api-list-profile-spec-2026-03-16.md)
2. [Contract matrix](./media-rendering-hardening-v2-contract-matrix-2026-03-16.md)

### MRH2-P5-002: Folder Query Scalability
Acceptance:
1. The replacement query shape removes unbounded `.in("id", ids)` growth risk.
2. Behavior remains equivalent for folder filtering, pagination, and empty-folder handling.
3. Benchmark expectations are explicit before broad rollout.

Repo seams:
1. `frontend/pages/api/media/list.ts`
2. folder membership resolution path used before the list query

Required docs:
1. [Folder query scalability spec](./media-rendering-hardening-v2-folder-query-scalability-spec-2026-03-16.md)
2. [API list profile spec](./media-rendering-hardening-v2-api-list-profile-spec-2026-03-16.md)

### MRH2-P6-001: Canonical Upload And Compatibility Adapters
Acceptance:
1. `/api/media/upload` is the clear canonical target.
2. Legacy callers of `/api/upload-image` and `/api/upload-video` are explicitly mapped and migration order is clear.
3. Compatibility response shape, telemetry, and rollback posture are defined before retirement work starts.

Repo seams:
1. Canonical callers:
   - `frontend/features/media-library/hooks/useMediaUploadController.ts`
   - `frontend/features/ai-studio/logic/mediaLibraryPanelApi.ts`
   - `frontend/pages/api/media/upload.ts`
2. Legacy callers:
   - `frontend/features/ai-studio/utils/imageUpload.ts`
   - `frontend/features/ai-studio/utils/videoUpload.ts`
   - `frontend/pages/api/upload-image.ts`
   - `frontend/pages/api/upload-video.ts`
   - `frontend/lib/server/api/protectedApiPaths.ts`

Required docs:
1. [Legacy adapter sunset spec](./media-rendering-hardening-v2-legacy-adapter-sunset-spec-2026-03-16.md)
2. [Metadata authority spec](./media-rendering-hardening-v2-metadata-authority-spec-2026-03-16.md)

## Cross-Lane Dependency Note
Pipeline does not own Surface `P3`, but it must leave Surface with stable server inputs. That means:
1. metadata fields consumed by render surfaces cannot remain ambiguous,
2. list payload shape cannot surprise hot-path consumers,
3. upload migration cannot strand hidden legacy callers,
4. sign/resolve semantics referenced by the contract matrix must remain consistent with Foundation policy and Surface handoff.

If a server contract change would materially alter sign/resolve endpoint semantics beyond existing specs, route that work through `MRH2-P2-002` before implementation continues.

## Slice Rules
1. One seam per PR.
2. Update tracker, docs, and evidence references in the same slice.
3. Keep rollback notes explicit, especially for migration and query-shape work.
4. Use only the existing media-rendering evidence namespace.
5. Any change that touches adaptive or reference-grid protected paths must still honor the adaptive change gate.

## Validation Bundle
For Pipeline slices:
1. `cd frontend && npm run lint`
2. `cd frontend && npm run type-check`
3. `cd frontend && npm run build`
4. `cd frontend && npm run docs:check`

Targeted tests by seam:
1. metadata invariants for upload and copy-from-url
2. media-list payload profile parity
3. folder-query scalability and pagination parity
4. canonical-upload and adapter parity tests

Protected-path gate when applicable:
1. `cd frontend && npm run test:adaptive-v2-gate`

## Closeout Condition
The Pipeline lane execution plan is complete only when `MRH2-P2-001`, `MRH2-P2-002`, `MRH2-P5-001`, `MRH2-P5-002`, and `MRH2-P6-001` are all complete in the master tracker with linked evidence and no conflicting contract-matrix or decision-log state.
