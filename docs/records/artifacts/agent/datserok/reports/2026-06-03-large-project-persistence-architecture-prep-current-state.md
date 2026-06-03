# Large Project Persistence Architecture Prep: Current State

Date: 2026-06-03

Purpose: capture the first prep checkpoint for the large-project persistence architecture lane by locking the current invariants and mapping the current shipped project-persistence architecture before workload measurement or external research begins.

## Scope Of This Checkpoint

This report covers:

- current architectural invariants that the new large-project persistence design must respect unless a later product decision explicitly changes them,
- the current shipped end-to-end persistence architecture across save, read, restore, and generated-output refresh,
- current storage-model characteristics that matter for scaling,
- and the next measurement and research questions that should drive the rest of the prep lane.

This report does not select a new architecture yet.

## Current Invariants

These are the active constraints the architecture lane should treat as fixed until explicitly changed:

1. `projectId` is the top-level durable project boundary.
2. Project workspace durability is owned by `GET|PUT /api/projects/:projectId/workspace`.
3. Project workspace persistence is intentionally sanitized. It restores durable project content, not full session replay.
4. Project reopen must still fail closed safely when trusted durable state cannot be restored.
5. Project asset association is additive membership over user-global inventory, not duplicate project-local inventory.
6. Media Library folders remain global across projects under ADR 0085.
7. Project-generated-output association is a project-owned membership seam, but the canonical generation inventory and read models remain global.
8. Project routes reopen to a durable working board plus async generated-output refresh, not to a replay of the last chat session.
9. Visible project conversation continuity is not part of the durable project workspace contract.
10. The architecture may change internals, but it should not silently widen product-owned persistence beyond the current contract just to solve scaling.

## Current Architecture Map

### 1. Identity Layer

- Durable project identity starts with `projects.id` from ADR 0062.
- Runtime/session identity still coexists through `sid`, but current durable project save/restore authority is the project workspace route.
- The current architecture is therefore already dual-layered:
  - `projectId` for durable project scope
  - `sid` for lower-level runtime/session continuity

### 2. Client Save Pipeline

Current save orchestration runs through:

- `useAiStudioProjectWorkspacePersistenceController.ts`
- `useAiStudioSessionAutosave.ts`
- `projectWorkspaceApiClient.ts`

Current flow:

1. Build the base AI Studio session snapshot for the active project-aware route.
2. Patch or compose the project-persistence snapshot candidate on the client.
3. Generate autosave candidates from the full snapshot.
4. Try the candidates in this order:
   - full snapshot
   - without canvas
   - without archived outputs
5. Serialize the selected candidate and enforce snapshot-byte limits.
6. Queue one in-flight autosave request with newest-pending coalescing.
7. `PUT` the selected snapshot to `/api/projects/:projectId/workspace`.

Important scaling implication:

- The current system is still fundamentally a full-snapshot persistence model.
- The fallback candidates only remove `canvas` or `archived outputs`; they do not change the underlying model from snapshot rewrite to incremental persistence.

### 3. Server Save Pipeline

Current authoritative save runs through:

- `frontend/lib/server/projectApiRoutes/workspace.ts`
- `frontend/lib/server/projectWorkspaceStatesService.ts`

Current server flow:

1. Authenticate API user.
2. Validate `projectId`.
3. Resolve the owned project row.
4. Parse the incoming snapshot against the AI Studio session snapshot envelope.
5. Sanitize the snapshot through `createAiStudioProjectWorkspaceSnapshot(...)`.
6. Re-sanitize outputs by shape and storage/media trust rules.
7. Resolve owned ids synchronously before the durable write:
   - media ids
   - prompt ids
   - generation ids
   - runtime request/source-ref generation identities
8. Re-sanitize outputs again using those resolved authorities.
9. Upsert the entire sanitized snapshot into `project_workspace_states`.
10. After the durable write, best-effort backfill:
   - `project_media_items`
   - `project_prompt_items`
   - `project_generation_items`
11. If backfill fails, return `saved_with_repair_pending` instead of discarding the workspace write.

Important scaling implication:

