# ADR 0085: Global Media Library Folder Authority Across Project Routes

## Status

Accepted - 2026-05-28

## Context

AI Studio Projects correctly own project identity, project title, workspace snapshots, and project asset associations. They should not own a second Media Library folder system. The shipped project-folder split created a second authority for:

1. folder tree structure,
2. nested folder navigation,
3. media/prompt folder membership,
4. folder-canvas persistence.

That divergence forced the client, shared list APIs, server routes, schema, and tests to branch on `projectId`, even though the user expectation for Media Library folders matches the global `All Media` inventory: the same saved folders and nested contents should be reachable from any project.

## Decision

Adopt one global Media Library folder authority everywhere, including when AI Studio is opened with `?projectId=<uuid>`.

1. Canonical runtime folder tables are `media_folders`, `media_folder_media_items`, `media_folder_prompt_items`, and `media_folder_canvas_states`.
2. Project routes must use the same folder CRUD, membership, and folder-canvas APIs as non-project routes.
3. `/api/media/list` and `/api/media/prompts/list` must resolve folder-scoped queries only through the global membership tables.
4. Existing `project_media_folders*` data must be backfilled into the global tables before runtime cutover.
5. Imported folder ids are preserved so memberships and folder-canvas rows can move without client-visible remapping.
6. When imported sibling names collide, preserve both folders by suffixing only the conflicting imported name with the project title, then the project-id tail if needed, then a numeric counter.

## Migration posture

Migration `136_restore_global_media_folder_authority.sql` is the canonical cutover plan.

1. Import every `project_media_folders` tree into `media_folders`.
2. Import project media/prompt memberships into the global membership tables.
3. Import project folder-canvas snapshots into `media_folder_canvas_states`.
4. Cut the runtime to the global folder APIs and services.

Historical project-folder tables may remain temporarily after cutover only as rollback and verification scaffolding during the production transition window. They are no longer runtime authority once migration 136 and the route cutover are live.

Removal condition:

1. production migration 136 has completed,
2. targeted runtime validation confirms no active code path uses project-folder authority,
3. operator verification confirms imported global folder trees, memberships, and folder-canvas state are present.

## Consequences

1. Users get one folder tree across all projects.
2. Projects still own project title, workspace snapshots, and project asset associations.
3. The project API surface shrinks because folder routes no longer fork under `/api/projects/:projectId/...`.
4. Historical ADR 0066 and ADR 0067 are superseded.
