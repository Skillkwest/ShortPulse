# Large Project Persistence: Build Contract V1

Date: 2026-06-03

Purpose: convert ADR 0089 into the next implementation-grade contract by defining:

- the exact lightweight checkpoint boundary,
- the exact project-owned output display record boundary,
- the one-source-of-truth rule for ordering, membership, and display authority,
- and the mutation surface that should drive the rebuild.

This contract is intentionally repo-backed and migration-aware. It is not a speculative end-state detached from the current ShortPulse persistence model.

## Alignment Audit

This contract stays aligned with the existing project persistence ADR stack:

- ADR 0063:
  - preserve `projectId` as the durable boundary
  - keep project restore as board restore, not session replay
- ADR 0064:
  - keep global user-owned media and prompt inventory
  - keep project association additive, not duplicative
- ADR 0065:
  - keep generated-output membership project-owned
  - preserve bootstrap-first, async-materialization-second restore posture
- ADR 0070:
  - keep conversational runtime out of the durable project checkpoint hot path
- ADR 0085:
  - keep Media Library folder authority global rather than project-local
- ADR 0089:
  - shrink the checkpoint
  - move heavy output state to project-owned output display records
  - use per-record versioning as the primary incremental write model

The most important repo-truth constraint is this:

**ShortPulse project reopen is currently a durable board restore, not a replay of the last authoring shell.**

That means the new checkpoint must stay focused on board/bootstrap state, not quietly grow back into a rich session envelope.

## Canonical Source Of Truth Split

The rebuild should enforce one authority surface per concept.

### Checkpoint owns

- active project output membership
- active output ordering
- Quick Slot membership and ordering
- removed-from-all-refs membership
- active output selection identity
- durable canvas state and output references
- compatibility bootstrap metadata

### Output display records own

- card/render display state
- media authority pointers
- output lifecycle/loading status that affects cards
- generation recovery identity
- compact prompt or preview text needed for display and drag/export affordances
- output-scoped visibility flags such as `hiddenInReferenceGrid`

### Existing global and association seams still own

- global generation inventory:
  - `ai_generations`
  - `generation_projection`
  - `generation_publications`
- global media and prompt inventory:
  - `media_files`
  - `media_prompts`
- project membership:
  - `project_generation_items`
  - `project_media_items`
  - `project_prompt_items`

### Keep out of the hot persistence seam

- full conversational runtime
- full generation replay payloads
- style and character context payload duplication
- long transcript and provider error detail
- waveform-heavy audio detail unless first-paint proves it is needed

## Lightweight Checkpoint Contract

The large-project checkpoint should remain the project bootstrap seam. During migration it may still be wrapped in the current shared snapshot envelope, but its semantic payload should narrow to the following.

### Checkpoint metadata

- `schemaVersion`
- `updatedAt`
- `meta.generatedAt`
- `meta.checksum`
- `meta.checkpointRevision`
  - new monotonic checkpoint revision for freshness and structure ordering

### Checkpoint structural payload

#### `outputs.active`

Keep `outputs.active`, but narrow it from rich `AiStudioSessionOutputV1` rows to ordered checkpoint stubs.

This preserves the current restore parser shape while removing the rich-output payload from the checkpoint hot path.

Recommended stub fields:

- `id`
- `mode`
- `mediaSource`
- `createdAt`
- `generationId`

The order of `outputs.active` remains the canonical active output ordering for restore and all-refs materialization.

#### `outputs.activeOutputId`

Keep as the canonical durable selected output id.

#### `outputs.curatedReferenceIds`

Keep as the canonical Quick Slot membership and ordering list.

This stays checkpoint-owned. Do not duplicate Quick Slot membership on output display records.

#### `outputs.removedFromAllRefsIds`

Keep as the canonical durable suppression list for active outputs intentionally removed from All Refs.

This stays checkpoint-owned. Do not duplicate it on output display records.

### Canvas payload