- The current durable save model is still “rewrite one project-wide JSON snapshot row.”
- Save-time correctness still depends on synchronous prewrite ownership resolution against multiple tables before the write lands.
- Project association remains additive, but the write path is still snapshot-centric rather than delta-centric.

### 4. Server Read / Canonicalization Pipeline

Current authoritative read runs through `getProjectWorkspaceStateForUser(...)` in `projectWorkspaceStatesService.ts`.

Current read flow:

1. Read the `project_workspace_states` row for the user-owned project.
2. Re-run read-time canonicalization on the stored snapshot.
3. Resolve owned media, prompt, and generation authorities again for the read path.
4. Fail closed to an ownership-safe sanitized snapshot when read-time authority resolution degrades.
5. Return the sanitized snapshot to the client.

Important scaling implication:

- Restore correctness is protected by server-side canonicalization, not by trusting the raw stored snapshot.
- The system pays ownership-resolution cost on read as well as write.

### 5. Restore / Reopen Pipeline

Current restore orchestration runs through:

- `useAiStudioProjectWorkspaceRestoreCandidate.ts`
- `useAiStudioProjectWorkspaceRestoreHydration.ts`
- `useAiStudioProjectWorkspacePersistenceController.ts`
- `projectGenerationAssociationsService.ts`

Current reopen model:

1. Resolve the project-aware restore candidate from the server-canonical workspace row.
2. Fail closed to the blank project shell before async restore settles.
3. Hydrate the sanitized project workspace snapshot into the client runtime.
4. After bootstrap, refresh generated-output delivery asynchronously from project-associated generation rows and project-scoped projections.

Important scaling implication:

- Reopen is hybrid:
  - persisted sanitized snapshot first
  - generated-output refresh second
- The current architecture is already partially split between snapshot persistence and projection refresh, which is useful for future redesign.

### 6. Generated Output Refresh Layer

Current generated-output refresh authority lives in `projectGenerationAssociationsService.ts`.

Current flow:

1. Read project-associated generation ids from:
   - `project_generation_items`
   - project-scoped `generation_projection`
2. Build projection rows by generation id.
3. Resolve published media and owned media rows for durable display authority.
4. Patch or append snapshot output rows from associated projection rows.
5. Limit appended generation rows to a bounded recent set (`PROJECT_SNAPSHOT_GENERATED_OUTPUT_APPEND_LIMIT = 100`).

Important scaling implication:

- This layer already behaves more like a projection/materialization system than a pure snapshot system.
- It suggests that a future architecture can likely lean harder into checkpoint-plus-derived-refresh patterns.

## Current Storage Model

### Workspace Storage

The current project workspace table is still:

- one row per project in `project_workspace_states`
- one JSONB `snapshot` column containing the sanitized project workspace
- one `snapshot_updated_at` freshness field

That means:

- write cost grows with snapshot size,
- the durable unit of persistence is still the full workspace row,
- and partial project changes are not first-class persisted units.

### Association Storage

Project association is already normalized into additive tables:

- `project_media_items`
- `project_prompt_items`
- `project_generation_items`

This is one of the strongest current foundations for a future scalable architecture, because project membership is already separate from raw user-global inventory.

## Current Scaling Pressure Points From Architecture Alone

Without even using production telemetry yet, the repo already shows these structural scaling pressures:

1. The system persists a full project workspace snapshot as the durable write unit.
2. The client only has reduction fallbacks, not true incremental persistence.
3. Save-time correctness still pays synchronous multi-table ownership resolution before the durable write.
4. Read-time correctness also re-pays ownership resolution cost.
5. Restore uses a hybrid model, which is promising, but the checkpoint itself is still monolithic.
6. Generated-output refresh already acts like a secondary materialization lane, which means the current system is partway toward a split architecture without fully embracing one.
7. The current design still mixes:
   - document-style snapshot persistence
- membership-table association
- projection-based generated-output refresh
  rather than using one clearly unified persistence model.

## First Workload Evidence Slice

This first workload slice was measured directly from current production `project_workspace_states` rows on 2026-06-03.

