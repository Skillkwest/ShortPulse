# ADR 0066: Project Media Library Folder Authority

Superseded by ADR 0085.

## Status

Accepted

## Date

2026-04-24

## Context

ADR 0064 kept `media_files` and `media_prompts` as the canonical user-global inventory. That was the right base, but the visible Media Library custom-folder area still used the legacy user-scoped `media_folders` authority. Under that model, creating folders inside one project would leak those folders into every other project for the same user.

The product contract for Projects is narrower than "make the whole Media Library project-local":

- left-rail libraries remain broadly user-global
- `All Media` remains the caller's global saved inventory
- the project title and visible custom-folder area are project-specific
- project folders can organize saved media and saved prompts without duplicating the underlying assets

## Decision

1. Keep `All Media` global and continue using `media_files` / `media_prompts` as the canonical saved inventory.
2. Introduce project-scoped folder tables:
   - `project_media_folders`
   - `project_media_folder_media_items`
   - `project_media_folder_prompt_items`
3. Add authenticated project folder routes under `/api/projects/:projectId/media/folders/*` for list/create/rename/move/delete/membership-batch.
4. Treat project folders as an organization layer over existing saved assets, not as duplicated asset storage.
5. Extend `/api/media/list` and `/api/media/prompts/list` with optional `projectId` on folder-scoped requests so the same list surfaces can resolve through project membership tables while root `All Media` stays global.
6. Fail closed on malformed `projectId` input rather than silently falling back to legacy user-global folder authority.
7. Leave legacy user-global folder routes in place for non-project surfaces until later cleanup.

## Consequences

- Positive:
  - Project folder trees and folder memberships are now isolated per project.
  - The shipped product behavior matches the intended UX: switching projects does not carry custom folders across.
  - The architecture stays additive and simple: no asset duplication and no forced cutover of `All Media`.
- Negative:
  - Folder authority is now split between legacy user-global routes and project-scoped routes during migration.
  - Project folder canvas persistence is still on the legacy user-scoped folder domain and needs a later cutover.
  - `All Media` still exposes the global inventory even on project routes, so project filtering is intentionally incomplete by design.

## Follow-ups

1. Decide whether project folder canvases get their own project-scoped persistence tables or a broader folder-canvas redesign.
2. Continue retiring legacy user-global folder paths once all project-facing Media Library entry points are cut over.
3. Keep generated-output authority moving toward project-owned seams so project reopen and live runtime behavior stay aligned.
