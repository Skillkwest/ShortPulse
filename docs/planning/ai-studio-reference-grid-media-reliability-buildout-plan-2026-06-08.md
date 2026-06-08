# AI Studio Reference Grid Media Reliability Buildout Plan

Status: Active implementation source for the June 8, 2026 Reference Grid media reliability lane.

## Objective

Make Reference Grid image media reliable end to end for Media Library drag,
local file add/drop/upload, signing, render, project persistence/restore, and
Quick Slot shared display paths. Storage-backed image cards must not get stuck
in an endless spinner when durable media authority exists, and failures must
converge to a deterministic retry or unavailable state.

## Source Of Truth

- Durable media authority: `savedMediaIds`, `previewStoragePath`,
  `fullStoragePath`, and project workspace restore state.
- Render-only authority: signed URLs, preview URLs, object URLs, and adaptive
  preview URLs. These may render media but must not replace durable storage
  paths in persisted state.
- Right-rail product authority:
  `docs/adr/0083-create-mode-global-right-rail-authority.md`.
- Supabase delivery constraint:
  `docs/adr/0087-supabase-image-transformation-prohibition.md`.
- Holomony owner map:
  `docs/agents/holomony/reference-grid-ownership-map.md`.
- Diagnostic workflow:
  `docs/agents/holomony/reference-grid-diagnostic-sop.md`.
- Existing media-display authority:
  `docs/agents/holomony/media-display-authority-plan.md`.

## Owner / Lane

Owner lane: Holomony / AI Studio Reference Grid media display correctness,
URL authority, ingestion, and hydration/loading.

Shared right-rail scope includes Quick Slot Inventory only where it consumes the
same Reference Grid media authority path. This lane does not own generic Canvas
editing, provider generation, auth/session failures, billing, storage outages,
branch policy, deploys, or production release work.

## Approved Scope

1. Allow Media Library ingestion to accept durable media authority even when a
   current signed `url` is missing or stale.
2. Ensure Media Library drag and local file add/drop/upload paths carry durable
   media ids and storage paths into Reference Grid outputs immediately.
3. Keep signed/display URLs as render artifacts; do not persist them by
   overwriting `previewStoragePath` or `fullStoragePath`.
4. Expose render authority to card/detail consumers through explicit preview,
   result, poster, or resolved-media fields while preserving durable storage
   fields for signing, restore, and future refresh.
5. Add bounded signing and hydration state so a card is loading only while
   signing, generation, hydration, or recovery is actively pending.
6. Convert signing, missing-source, and image decode failures into deterministic
   retry or unavailable states instead of infinite spinners.
7. Add image-error recovery for storage-backed assets by refreshing signed
   authority or using an approved object URL fallback where safe.
8. Preserve project persistence and restore semantics: snapshots keep durable
   authority and do not depend on persisted signed URLs.
9. Keep Quick Slot Inventory on the same corrected media authority path.
10. Add focused regression coverage for durable authority without current URL,
    stale signed URL plus valid storage paths, local upload insertion,
    signing failure, image error recovery, restore, and Quick Slot display.

## Out Of Scope

- UI redesign, layout changes, new interaction models, or copy changes.
- Workflow-local forks of Reference Grid, Quick Slot Inventory, or Canvas.
- Supabase image transformations, signed transform parameters, or
  `/storage/v1/render/image/` usage.
- Browser-only or localStorage-only recovery as a substitute for durable
  project/media authority.
- Broad refactors, duplicate media authorities, compatibility-only fallback
  systems, backup implementations, or adjacent cleanup.
- Commit, push, deploy, release, production migration, or production account
  work.

## Implementation Batches

### Batch 1: Ingestion Authority

- Update `ReferenceIngestionInput` and `buildFromInput` so `libraryMedia`
  inputs can be valid with durable ids/storage paths even when `url` is absent.
- Keep Reference Grid ordering based on insertion time, not source media row
  creation time.
- Add tests for durable authority without a current URL and for stale signed URL
  plus valid storage paths.

### Batch 2: Signed Render Projection

- Refactor the signed storage URL controller so signing produces render URLs in
  preview/result/poster fields or an equivalent explicit render projection.
- Preserve `previewStoragePath` and `fullStoragePath` as durable paths.
- Update resolved-media/card authority tests so cards still render from signed
  media while snapshots retain durable storage paths.

### Batch 3: Loading And Terminal State

- Add or extend Reference Grid signing/hydration state so visual state can
  distinguish active work from terminal failure.
- Ensure storage-backed cards do not remain hydrating when no active signer,
  generation, hydration, or recovery work is pending.
- Add visual-state and card tests for terminal unavailable versus active
  loading.

### Batch 4: Image Error Recovery

- Update the Reference Grid image hydration path so an image error does not
  finalize the same failed URL as hydrated.
- Add bounded refresh/retry for storage-backed signed URLs and an approved
  object URL fallback only where the existing media authority proves ownership.
- Ensure object URLs are cleaned up and never persisted.

### Batch 5: Restore And Shared Right-Rail Regression

- Verify client/server project snapshots preserve durable authority and strip
  transient signed URLs where durable authority exists.
- Cover Quick Slot display through the corrected Reference Grid authority.
- Run focused tests and type/docs checks before closeout.

## Proof Requirements

Minimum local proof before closeout:

```bash
npm -C frontend run test -- useAiStudioReferenceIngestionActions buildFromInput useReferenceGridSignedStorageUrlController useReferenceGridResolvedMediaController referenceGridCardVisualState useReferenceGridHydrationQueueController useReferenceGridImageHydrationController ReferenceGridCard sessionSnapshot sessionSnapshotHydrator projectWorkspaceStatesService
npm -C frontend run type-check:touched
npm -C frontend run docs:check
```

Also verify no Supabase image transformation route was introduced:

```bash
rg -n "/storage/v1/render/image|createSignedUrl\\([^\\n]*transform|transform:" frontend
```

Local tests prove code contracts only. Production behavior on
`https://www.shortpulse.ai` is unproven until a deploy and production-surface
check occur under an explicit production validation lane.

## Stop Condition

Stop when all approved batches are implemented, focused tests and touched
type/docs checks pass, no Supabase transform regression is present, and no
storage-backed Reference Grid image card can remain in an unbounded spinner
state under the covered local contracts.

Stop earlier if the next step is outside this plan, belongs to an upstream
owner, would change UI/UX/product behavior beyond media reliability, requires
commit/push/deploy/production validation, or validation blocks further safe
progress.