### Population

- `21` total project workspace rows
- `5` unique users with saved project workspace rows

### Snapshot Size Distribution

- min: `2,073` bytes
- p50: `22,281` bytes
- p90: `187,062` bytes
- p95: `265,546` bytes
- max: `782,444` bytes

### Active Output Distribution

- min: `0`
- p50: `10`
- p90: `151`
- p95: `221`
- max: `611`

### Association / Identity Distribution

- generation ids:
  - p50: `4`
  - p95: `195`
  - max: `505`
- runtime request/source-ref identities:
  - p50: `6`
  - p95: `373`
  - max: `841`
- saved media ids:
  - p50: `7`
  - p95: `205`
  - max: `393`
- prompt ids:
  - p50: `0`
  - p95: `1`
  - max: `13`

### Payload Shape

The strongest current finding is that large-project payload mass is overwhelmingly in `outputs.active`.

For the top five largest workspace rows, `outputs.active` accounts for about:

- `95.6%`
- `97.7%`
- `98.4%`
- `97.7%`
- `83.7%`

of total snapshot bytes.

Archived outputs are currently not a major factor in production saved workspaces:

- archived output count p95: `0`
- archived output count max: `0`

This means the current fallback candidate that strips archived outputs is unlikely to be the primary scaling relief for real large projects.

### Concentration

The load is currently steeply concentrated:

- the largest single workspace row accounts for `43.5%` of all saved workspace bytes
- the top three workspace rows account for `68.7%`
- the top five workspace rows account for `80.7%`

This suggests the architecture lane should design for both:

1. normal small-to-medium projects
2. a small number of very large outlier projects that dominate persistence pressure

### Implication For Architecture

The first production slice points to a very specific scaling truth:

- the dominant large-project cost is not generic “workspace complexity”
- it is primarily large `outputs.active` persistence combined with the identity/association work that rides alongside it

That makes this architecture lane less about shaving tiny metadata and more about deciding whether large active-output state should keep living inside a full project snapshot write path at all.

## What The Current Architecture Is Good At

These are strengths worth preserving:

- clear durable project boundary
- server-authoritative sanitization
- additive project association instead of duplicated inventory
- fail-closed restore posture
- asynchronous generated-output refresh after first paint
- freshness guard against stale autosave overwrite

The future architecture should reuse these strengths rather than discarding them.

## What The Current Architecture Is Not Yet Optimized For

The current architecture is not yet optimized for:

- very large output-heavy projects
- save cost proportional to change size instead of total project size
- cheap repeated autosave on long-lived projects
- low-fanout correctness checks on every save
- durable partial updates as first-class write units
- explicit checkpoint plus revision separation

## Operational Pressure Slice

A second production slice on 2026-06-03 measured recent project-workspace telemetry over the last seven days. This is not full save accounting for every project, because the available Quick Slot telemetry is intentionally conditional. It is still strong enough to show the dominant pressure shape on the real hot project.

### Save Outcome Sample

From `telemetry.ai_studio.project_workspace.quick_slot_save_result`:

- `987` recent Quick Slot save-result events were found in the seven-day window.
- `977` of those events belonged to the largest project `c9776c74-ae1c-4bf0-a8c5-d7fe473ca30d`.
- All sampled outcomes in this window were `saved`, which means the current issue has moved from a pure failure lane into a scale-and-latency lane.

Lag from `snapshot_updated_at` to telemetry write time differed sharply by project size:

- hot large project (`782,438` bytes, `611` active outputs):
  - p50: `7,006 ms`
  - p90: `10,233 ms`
  - p95: `18,197 ms`
  - max: `245,199 ms`
- tiny projects (`22-25 KB`, `17-19` active outputs):
  - p50: `1,755 ms`
  - p90: `3,809 ms`
  - max: `3,969 ms`

This is not a perfect end-to-end save timer, but it is still a strong operational signal that the hottest large project pays materially more persistence lag than the tiny projects.

### Autosave Candidate Shape

From `telemetry.ai_studio.project_workspace.quick_slot_autosave_candidate` on the hot project:

