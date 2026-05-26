# ADR 0063: Project Workspace Authority

## Status

Accepted

## Date

2026-04-23

## Context

ADR 0062 established `projectId` as the new top-level durable identity for Projects, but AI Studio restore/write behavior was still anchored to the legacy `sid` session system and several browser-global persistence paths.

That left project routes with an identity boundary but no project-owned workspace authority. The result was continued drift between project entry, visible project title, workspace restore behavior, and browser-global state such as workflow settings, chat mode, and selected character.

## Decision

1. Introduce a user-owned `project_workspace_states` table keyed by `project_id`.
2. Expose that authority through authenticated `GET|PUT /api/projects/:projectId/workspace`.
3. Reuse the current AI Studio session snapshot envelope as the temporary project workspace schema boundary during migration.
4. When `projectId` is present on `/ai-studio`, project routes must:
   - resolve the owned project first,
   - load/save workspace snapshots through project workspace authority,
   - stop using the legacy remote `sid` snapshot path as primary durable authority.
5. On project routes, disable browser-global workflow-settings persistence, chat-mode local storage persistence, and selected-character local storage persistence so those session-era fields do not leak back into project reopen.
6. Project restore from workspace authority must now rehydrate durable project content only and fail closed to the shipped blank Create shell instead of replaying workflow-shell state from saved workspace data.
7. Keep plain `/ai-studio` routes without `projectId` on the legacy `sid` path until later migration phases complete.

## Consequences

- Positive:
  - Project routes now have one project-owned workspace restore/write seam.
  - Visible project identity and workspace durability move onto the same top-level boundary.
  - Browser-global leakage is reduced for the current workspace envelope without waiting for full asset-association cutover.
  - Project reopen now behaves like a durable working board restore instead of a replay of the last workflow shell state.
- Negative:
  - The temporary snapshot schema still carries session-era shape and semantics until later phases replace it with fully project-native authority.
  - Generated-output authority, media/prompt association, and Media Library folder ownership still remain outside full project scope for now.
  - `projectId` and `sid` still coexist, so the system remains partially dual-authority during migration.

## Follow-ups

1. Move generated-output hydration and asset association onto project-owned authority.
2. Introduce project-scoped Media Library folder authority.
3. Retire or sharply demote legacy `sid` persistence after project-owned restore is complete.
