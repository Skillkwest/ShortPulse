# Large Project Persistence: Checkpoint Boundary Proposal

Date: 2026-06-03

Purpose: define the first concrete boundary proposal for the leading hybrid split architecture by separating:

- state that should remain in the lightweight project checkpoint,
- state that should move into incremental or materialized output persistence,
- and state that should stay out of the hot project durability path entirely.

This proposal is based on current repo behavior and production payload evidence, not on speculative redesign.

## Bottom-Line Recommendation

ShortPulse should stop treating `outputs.active` as one monolithic checkpoint payload.

The future hybrid model should split project durability into three tiers:

1. **Checkpoint shell**
   The minimum durable workspace state required to reopen the project into the correct board and UI context.
2. **Output materialization layer**
   Incremental, versioned, or revision-backed output display records that can rebuild the heavy right-rail and all-refs state without rewriting the whole checkpoint.
3. **Deep generation detail**
   Optional or late-bound generation metadata that should not be required for checkpoint bootstrap or first-paint board restore.

## Repo Truth Driving This Boundary

### 1. The current checkpoint already strips major runtime state

`createAiStudioProjectWorkspaceSnapshot(...)` in [projectWorkspaceSnapshot.ts](../../../../../../frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts) already:

- resets workspace authoring fields to neutral defaults
- strips agent conversation payloads
- normalizes outputs
- strips failed outputs
- trims generated-output payloads
- strips transient canvas editing state

That means the repo is already telling us the project checkpoint is supposed to be a **durable workspace board**, not a full live session replay.

### 2. Restore already behaves like shell first, projection second

The current restore flow in [useAiStudioProjectWorkspaceRestoreHydration.ts](../../../../../../frontend/features/ai-studio/hooks/useAiStudioProjectWorkspaceRestoreHydration.ts) and [projectGenerationAssociationsService.ts](../../../../../../frontend/lib/server/projectGenerationAssociationsService.ts) already splits behavior into:

- checkpoint hydration
- then later generated-output refresh/materialization

That is the strongest repo-local reason to formalize the split instead of continuing to overload the checkpoint.

### 3. The hot payload is still mostly output rows

On the production hot project:

- `611` active outputs
- about `747,823` bytes in `outputs.active` alone

Top per-field byte contributors inside `outputs.active` on that project:

- `fullStoragePath`: `84,221`
- `previewStoragePath`: `75,580`
- `prompt`: `31,053`
- `id`: `30,882`
- `generationTraceId`: `28,828`
- `previewText`: `28,464`
- `createdAt`: `27,811`
- `generationId`: `27,775`
- `sourceRef`: `26,117`
- `taskId`: `24,593`
- `savedMediaIds`: `23,838`
- `previewPosterStoragePath`: `23,019`
- `companionArtStoragePath`: `20,920`

This matters because it shows the weight is not mainly in canvas or workspace settings. It is in:

- media delivery authority paths
- output identity/recovery fields
- prompt/text display content

That is exactly the kind of state that should be evaluated field-by-field rather than forced through one giant checkpoint row.

## Proposed Boundary

## Tier 1: Lightweight Project Checkpoint

This tier should stay in `project_workspace_states` or its successor checkpoint store.

It should contain:

- project checkpoint metadata
  - schema version
  - checkpoint revision or checkpoint-produced-at timestamp
- workspace shell state that defines how the board reopens
  - selected mode/tool shell where still durable
  - create-mode reference state
  - selected character/look identity
  - pulse preset workspace identity only where ADR 0070 still allows it
  - durable create/edit/video settings that actually reopen authored work
- reference-grid and quick-slot structural state
  - `curatedReferenceIds`
  - `removedFromAllRefsIds`
  - `activeOutputId` if still needed by first-paint selection behavior
  - explicit output order list if all-refs ordering must remain stable
- canvas durable state
  - item positions
  - output/media references
  - viewport cameras
  - text canvas content
  - no transient selection or edit state
