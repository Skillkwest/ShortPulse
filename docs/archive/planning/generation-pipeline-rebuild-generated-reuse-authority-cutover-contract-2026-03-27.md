> Archived 2026-06-01 during planning cleanup. Reason: superseded rebuild-era contract packet that is no longer in the active planning reading path; retained as historical generation-pipeline rebuild context, not active planning authority.

# Generation Pipeline Rebuild Generated Reuse Authority Cutover Contract (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Purpose

This document locks the cross-surface generated reuse contract for downstream consumers before implementation widens beyond the bounded drag/drop checkpoint.

It defines:

1. how internal generated reuse consumers must interpret `reusable`, `tracked`, and `preview-only`
2. when downstream consumers may use direct media URLs
3. when downstream consumers must resolve by internal identity, persistence, and canonical media lookup instead

## Current Repo Behavior

### Internal Drop Resolution

`frontend/features/ai-studio/hooks/useAiStudioInternalDropResolvers.ts` already routes generated internal drops through one shared resolver layer:

1. character drops
2. canvas drops
3. media-library internal drops
4. style-library internal drops

But the consumers are still not locked under one explicit generated reuse contract.

### Internal Reference Source Resolution

`frontend/features/ai-studio/logic/referenceSource/internalReferenceSource.ts` already supports these resolution reasons:

1. `persisted_delivery`
2. `output_storage_path`
3. `saved_media_lookup`
4. `generation_index_lookup`
5. `local_object_url`
6. `payload_reference_url`

That means the repo already has the machinery to prefer canonical or durable evidence, but the downstream consumer contract is still implicit.

### Media Library Internal Drop Resolution

`frontend/features/ai-studio/logic/mediaLibraryInternalDropResolver.ts` currently:

1. accepts payload `mediaId` immediately when present
2. resolves by `outputId` when possible
3. falls back to matching by `payload.referenceUrl`
4. autosaves on demand and polls for `savedMediaIds` or `promptId`

This is useful, but matching by `payload.referenceUrl` is compatibility behavior and should not become the primary generated reuse model.

### Style Intake And Internal Style Drop

Style intake and style-library internal drop flows already use internal reference resolution and carry:

1. `mediaId`
2. `previewStoragePath`
3. `fullStoragePath`
4. prepared image URL when needed

The key remaining ambiguity is when style intake may trust a direct transferred URL versus when it should rely on internal identity plus canonical persistence.

## Contract Decision

### 1. Cross-Surface Generated Reuse Tiers

Downstream consumers must treat generated outputs as:

1. `reusable`
   - output-level durable media authority exists
   - downstream consumers may use direct reusable media URLs and storage-backed evidence
2. `tracked`
   - durable generation identity exists, but direct reusable media authority is not yet present on the output
   - downstream consumers must resolve through internal identity and persistence, not direct provider URL authority
3. `preview-only`
   - no durable generation identity exists
   - downstream durable reuse flows must reject or keep the asset view-only

### 2. Direct URL Consumption Rule

Downstream generated reuse consumers may consume direct media URLs only when the generated output is `reusable`.

For this lane:

1. reusable generated outputs may continue to carry direct URL hints
2. tracked generated outputs must resolve via:
   - output identity
   - persistence/autosave when necessary
   - canonical storage/media lookup
3. preview-only generated outputs must not be upgraded into durable reuse by carrying a transient provider URL

### 3. Identity-First Internal Resolution Rule

For generated internal drops, the consumer order must be:

1. internal payload identity
2. output snapshot lookup
3. persistence or autosave when needed
4. canonical media/storage resolution
5. compatibility URL hints only as bounded fallback where the consumer remains view-only or transient

This means `payload.referenceUrl` remains a compatibility hint, not a source of durable generated authority.

### 4. Consumer-Specific Posture

#### Media Library

Media-library internal drops should end in a persisted library item id:

1. prefer payload `mediaId`
2. else prefer `outputId` plus autosave/poll
3. use `payload.referenceUrl` matching only as compatibility fallback when identity is absent

#### Style Intake

Style internal drops may use a prepared image URL for extraction, but generated authority must still come from:

1. internal identity
2. canonical persisted media/storage evidence
3. not from transient provider URL authority alone

#### Canvas And Character

Canvas and character consumers may remain more permissive for in-session placement or preview, but:

1. generated durable reuse semantics must still prefer internal identity plus canonical persistence
2. provider URL fallback must not silently masquerade as durable reusable media

### 5. Stable Payload Contract

This lane must keep payload keys stable.

It may change:

1. which candidates win
2. when direct URL fields are populated or trusted
3. when identity/persistence resolution is required

It must not redesign:

1. internal drag payload shape
2. source-surface metadata
3. downstream UI layout or interaction models

## Implementation Posture

### `GPR-GX-S2`

Goal:

1. align internal reference drop resolution and media-library drop resolution with the contract above

Required outcome:

1. generated internal reuse prefers identity-first canonical resolution over transient provider URL authority

### `GPR-GX-S3`

Goal:

1. align style, canvas, and character generated reuse consumers with the same contract

Required outcome:

1. generated downstream reuse is consistent across the main AI Studio consumer surfaces

## Validation Bundle

1. `useAiStudioInternalDropResolvers` tests
2. style internal drop and style-library panel tests
3. Reference Grid curated generated drop tests
4. any touched canvas / character drop tests
5. `docs:check`

## Stop Rules

Stop this job when:

1. the next step requires broad UI redesign
2. the next step requires redesigning non-generated drop contracts
3. the next step no longer materially reduces generated reuse authority ambiguity