- `5,456` autosave-candidate events were recorded in the seven-day window.
- `100%` of them used `fallback_kind = full`.
- prepared snapshot bytes:
  - min: `565,838`
  - p50: `782,438`
  - p95: `782,811`
  - max: `973,619`

This is one of the clearest architecture signals in the whole lane:

- the large project is still autosaving as a near-full snapshot almost every time,
- the current candidate-reduction model is not materially shrinking the hot write unit,
- and the fallback path that strips archived outputs is not doing real work for current production outliers.

### Workspace Read / Reopen Fetch Pressure

`telemetry.ai_studio.project_workspace.quick_slot_restore_apply` breadcrumbs include the actual `GET /api/projects/:projectId/workspace` fetch durations, which provides a useful read-path pressure sample.

Recent seven-day restore/read fetch durations:

- hot large project (`782,438` bytes, `611` active outputs):
  - p50: `2,681 ms`
  - p90: `3,454 ms`
  - p95: `3,606 ms`
  - max: `5,361 ms`
- medium project (`187,062` bytes, `151` active outputs):
  - p50: `1,306 ms`
  - p90: `1,509 ms`
  - max: `1,721 ms`
- tiny projects (`22-25 KB`, `17-19` active outputs):
  - p50: `859 ms`
  - max: `994 ms`

This is still only a sampled restore lane, not a universal read benchmark. Even so, it supports the same direction as the save metrics: large snapshot size is already showing up in user-facing reopen/read cost.

### Correct Path Check

This telemetry slice says the lane is starting down the correct path.

The evidence still points to the same root scaling issue:

- a small number of very large projects dominate saved workspace mass,
- those projects still persist mostly as full snapshots,
- and both save-adjacent lag and restore-adjacent fetch cost rise materially with project size.

That means the architecture lane should keep focusing on:

1. changing the write model for large projects,
2. reducing the amount of active output state that must move through the hot save path,
3. and separating durable checkpoints from more incremental or derived state.

## Remaining Measurement Questions

The next measurement step should answer the questions that are still unresolved after the first two production slices:

1. How much of save-time pressure comes from synchronous ownership resolution versus snapshot serialization versus association backfill versus network/queueing around the route?
2. How often do very large projects materially change `outputs.active` versus only small subsets of it?
3. What fraction of reopen value comes from the checkpoint snapshot versus the async generated-output refresh lane?
4. Are the heaviest projects mostly append-only growth, or do they also experience frequent reordering/editing of existing output-heavy state?
5. What additional telemetry should become first-class if ShortPulse moves to a checkpoint-plus-revision architecture?

## Next Research Questions

After measurement, external research should focus on:

1. checkpoint plus delta persistence for large long-lived documents
2. revision-log architectures for autosave systems
3. materialized-view refresh patterns for media-heavy workspaces
4. large-board / large-document reopen strategies
5. write models where correctness does not require full-document revalidation every save

## Prep-Lane Conclusion

The current ShortPulse architecture is not a blank slate. It is already a hybrid:

- monolithic sanitized workspace checkpoint
- additive normalized project association tables
- async projection-based generated-output refresh

That means the most likely future scaling direction is not “invent persistence from nothing.”  
It is to decide how far ShortPulse should move from:

- full-snapshot rewrite

toward:

- checkpoint plus revision/delta persistence
- more incremental association/materialization updates
- and a clearer separation between durable source-of-truth writes and restore-time projections

The lane now has enough evidence to begin targeted external research and candidate-architecture comparison, as long as that research stays anchored to this production truth:

- very large outlier projects are real, not hypothetical,
- `outputs.active` dominates the hot payload,
- current autosave still behaves like near-full snapshot rewrite for those outliers,
- and both save-adjacent and restore-adjacent cost are already materially worse on the hot projects.

The next correct step is therefore:

1. one more repo-backed measurement pass only if it directly answers one of the unresolved questions above,
2. then targeted external research into scalable persistence patterns for large long-lived workspaces,
3. then candidate-architecture scoring against ShortPulse's actual invariants and workload shape.
