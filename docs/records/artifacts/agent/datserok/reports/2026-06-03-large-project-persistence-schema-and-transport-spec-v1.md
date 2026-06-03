# Large Project Persistence: Schema And Transport Spec V1

Date: 2026-06-03

Purpose: answer the remaining implementation-shaping questions left open by the build contract and define the first schema and transport decisions for the large-project persistence rebuild.

## Decisions

### 1. Checkpoint revision must be a first-class column

Decision:

- add `checkpoint_revision bigint not null` to `project_workspace_states`
- keep `meta.checkpointRevision` mirrored inside the stored checkpoint payload

Reason:

- ordering and structural membership remain checkpoint authority
- checkpoint freshness must be atomically writable and queryable
- JSON-only revisioning would repeat the weakness that led to `snapshot_updated_at`
- the existing `snapshot_updated_at` column remains useful for compatibility freshness and stale-write protection, but it is not the same thing as checkpoint structural revision

Meaning:

- `snapshot_updated_at` continues to describe compatibility snapshot freshness
- `checkpoint_revision` becomes the canonical monotonic version for checkpoint structure
- `meta.checkpointRevision` is a mirrored self-description field, not the database authority seam

### 2. `project_output_display_items` should hard delete, not tombstone

Decision:

- the canonical active-output display table should hard delete records when an output leaves the active durable project board

Reason:

- current project restore intentionally does not persist archived output inventory
- the active display table is a performance seam, not a historical ledger
- history and ownership already survive elsewhere:
  - global generation/media/prompt inventory
  - project association tables
  - project checkpoint revisions
- tombstones would add long-term row growth and extra query complexity without serving the current product contract

Future posture:

- if ShortPulse later adds durable project archive inventory, that should be a separate explicit contract, not an implied tombstone burden on the active display table

### 3. Project-card previews should move off snapshot parsing, but not through the workspace route

Decision:

- do not keep project card previews coupled to rich `project_workspace_states.snapshot` parsing
- do not route project previews through `GET /api/projects/:projectId/workspace`
- instead, move preview resolution into a server-side composition in `projectsService` that reads:
  1. lightweight checkpoint ordering and Quick Slot ids
  2. `project_output_display_items` media authority and visibility

Reason:

- preview ranking depends on checkpoint authority:
  - `outputs.curatedReferenceIds`
  - active output order
- preview media authority depends on display-record fields:
  - storage paths
  - fallback URLs
  - `hidden_in_reference_grid`
- this composition preserves one source of truth per concept without making the list view depend on a full workspace bootstrap route

Migration posture:

- during coexistence, `projectsService` should prefer checkpoint + display records
- if display records are absent for a project, fall back to the current snapshot-derived preview logic

### 4. No shipped first-paint workflow requires more than structural checkpoint stubs in storage

Decision:

- the checkpoint storage contract can stay structural only
- first-paint richness should be provided by the transport/materialization layer, not by keeping rich output rows in checkpoint storage

Reason from repo truth:

- the current restore client hydrates from one compatibility snapshot payload
- reference-grid and right-rail consumers need rich output fields at hydrate/render time
- they do not require those fields to be persisted in the checkpoint row itself if the read path can materialize them before client hydration

Meaning:

- keep storage lean
- keep transport compatible during migration
- do not let “first paint needs rich cards” become a reason to keep rich output payload inside checkpoint storage

## Proposed Schema Additions

### `project_workspace_states`

Add:

- `checkpoint_revision bigint not null`

Keep:

- `project_id`
- `user_id`
- `schema_version`
- `snapshot`
- `snapshot_updated_at`
- `created_at`
- `updated_at`

Behavior:

- checkpoint writes increment `checkpoint_revision`
- display-record-only writes do not touch `checkpoint_revision`
- writes that change checkpoint structure and display records together update both atomically

### `project_output_display_items`

Recommended columns:

- identity:
  - `project_id`
  - `user_id`
  - `output_id`
  - `version bigint not null`
  - `source_snapshot_updated_at timestamptz not null`
  - `created_at`
  - `created_record_at`
  - `updated_at`
- provenance:
  - `mode`
  - `media_source`
  - `generation_id`
  - `prompt_id`
  - `task_id`
  - `source_ref`
  - `generation_trace_id`
- display:
  - `preview_text`
  - `display_prompt_summary`
  - `mime_type`
  - `width`
  - `height`
  - `duration_ms`
- media authority:
  - `preview_storage_path`
  - `full_storage_path`
  - `preview_poster_storage_path`
  - `companion_art_storage_path`
  - `preview_url_fallback`
  - `preview_poster_url_fallback`
  - `companion_art_url_fallback`
  - `result_urls_fallback jsonb`
  - `saved_media_ids jsonb`
- lifecycle:
  - `task_state`
  - `queue_state`
  - `save_state`
  - `status`
  - `error_message_short`
  - `hidden_in_reference_grid boolean not null default false`

Recommended constraints:

- primary key: `project_id`, `output_id`
- same-user composite foreign-key constraints aligned with existing project association posture
- `source_snapshot_updated_at` is the stale-write guard for display-only updates that do not rewrite the checkpoint row
- `created_at` represents the source output timestamp when available; `created_record_at` represents the display-record row creation timestamp
- indexes:
  - `project_id, updated_at desc`
  - `project_id, generation_id`
  - `project_id, prompt_id`

## Transport Contract

### Keep the route shape during migration

`GET|PUT /api/projects/:projectId/workspace` remains the public project bootstrap route during the rebuild.

Reason:

- minimizes client churn
- keeps restore orchestration stable
- lets the server shift storage authority first

### Change what the route is backed by

During migration, the route response should become a compatibility projection assembled from:

1. lightweight checkpoint
2. display records
3. project association/global projection seams only where fields are still intentionally late-bound

This means:

- stored checkpoint payload becomes lean
- returned compatibility snapshot can remain richer until client/runtime cutover is ready

### Write path posture

ShortPulse should not keep treating the route payload as the canonical stored object.

Instead:

- the route receives a compatibility snapshot
- the server normalizes it into:
  - checkpoint mutations
  - display-record mutations
  - project association backfills where still required
- the route can still respond with a compatibility snapshot plus save outcome

## Phase Decisions

### Phase 1

- add `checkpoint_revision`
- add `project_output_display_items`
- backfill `project_output_display_items` from existing rich `project_workspace_states.snapshot.outputs.active` rows
- keep route shape unchanged
- keep current compatibility response format unchanged

### Phase 2

- write checkpoint stubs instead of rich output rows
- backfill display records from current snapshots
- read path materializes rich compatibility outputs from checkpoint + display records

### Phase 3

- list-project previews prefer checkpoint + display-record composition
- workspace save converts compatibility snapshot input into coordinated incremental writes

### Phase 4

- transport may optionally become more explicitly project-native later, but this is not required for the first rebuild

## Non-Decisions

This spec intentionally does not require:

- a full event store
- a new public route family
- a new project archive model
- a separate preview projection table in the first cut

The chosen path is the smallest architecture shift that changes the scaling law at the measured hotspot.