- minimal output stubs only where the checkpoint truly needs them for immediate board paint

### Recommended output stub shape

Instead of full `AiStudioSessionOutputV1` rows in the checkpoint, keep a much smaller per-output checkpoint stub for outputs that must exist at first paint.

That stub should likely include:

- `id`
- `mode`
- `createdAt`
- `hiddenInReferenceGrid`
- `pinned` if still meaningful for ordering or display
- `previewText` for prompt/text-only cards when no richer display record is available
- one minimal display-authority pointer, not the whole current media-delivery bundle
  - for example a stable preview asset key, media id, or projection row identity

It should not carry the whole current output row.

## Tier 2: Incremental Output Materialization Layer

This should become the new heavy project-state lane.

This layer should own:

- output display rows for generated/library/prompt references
- media delivery authority needed for cards and previews
- output save state and recoverable lifecycle state
- canonical output visibility / hidden status
- output ordering or recency materialization if all-refs depends on it
- enough detail to rebuild right-rail cards and reference-grid cards without needing whole-checkpoint rewrites

The current repo already has pieces of this direction:

- `project_generation_items`
- `generation_projection`
- generated-output refresh in [projectGenerationAssociationsService.ts](../../../../../../frontend/lib/server/projectGenerationAssociationsService.ts)

The architecture opportunity is to promote this from “repair/refresh helper” into “primary heavy-output persistence seam.”

## Tier 3: Deep Output / Generation Detail

This tier should not be required for checkpoint bootstrap.

It includes fields like:

- `generationReplay`
- `characterContext`
- `styleContext`
- long prompt bodies when not needed for first-paint card display
- transcript/error detail
- provider/request duplication that exists mainly for tracing or recovery
- rich waveform or companion-art metadata unless directly required on first paint

These can live in:

- projection tables
- generation rows
- normalized output detail tables
- or late-bound fetches keyed by output or generation identity

## Field-By-Field Recommendation

### Keep in the checkpoint

- workspace authored settings that determine reopen shell behavior
- quick-slot membership ids
- removed-from-refs ids
- active output selection identity if current UX needs it
- canvas item geometry and output/media references
- minimal text card content for prompt-only/text-only references
- stable ordering metadata for first paint

### Move out of the checkpoint hot path

- full storage-path bundles on every output row
- duplicate recoverable identity fields on every output row when a materialized output record can own them
- long prompt text on generated outputs
- generation replay payloads
- character/style context payloads
- detailed provider/error/runtime fields
- waveform-heavy audio detail unless it is required for immediate reopen paint

### Keep out of project checkpoint entirely

- conversational runtime
- transient canvas editing state
- ephemeral local-only media state
- finished outputs that have neither durable display authority nor recoverable identity

## First-Paint Principle

The correct design constraint is:

**The checkpoint should be just large enough to reopen the project into a coherent board immediately, but not so large that it is also acting as the full authoritative output inventory.**

That means:

- the user should see the right project shell, board, quick slots, and canvas immediately
- but the full output display richness can be refreshed or filled from the output materialization layer after bootstrap

This is already close to how generated-output refresh behaves today. The proposal is to make that split explicit and central.

## Best-Fit Architecture Implication

This boundary proposal strengthens Candidate 4 from the architecture matrix:

- lightweight checkpoint
- heavy output state moved into incremental materialization
- optional revision or version layer beneath that materialization

It also narrows the next architecture decision:

The main unresolved question is now not “what is a checkpoint?”

It is:

- what stable output record should the checkpoint point at,
- and whether those output records are updated through:
  - an append-only project revision stream,
  - per-entity versions,
  - or a hybrid of both

## Next Decision To Make

The next design pass should define the exact shape of:

1. `project checkpoint`
2. `project output display record`
3. `incremental update contract`

If those three contracts are made explicit, the rest of the large-project persistence rebuild becomes much easier to reason about and stage safely.
