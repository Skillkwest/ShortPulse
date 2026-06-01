> Archived 2026-06-01 during planning cleanup. Reason: superseded rebuild-era contract packet that is no longer in the active planning reading path; retained as historical generation-pipeline rebuild context, not active planning authority.

# Generation Pipeline Rebuild Generated Reuse And Drag/Drop Authority Contract (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose

This document locks the runtime contract for generated reference reuse and drag/drop authority before any new Lane 3 code changes.

It answers:

1. when a generated output is reusable, tracked, or preview-only
2. when drag/drop may expose direct media URLs versus internal reference identity only
3. how generated Reference Grid media resolution should treat canonical storage/output evidence versus transient provider URLs

## Current Repo Behavior

### Authority Classification

`frontend/features/ai-studio/logic/referenceOutputAuthority.ts` currently defines:

1. `reusable`
   - generated output has storage-backed authority through `previewStoragePath`, `fullStoragePath`, or `savedMediaIds`
2. `tracked`
   - generated output has durable identity through `generationId` but no storage-backed authority yet
3. `preview-only`
   - generated output has neither storage-backed authority nor durable generation identity

Supporting rules already in repo:

1. `canDragReferenceOutput(...)`
   - generated outputs may drag only if they are at least `tracked`
2. `canExposeDirectReferenceUrls(...)`
   - generated outputs may expose direct transferable URLs only when they are `reusable`

### Generated Resolved-Media Posture

`frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts` currently:

1. uses `resolveReferenceCardUrls(...)` as the primary media resolver
2. preserves a `preview-only` generated fallback that keeps weak generated outputs viewable through `previewUrl` / `resultUrls`
3. still computes `fallbackUrl` through a generic renderable URL ladder that may consult transient provider URLs after canonical resolution

### Generated Drag/Drop Posture

`frontend/features/ai-studio/utils/dragDrop.ts` currently:

1. always writes internal drag identity/session metadata
2. writes direct transferable URLs only when `canExposeDirectReferenceUrls(output)` is true
3. resolves transferable URLs through `resolveReferenceTransferUrl(...)` using this ladder:
   - `fullStoragePath`
   - `previewStoragePath`
   - `resultUrls`
   - `previewUrl`
4. still derives direct transfer URLs from a generic URL ladder rather than an explicitly documented generated-output authority contract

### Generated Download Posture

`frontend/features/ai-studio/logic/referenceDownload.ts` already behaves as the stronger canonical model:

1. generated downloads prefer canonical `ai_generation_outputs -> media_files`
2. storage-backed output paths are next
3. `savedMediaIds` are compatibility-only after canonical generated-output checks
4. provider URL fetch is a fail-closed fallback only for durably tracked generated references

This download posture should inform generated drag/drop authority rather than diverge from it.

## Contract Decision

### 1. Generated Reuse Tiers

Generated outputs must be treated as exactly one of:

1. `reusable`
   - canonical storage/output evidence exists
   - output is eligible for durable reuse
   - direct transferable URLs may be exposed
2. `tracked`
   - durable generation identity exists, but no canonical reusable media evidence exists yet
   - output may participate in internal reference drag/reuse by identity only
   - direct transferable URLs must not be exposed
3. `preview-only`
   - no durable generation identity exists
   - output may remain viewable in-place
   - output must not masquerade as durable reusable media

### 2. Drag/Drop Exposure Rules

Generated drag/drop must follow these rules:

1. all generated drags keep internal reference identity/session payloads
2. only `reusable` generated outputs may populate:
   - `text/reference-url`
   - `text/uri-list`
   - `image/url`
   - `text/reference-render-url`
3. generated direct URL exposure requires output-level storage paths, not just `savedMediaIds`
4. `tracked` generated outputs may still drag only through internal identity payloads
5. `preview-only` generated outputs must remain non-draggable for generated reuse flows

This keeps downstream payload shape stable while tightening generated URL exposure.

### 3. Canonical-First Generated URL Resolution

For generated outputs that are eligible to expose direct URLs, direct transfer resolution must prefer canonical durable evidence before transient provider URLs.

For this job, canonical-first means:

1. storage-backed paths on the output win first
2. compatibility provider URLs (`resultUrls`, `previewUrl`) are fallback-only
3. `savedMediaIds` may keep generated output reusable for internal identity flows, but they do not by themselves authorize direct URL export
4. if no output-level durable reusable URL exists, generated direct transfer URLs are omitted entirely

This contract intentionally does not require drag/drop to query Supabase or recreate the download resolver inline.
It only requires drag/drop and resolved-media logic to respect the same authority ordering and exposure policy.

### 4. Resolved-Media Contract

Generated Reference Grid media must remain viewable without over-promoting preview-only assets.

Required posture:

1. preview/detail rendering remains canonical-first
2. generated `preview-only` outputs may still render from transient provider URLs
3. preview-only rendering must not imply direct reusable URL authority
4. generated fallback resolution must preserve the distinction between:
   - viewability
   - durable reuse eligibility

### 5. Downstream Stability Contract

This lane must not redesign downstream consumers.

Stable constraints:

1. internal drag payload shape remains unchanged
2. source-surface metadata remains unchanged
3. downstream character/style/media-library consumers should continue to receive the same payload keys
4. this lane only changes when URL fields are present and which candidate wins

## Implementation Posture

### `GPR-GR-S2`

Goal:

1. align generated resolved-media derivation with canonical output/storage authority while keeping preview-only generated outputs viewable

Required outcome:

1. generated card/detail media resolution clearly separates canonical reusable authority from preview-only fallback viewability

### `GPR-GR-S3`

Goal:

1. align generated drag/drop URL exposure with the same reusable/tracked/preview-only contract

Required outcome:

1. generated direct transfer URLs are canonical-output-aware and omitted for tracked/preview-only generated assets without changing payload keys

## Validation Bundle

1. `useReferenceGridResolvedMediaController` tests cover generated canonical-first resolution and preview-only fallback behavior
2. `dragDrop` tests cover:
   - reusable generated direct URL exposure
   - tracked generated identity-only drag payloads
   - preview-only generated non-exposure posture
3. generated asset action/download behavior remains aligned with canonical generated-output ordering
4. `docs:check` passes

## Stop Rules

Stop this lane when:

1. the next step requires downstream consumer contract redesign
2. the next step requires broad Reference Grid card/layout work
3. remaining changes are UI polish rather than authority reduction
