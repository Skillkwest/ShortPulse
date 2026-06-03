# Large Project Persistence: Migration And Rollout Plan

Date: 2026-06-03

Purpose: define the safest staged cutover from rich checkpoint snapshots to lightweight checkpoints plus project output display records without breaking project reopen or preview behavior.

## Migration Principles

- keep `projectId` as the durable boundary
- keep restore fail-closed
- preserve one source of truth per concept
- prefer compatibility at the transport layer over duplicate storage authority
- do not require a flag day client rewrite

## Staged Rollout

### Stage 0: Additive schema only

Ship additive storage support:

- `checkpoint_revision` on `project_workspace_states`
- `project_output_display_items`

No runtime cutover yet.

### Stage 1: Backfill display records from current project snapshots

Build a backfill that reads current `project_workspace_states.snapshot.outputs.active` and writes one display row per active persisted output.

Backfill sources of truth:

- snapshot active outputs
- existing project association rows where useful for ownership checks
- generation/media/prompt global rows only when needed to fill missing durable authority fields

Backfill output:

- do not rewrite checkpoint structure yet
- do not change client behavior yet

Validation gate:

- sampled projects show checkpoint active ids and display-record ids in sync

### Stage 2: Dual-read, old-write

Read posture:

- workspace read path can materialize compatibility output payload from display records when present
- project preview path prefers checkpoint + display records when present
- otherwise fallback to current snapshot-derived behavior

Write posture:

- keep writing current checkpoint shape until read parity is proven

Validation gate:

- read parity holds on sampled empty, small, medium, large, and pathological projects

### Stage 3: New-write, compatibility-read

Write posture:

- workspace save normalizes incoming compatibility snapshot into:
  - lightweight checkpoint write
  - display-record upserts/deletes
  - existing project association backfills

Read posture:

- clients still receive compatibility snapshot responses

Validation gate:

- save correctness proven on concurrency and reopen tests
- hot-project checkpoint bytes materially drop

### Stage 4: Preview and restore fully prefer new authority

- project list previews stop parsing rich snapshot output rows when display records exist
- workspace bootstrap always prefers checkpoint + display records
- snapshot-rich fallback remains only for projects not yet rewritten/backfilled

Validation gate:

- no production regressions in project previews or reopen

### Stage 5: Remove old rich-output storage dependency

- stop relying on rich `outputs.active` rows as canonical storage
- keep only structural stubs in checkpoint
- remove compatibility-only fallback paths once production validation is complete

## Rollback Posture

### Safe rollback boundary

Rollback is safe through Stage 3 because:

- public route shape stays stable
- current snapshot envelope remains readable
- global inventory and project association seams remain unchanged

### Rollback method

- if new display-record reads regress, revert read preference to snapshot-derived paths
- if new writes regress, disable new-write normalization and continue from existing checkpoint authority
- additive schema can remain in place during rollback

### What not to do

- do not let checkpoint ordering/membership and display-record media authority both become writable from separate sources during rollback
- rollback must change preference, not create parallel durable authorities

## Compatibility Rules During Migration

Compatibility-only behavior allowed temporarily:

- rich compatibility snapshot responses assembled on read
- snapshot-derived project previews only when display records are not yet present
- fallback hydration from legacy rich checkpoint rows for not-yet-migrated projects

Not allowed:

- making rich checkpoint output rows canonical again after new-write cutover
- duplicating Quick Slot membership or active ordering on display records

## Validation Gates

Before advancing stages, require:

1. docs/spec parity is current
2. targeted tests cover the new stage
3. sampled production-like project shapes pass save and reopen checks
4. telemetry shows no silent drift between checkpoint ids and display-record ids

## First Implementation Sequence

Recommended order:

1. additive schema
2. backfill
3. read composition
4. write normalization
5. preview cutover
6. legacy rich-output dependency removal

This order keeps restore safer than attempting write-path and preview-path rewrites at the same time.
