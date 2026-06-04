# Next-Agent Handoff: Storage, Delivery, And Variants Production/SQL Proof

## Lane Id

`storage-delivery-variants-production-sql-proof-2026-06-04`

## Copy/Paste Use

- This packet is intended for Holomony as the primary media-health owner.
- Dave the Security Guy should own any security-boundary interpretation.
- Nuclo should own any production Supabase/Vercel credential or target-selection work if needed.
- Treat this as a proof-and-findings lane first. Do not broaden into Media Library UX, folder organization, or Create/Pulse workflow behavior.

## Why This Task

- Launch system: `Storage, delivery, and variants`
- Launch state: `Below Bar - Handoff Ready`
- Evidence level: `Production Checked`
- Human risk: `High`
- Operational risk: `High`
- Technical risk: `High`
- Why now: Copperknot has current repo/local proof that signing, preview trust, adaptive preview rejection, and derivative generation are transform-free, but the lane cannot move toward launch reliance until hosted production media/storage posture is proven.
- Why Copperknot is stopping: the next proof requires explicit production Supabase target handling and likely authenticated production media behavior. The local Supabase CLI is linked to `ShortPulse - working-development`, while production is a separate project ref: `ftgrqgjrchpimronuhop`.

## Current Copperknot Evidence

- `frontend/pages/api/media/sign-batch.ts` signs user-scoped `media_library` paths with `createSignedUrls(paths, expiresInSeconds)` and no transform options.
- `frontend/pages/api/media/resolve-previews.ts` signs resolved user-scoped storage paths with `createSignedUrl(path, expiresInSeconds)` and no transform options.
- `frontend/lib/mediaPreviewTrustPolicy.ts` rejects `/storage/v1/render/image/` URLs for direct preview and Next image optimizer use.
- `frontend/lib/adaptive-media/resolver.ts` normalizes Supabase render-image URLs to `null` before adaptive resolution.
- `frontend/features/media-library/logic/mediaLibraryAdaptivePreview.ts` rejects Supabase render-image URLs before bypass or adaptive handling.
- `frontend/lib/mediaPreviewPathCore.ts` filters direct preview candidates through the shared trust policy and resolves durable variant storage paths before original fallbacks.
- `frontend/lib/server/mediaDerivatives/processMediaDerivative.ts` generates local WebP thumb variants with `sharp`, uploads durable variant objects, and upserts `media_asset_variants`.
- Copperknot added a regression test in `frontend/lib/__tests__/mediaPreviewPath.test.ts` proving Supabase render-image URLs are not accepted as direct preview candidates.

## Required Context

Read first:

- `AGENTS.md`
- `docs/agents/copperknot/july-7-launch-authority.md`
- `docs/agents/copperknot/july-7-launch-board.md`
- `docs/agents/copperknot/prioritized-launch-queue-2026-07-07.md`
- `docs/adr/0087-supabase-image-transformation-prohibition.md`
- `docs/operator-map.md`
- `docs/sops/sop_media_performance_operations.md`
- `docs/sops/sop_ai_studio_media_library_operations.md`
- `docs/sops/sop_sql_migration_operations.md`
- `docs/database-migrations.md`

Inspect first:

- `frontend/pages/api/media/list.ts`
- `frontend/pages/api/media/sign-batch.ts`
- `frontend/pages/api/media/resolve-previews.ts`
- `frontend/lib/mediaPreviewTrustPolicy.ts`
- `frontend/lib/mediaPreviewPathCore.ts`
- `frontend/lib/adaptive-media/resolver.ts`
- `frontend/features/media-library/logic/mediaLibraryAdaptivePreview.ts`
- `frontend/lib/server/mediaDerivatives/processMediaDerivative.ts`
- `frontend/pages/api/internal/media-derivatives/run.ts`
- `sql/check_media_derivative_processing_backlog.sql`
- `sql/check_media_derivative_terminal_failures.sql`
- `sql/check_media_preview_variant_coverage_and_size.sql`
- `sql/check_media_storage_scope_drift.sql`

## Scoped Task

Prove or disprove that production storage/delivery/variant posture is launch-reliable enough for the July 7 promise without using Supabase image transformations.

