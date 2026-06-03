# Large Project Persistence: Output Display Record Proposal

Date: 2026-06-03

Purpose: define the next contract implied by the checkpoint-boundary proposal: the project-owned output record that a lightweight checkpoint should reference instead of embedding full output payloads.

This proposal is repo-backed. It is derived from the actual current consumers of output state in:

- project list previews
- Reference Grid and Quick Slot cards
- card loading/authority decisions
- drag/export affordances
- generated-output refresh

## Bottom-Line Recommendation

ShortPulse should introduce a **project output display record** as the heavy-output persistence unit for large projects.

The lightweight checkpoint should point at these records by identity and ordering, rather than embedding large `AiStudioSessionOutputV1` rows.

## Why This Contract Exists

The current repo shows that most first-paint and right-rail consumers do **not** need the full output payload.

The main current consumers read a much smaller subset:

- [referenceGridMediaOutput.ts](../../../../../../frontend/features/ai-studio/reference-grid/logic/referenceGridMediaOutput.ts)
- [referenceGridCardVisualState.ts](../../../../../../frontend/features/ai-studio/reference-grid/logic/referenceGridCardVisualState.ts)
- [useReferenceGridResolvedMediaController.ts](../../../../../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridResolvedMediaController.ts)
- [useReferenceGridCardRenderController.tsx](../../../../../../frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx)
- [projectsService.ts](../../../../../../frontend/lib/server/projectsService.ts)
- [referenceOutputAuthority.ts](../../../../../../frontend/features/ai-studio/logic/referenceOutputAuthority.ts)

That makes a smaller project-owned output record feasible.

## Current Consumer Footprint

### Project list preview needs

Project card previews currently need:

- output `mode`
- `taskState`
- `previewUrl`
- `resultUrls`
- `previewStoragePath`
- `fullStoragePath`
- `hiddenInReferenceGrid`
- curated reference ids at the checkpoint level

### Reference Grid media slice needs

The current `ReferenceGridMediaOutput` projection uses:

- `id`
- `mode`
- `mediaSource`
- `previewText`
- `previewUrl`
- `previewPosterUrl`
- `previewPosterStoragePath`
- `localObjectUrl` for local runtime only
- `previewStoragePath`
- `fullStoragePath`
- `resultUrls`
- `generationId`
- `savedMediaIds`

For durable project persistence, `localObjectUrl` stays out of scope.

### Card visual/loading state needs

Card loading and authority decisions depend on:

- `taskState`
- `previewText`
- `previewUrl`
- `previewStoragePath`
- `fullStoragePath`
- `mediaSource`
- `generationId`
- `savedMediaIds`

### Drag/export affordances need

Image drag/export currently uses:

- `prompt` or `previewText`
- first `savedMediaIds` entry
- `previewStoragePath`
- `fullStoragePath`
- `mimeType`
- `width`
- `height`

### Generated-output refresh merge needs

`projectGenerationAssociationsService.ts` patches or restores:

- `prompt`
- `transcriptText`
- `provider`
- `modelId`
- `sourceRef`
- `generationId`
- `taskId`
- `taskState`
- `queueState`
- `errorMessage`
- `errorMessageShort`
- `errorDetail`
- `savedMediaIds`
- `saveState`
- `status`
- `resultUrls`
- `previewUrl`
- `previewPosterUrl`
- `previewPosterStoragePath`
- `companionArtUrl`
- `companionArtStoragePath`
- `previewStoragePath`
- `fullStoragePath`
- `generationReplay`
- `characterContext`
- `styleContext`

This is too broad to keep pushing through the checkpoint hot path.

## Proposed Contract: `ProjectOutputDisplayRecord`

This record should be the primary heavy-output persistence unit for large projects.

## 1. Identity fields

Required:

- `project_id`
- `output_id`
- `output_kind`
  - generated
  - library
  - prompt
  - upload
- `mode`
  - image
  - video
  - audio
  - text
- `created_at`
- `sort_key`
  - stable recency/order key for all-refs materialization

Optional but likely useful:

- `generation_id`
- `prompt_id`
- `primary_saved_media_id`

## 2. Visibility and membership fields

Required:

- `is_archived`
- `hidden_in_reference_grid`
- `is_quick_slot_member`
  - if this is stored here instead of only in checkpoint ids

Optional:

- `is_pinned`
- `is_active_selection_candidate`

## 3. Display content fields

Required:

- `preview_text`
  - for prompt/text cards and fallback label display
- `display_prompt_summary`
  - compact prompt text if drag/export or UI affordance needs it
- `model_label`
  - if cards still display human-friendly model context

Optional:

- `width`
- `height`
- `duration_ms`
- `mime_type`
- `audio_source_mode`

## 4. Media authority fields

Required:

- `authority_tier`
  - reusable
  - tracked
  - preview_only
- `preview_storage_path`
- `full_storage_path`
- `preview_poster_storage_path`
- `preview_url_fallback`
- `preview_poster_url_fallback`
- `result_url_fallback`
- `saved_media_ids`

Important note:

The contract should prefer stable durable asset pointers over transient URL copies. Fallback URLs are still useful, but they should stop being the main project durability unit.

## 5. Lifecycle fields

Required:

- `status`
- `task_state`
- `queue_state`
- `save_state`

Optional:

- `error_message_short`
- `retryable`

These fields support loading visuals and weakly tracked generated-output recovery without needing the whole original output row.

## 6. Recovery / sync identity fields

Required for generated or tracked outputs:

- `generation_id`
- `task_id`
- `source_ref`
- `generation_trace_id`

These should live on the display record or a closely attached sync/recovery record, not in the lightweight checkpoint shell.

## 7. Media subtype extras

Video:

- `preview_poster_storage_path`
- `preview_poster_url_fallback`

Audio:

- `companion_art_storage_path`
- `companion_art_url_fallback`

Text / prompt-only:

- `preview_text`
- `display_prompt_summary`

## What Should Not Live Here

This contract should avoid becoming a disguised full output row.

Keep out unless proven necessary:

- full `generationReplay`
- `characterContext`
- `styleContext`
- long transcript bodies
- verbose provider error detail
- large waveform arrays unless first-paint audio cards truly need them
- raw chat/runtime provenance

Those belong in deeper detail or projection layers.

## Relationship To The Checkpoint

The checkpoint should store:

- output ordering / membership
- quick-slot membership ids
- removed ids
- active selection id
- canvas references to output ids

The display record should store:

- the data needed to render, hydrate, and reason about those output ids

That means checkpoint rows can shrink dramatically without losing first-paint coherence.

## Relationship To Incremental Updates

This record is the strongest current target for incremental persistence.

Good update units would be:

- output added
- output updated
- output archived/restored
- output visibility changed
- output delivery authority improved
- quick-slot membership changed

The checkpoint itself should not be rewritten for each rich output field change if ordering and shell state did not change.

## Recommended Next Decision

The next architecture pass should decide whether `ProjectOutputDisplayRecord` is maintained by:

1. direct per-entity version updates
2. append-only revisions that materialize into display rows
3. a hybrid of revisions plus materialized display rows

At this point, that is the highest-value remaining architecture decision.