Keep durable canvas state on the checkpoint:

- scene items
- output references
- media references
- viewport/camera state
- text canvas content

Do not restore transient edit or selection state.

### Pulse-only project payload

Keep any currently authorized project-owned `pulseChats` payload only if it remains consistent with ADR 0070.

### Compatibility workspace shell

The current snapshot envelope still carries `workspace`, `agent`, and `agentRuntimes`, but for large-project architecture they are compatibility shell fields, not the heavy-output authority seam.

This build contract does not expand workspace-shell durability beyond the current project contract.

## Fields Explicitly Excluded From The Checkpoint

The checkpoint should not remain responsible for these fields on active outputs:

- `prompt`
- `transcriptText`
- `resultUrls`
- `previewUrl`
- `previewPosterUrl`
- `companionArtUrl`
- `previewStoragePath`
- `fullStoragePath`
- `previewPosterStoragePath`
- `companionArtStoragePath`
- `savedMediaIds`
- `saveState`
- `saveError`
- `status`
- `queueState`
- `queueEnqueuedAtMs`
- `generationTraceId`
- `submissionMode`
- `errorMessage`
- `errorMessageShort`
- `errorDetail`
- `audioSourceMode`
- `durationMs`
- `waveformPeaks`
- `previewTier`
- `width`
- `height`
- `pinned`
- `archivedAt`
- `archiveReason`
- `characterContext`
- `styleContext`
- `generationReplay`

If one of those is needed for right-rail rendering, hydration, export, preview, or generated-output recovery, it belongs on the output display record or deeper derived/global seams.

## Project Output Display Record Contract

The new heavy-output persistence seam should be a project-owned table referred to here as `project_output_display_items`.

One record represents one project-visible active output.

### Primary key and freshness

- `project_id`
- `output_id`
- `version`
  - monotonic per-record version
- `updated_at`

Recommended uniqueness:

- primary key: `project_id`, `output_id`

### Identity and provenance

- `output_id`
- `mode`
- `media_source`
- `created_at`
- `generation_id`
- `prompt_id`
- `task_id`
- `source_ref`
- `generation_trace_id`

### Display content

- `preview_text`
- `display_prompt_summary`
- `mime_type`
- `width`
- `height`
- `duration_ms`

Keep `display_prompt_summary` compact. The full authoring prompt should remain outside this hot seam unless a future product requirement proves otherwise.

### Media authority

- `preview_storage_path`
- `full_storage_path`
- `preview_poster_storage_path`
- `companion_art_storage_path`
- `preview_url_fallback`
- `preview_poster_url_fallback`
- `companion_art_url_fallback`
- `result_urls_fallback`
- `saved_media_ids`

Rule:

- durable storage-path authority is preferred
- fallback URLs are compatibility data, not primary durable authority

### Lifecycle and card state

- `task_state`
- `queue_state`
- `save_state`
- `status`
- `error_message_short`
- `hidden_in_reference_grid`

`hidden_in_reference_grid` belongs here because it is output-scoped card visibility state, not board structural membership.

### Intentionally excluded from the display record

Do not let the new display record become a disguised copy of `AiStudioSessionOutputV1`.

Keep out unless later evidence proves otherwise:

- `prompt`
- `transcriptText`
- `errorMessage`
- `errorDetail`
- `provider`
- `model`
- `modelId`
- `submissionMode`
- `queueEnqueuedAtMs`
- `waveformPeaks`
- `characterContext`
- `styleContext`
- `generationReplay`
- raw chat/runtime provenance

## One-Source-Of-Truth Decisions

These choices matter because they prevent the split architecture from turning into duplicate authority.

### Active output ordering

- source of truth: checkpoint `outputs.active` order
- not duplicated on display records

### Quick Slot membership and ordering

- source of truth: checkpoint `outputs.curatedReferenceIds`
- not duplicated as `is_quick_slot_member` on display records

### Removed-from-all-refs suppression