Answer:

1. Does authenticated production media list/sign/resolve behavior return only signed originals, durable local variants, or trusted app-owned non-Supabase optimization paths?
2. Do hosted production SQL checks show derivative backlog, terminal failures, variant coverage, and storage-scope drift are acceptable for launch?
3. Is the internal derivative worker correctly fail-closed unauthenticated and operationally healthy when invoked by the authorized production path?
4. Did any source, SQL, telemetry, or production observation show Supabase image transformation usage?

## Owned Write Surface

Preferred output is a findings/closeout report only.

Allowed code/docs changes only if a narrow source regression is found:

- `frontend/pages/api/media/*`
- `frontend/lib/mediaPreview*`
- `frontend/lib/adaptive-media/*`
- `frontend/features/media-library/logic/*`
- `frontend/lib/server/mediaDerivatives/*`
- `frontend/pages/api/internal/media-derivatives/run.ts`
- `sql/check_media_*`
- this handoff or the required closeout report

## Forbidden Scope

- No UI, UX, visual, or intended behavior changes.
- No Media Library folder/workflow redesign.
- No Create/Pulse workflow changes.
- No billing, credit, entitlement, or pricing policy changes.
- No commit, push, deploy, or release-promotion action.
- No destructive data operations.
- No credit-consuming production generation tests.
- No Docker Supabase workflows.
- No secret exposure in logs or reports.
- No Supabase image transformations for any reason: no signed transform params, no `/storage/v1/render/image/`, no adaptive rewrite, no fallback, no compatibility lane, no experiment, no temporary exception.

## Suggested Production/SQL Proof

- Confirm production target explicitly before any hosted SQL:
  - production Supabase project ref: `ftgrqgjrchpimronuhop`
  - do not rely on the currently linked local Supabase project, which is `ShortPulse - working-development`
- Run read-only hosted checks through the approved SQL/Supabase path:
  - `sql/check_media_storage_scope_drift.sql`
  - `sql/check_media_derivative_processing_backlog.sql`
  - `sql/check_media_derivative_terminal_failures.sql`
  - `sql/check_media_preview_variant_coverage_and_size.sql`
- Run production-safe authenticated media checks only if an approved auth path is already available:
  - list media
  - sign a current user-owned image/video preview path
  - resolve previews for current user-owned rows
  - confirm returned URLs do not contain `/storage/v1/render/image/`
- Re-run local tests if source changes:
  - `npm -C frontend run test -- lib/__tests__/supabaseTransformGuard.test.ts lib/__tests__/mediaPreviewTrustPolicy.test.ts lib/__tests__/mediaPreviewPath.test.ts lib/adaptive-media/__tests__/resolver.test.ts features/media-library/logic/__tests__/mediaLibraryAdaptivePreview.test.ts lib/server/mediaDerivatives/__tests__/processMediaDerivative.test.ts`
- Run `npm -C frontend run docs:check` if docs change.

## Done State

Stop when one of these is true:

- Findings prove production storage/delivery/variant posture is acceptable for Copperknot review, with exact SQL/output evidence and authenticated production media observations.
- A narrow source regression was fixed and validated, with remaining production proof named.
- Production SQL/authenticated proof is blocked by credentials, target ambiguity, or approval boundary, with exact next owner/action named.
- Supabase image transformation usage appears anywhere in source or production behavior; mark as launch regression and stop.

## Stop Rules

- Stop immediately if the lane requires broad Media Library architecture work, UI/UX changes, intended-behavior changes, production credential decisions, destructive data cleanup, or release/deploy action.
- Stop instead of patching if validation begins oscillating or if the source problem spans more than a couple focused passes.
- If no existing owner can complete the proof safely, return a temp-agent handoff recommendation rather than broadening.

## Required Closeout Report

Create:

- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/YYYY-MM-DD-storage-delivery-variants-production-sql-proof-closeout.md`

Required contents:

- lane id
- source handoff path
- execution status
- production target and freshness
- systems touched
- files changed
- SQL checks run and summarized results
- authenticated production media checks run and summarized results
- transform-prohibition evidence
- validation commands
- self-audit findings
- residual risk
- recommended Copperknot readiness decision
