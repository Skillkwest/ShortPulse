# ADR 0065: Project Generated Output Association And Restore Refresh

## Status
Accepted

## Date
2026-04-23

## Context
ADR 0064 established project-owned association for saved media and prompts, but project reopen still had a gap for generated outputs that had not been persisted as saved media.

That left project restore in an unstable middle state:
- fresh project routes no longer hydrated all user-global generated outputs,
- but saved project reopen could still depend on stale snapshot copies for generated-output delivery,
- and any refresh path outside the snapshot still risked falling back to user-global generation reads instead of project-owned membership.

Projects need a durable way to say "this generated output belongs to this project" even when the underlying output has not been promoted into `project_media_items`.

## Decision
1. Introduce `project_generation_items` as the durable project-owned association table for generated outputs, keyed by `project_id`, `generation_id`, and `user_id`.
2. Keep `ai_generations`, `generation_projection`, and `generation_publications` as the canonical global generation inventory/read models.
3. On project workspace saves, backfill `project_generation_items` from restore-relevant `generationId` values already present in the snapshot, filtering to caller-owned generations before association.
4. On project workspace reads, refresh snapshot output delivery only from generation rows that are explicitly associated to that project through `project_generation_items`.
5. Keep the current AI Studio snapshot envelope as the restore payload contract; this ADR changes generated-output authority, not the snapshot schema.

## Consequences
- Positive:
  - Project reopen now has a project-owned seam for generated outputs, not just saved media and prompts.
  - Workspace read can refresh stale generated-output delivery without scanning all user-global generation rows.
  - `All Media` and other user-global library surfaces remain unchanged.
- Negative:
  - Live generation polling and broader generation read-model usage still coexist with global generation tables until later migration phases.
  - Existing project snapshots created before this association exists may still rely on their saved snapshot copy until they are re-saved under the new contract.

## Follow-ups
1. Decide whether project routes should enforce generation association during live task reconciliation, not just during reopen.
2. Decide whether project folder membership should build directly on `project_generation_items`, `project_media_items`, or a higher-level project asset view.
3. Retire remaining session-era/global compatibility paths once project reopen is fully authoritative.