- source of truth: checkpoint `outputs.removedFromAllRefsIds`
- not duplicated on display records

### Active selection

- source of truth: checkpoint `outputs.activeOutputId`

### Card visibility state

- source of truth: display record `hidden_in_reference_grid`

### Media render authority

- source of truth: display record media authority fields

### Canvas references

- source of truth: checkpoint canvas state

## Mutation Surface

The incremental model should distinguish between:

- checkpoint mutations
- display-record mutations
- coordinated mutations that touch both in one transaction

### 1. `add_output_to_project`

Touches both surfaces.

Effects:

- upsert a new `project_output_display_items` row
- append a new checkpoint stub to `outputs.active`
- optionally add the id to `curatedReferenceIds`
- optionally set `activeOutputId`
- increment checkpoint revision
- initialize display-record version at `1`

### 2. `patch_output_display_item`

Display-record-only mutation.

Use for:

- media authority improvement
- prompt summary update
- lifecycle/status change
- fallback URL improvement
- generated-output recovery metadata improvement
- `hidden_in_reference_grid` change

Effects:

- patch one display record
- increment that record version
- do not rewrite checkpoint if membership/order did not change

### 3. `set_quick_slot_membership_and_order`

Checkpoint-only mutation.

Effects:

- replace `curatedReferenceIds`
- increment checkpoint revision

### 4. `set_removed_from_all_refs`

Checkpoint-only mutation.

Effects:

- replace `removedFromAllRefsIds`
- increment checkpoint revision

### 5. `set_active_output_selection`

Checkpoint-only mutation.

Effects:

- update `activeOutputId`
- increment checkpoint revision

### 6. `reorder_active_outputs`

Checkpoint-only mutation.

Effects:

- reorder checkpoint `outputs.active`
- increment checkpoint revision

### 7. `patch_canvas_state`

Checkpoint-only mutation.

Effects:

- update durable canvas state
- increment checkpoint revision

### 8. `remove_output_from_active_project_view`

Coordinated mutation.

Use for:

- archive/cleanup/removal flows that should no longer be durably restored on the project board

Effects:

- remove output id from checkpoint `outputs.active`
- remove output id from `curatedReferenceIds`
- remove output id from `removedFromAllRefsIds`
- clear `activeOutputId` if it matches
- prune or rewrite canvas references that still point at the removed output id
- delete or tombstone the display record
- increment checkpoint revision

Important note:

Current project restore intentionally does not persist archived output inventory. This mutation should preserve that contract unless a future ADR explicitly changes it.

## Read / Restore Contract

The storage contract and the transport contract may temporarily differ during migration.

### Canonical storage truth

- checkpoint owns bootstrap structure
- display records own rich active output display state

### Migration-friendly transport posture

ShortPulse may continue serving the existing `/api/projects/:projectId/workspace` route during migration, but the server should increasingly materialize its compatibility response from:

1. lightweight checkpoint
2. output display records
3. project association and global projection seams

That lets the product keep its route surface while changing the underlying scaling law.

## First Implementation Recommendation

The safest first implementation cut is:

1. keep the current project workspace route shape
2. shrink checkpoint `outputs.active` to ordered stubs
3. introduce `project_output_display_items`
4. materialize current rich output payload from checkpoint stubs plus display records on read
5. then move write flows from full snapshot rewrite toward coordinated checkpoint/display-record mutations

This is the highest-ROI path because it changes storage authority first without forcing a simultaneous API transport rewrite.

## Open Questions To Carry Into The Build Spec

1. Should `meta.checkpointRevision` be stored inside the checkpoint JSON only, or also as a first-class column for atomic write protection and queryability?
2. Should display-record deletion be hard delete or tombstone?
3. Should project card previews move directly to display-record-backed projection, or continue through the workspace route during migration?
4. Does any shipped first-paint workflow truly need more than the structural checkpoint stub fields listed above?

The next implementation spec should answer those four questions before schema and route work begins.
