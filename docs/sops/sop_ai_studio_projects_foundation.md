# SOP: AI Studio Projects Foundation

Purpose: define the currently shipped Projects contract so dashboard handoff, API behavior, AI Studio route identity, the global Media Library folder behavior visible on project routes, and the current project-owned workspace snapshot boundary are documented in one authoritative operational reference instead of being spread across planning docs.

## Scope

- In scope: `projects` table foundation, authenticated project create/list/read/update-title/workspace routes, dashboard `New Project` handoff, dashboard `Open Projects` handoff, project-aware AI Studio entry, AI Studio left-rail project switcher modal, project-title edits backed by `projects.title`, project-owned workspace snapshot read/write for project routes, project-owned media/prompt/generated-output association for save and reopen flows, the global Media Library folder system as seen from project routes, and current `projectId` + `sid` coexistence behavior.
- Out of scope: project-scoped `All Media`, any separate project-owned folder authority, full live generated-output authority cutover outside the shipped project route seams, and full legacy session cleanup.

## Current shipped contract

1. The dashboard `New Project` action asks for an initial project name, creates a real user-owned `projects` row with that normalized title, then routes into AI Studio.
2. The AI Studio left-rail `Projects` modal now also exposes `New Project`, asks for an initial project name, creates the same user-owned `projects` row, and switches the current studio route onto the new `projectId`.
3. Project creation is server-authoritative through authenticated API routes; the client does not insert directly into Supabase.
4. AI Studio currently accepts `?projectId=<uuid>` as the top-level project handoff boundary while legacy `sid` session identity still coexists during migration.
5. When `projectId` is present, AI Studio starts project workspace bootstrap as soon as the route id is syntactically valid, but the shell still stays gated until the owned project record resolves successfully.
6. The visible Media Library project title now reads from and writes to `projects.title`.
7. Project routes now load and save a project-owned workspace projection derived from the shared AI Studio snapshot envelope instead of the legacy remote `sid` snapshot route.
8. Project workspace persistence now keeps only durable project content: active output media for the shared right rail, Quick Slot Inventory and Reference Grid projection ids, durable Canvas scene items and cameras, plus the separately owned project title. The Media Library folder system remains user-global and is not project-owned workspace state. Project routes do not persist workflow shell state, typed composer text, active output focus, shared reference-selection state, Character Mode shell state, conversational runtime, or Expert Edit document state.
9. Opening or switching a project resets the project-visible agent conversation lane instead of restoring it from project workspace state.
10. Media and prompt saves that happen from a project route now attach those saved assets to the active project through project association tables.
11. Project workspace saves also backfill project asset associations from restore-relevant `savedMediaIds` and `promptId` values already present in the snapshot.
12. Project workspace saves now also backfill project-owned generation associations from restore-relevant `generationId` values already present in the snapshot.
13. Project workspace saves now use a two-phase contract: the sanitized workspace snapshot is written durably first, then project asset/generation association repair runs as a follow-up stage.
14. If that follow-up repair fails, the save returns `saved_with_repair_pending` instead of failing the durable workspace write, and the UI surfaces a warning that recent outputs may not fully restore until a later successful save.
15. Project workspace reads return the sanitized saved snapshot quickly; AI Studio refreshes project-associated generated-output delivery asynchronously after workspace bootstrap.
16. On project routes, the Media Library custom-folder area remains user-global and does not reset when the active project changes.
17. `All Media` remains the user-global inventory even on project routes.
18. Global folder membership continues to support saved media and saved prompts on project routes.
19. Folder canvas persistence now uses the same global folder authority on project and non-project routes.
20. Broader live generated-output authority cleanup is still follow-up work.
21. The AI Studio left-rail `Projects` action opens a saved-project modal, lists the full caller-owned project catalog through `GET /api/projects?limit=all`, supports in-modal project creation through `POST /api/projects/create`, and routes project selection to `/ai-studio?projectId=<uuid>` from inside AI Studio.
22. The dashboard `Open Projects` surface is a pure modal-launch action; it does not render project previews or inline saved-project state.
23. The shared Projects modal now supports permanent delete for non-current projects through `DELETE /api/projects/:projectId`; deleting a project removes its project-owned workspace and project-only association rows through database cascade, but it does not delete global Media Library folders or global folder canvas state.
24. Project cards in the shared Projects modal now render up to four snapshot-derived thumbnails. Thumbnail priority is: first four Quick Slot Inventory images, otherwise the first four visible Reference Grid images, otherwise no preview strip.
25. Storage-backed project-card thumbnails are signed as tiny dedicated project-card preview variants so the modal can render the stacked thumbnails without fetching larger preview assets than the surface needs.
26. Fresh AI Studio startup no longer auto-hydrates user-global generated outputs on plain `/ai-studio?sid=...` routes unless explicitly re-enabled by env flag, so new project and fresh-session startup can fail closed to empty workspace state while `All Media` remains global.

## Primary repo surfaces

| Surface                                                                                 | Role                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sql/migrations/089_add_projects_foundation.sql`                                        | Creates the foundational `projects` table and ownership policies.                                                                                                                                                                           |
| `frontend/lib/server/projectsService.ts`                                                | Canonical server helper for project create/list/read/update access and input normalization.                                                                                                                                                 |
| `frontend/pages/api/projects/index.ts`                                                  | Authenticated collection route used by the dashboard saved-project surface.                                                                                                                                                                 |
| `frontend/pages/api/projects/create.ts`                                                 | Authenticated create route used by the dashboard handoff and AI Studio in-modal project creation.                                                                                                                                           |
| `frontend/pages/api/projects/[...projectPath].ts`                                       | Sole dynamic project API dispatcher that keeps `/api/projects/:projectId*` reachable in Next dev/Turbopack while delegating to non-routable project handlers.                                                                               |
| `frontend/lib/server/projectApiRoutes/item.ts`                                          | Authenticated single-project handler for ownership checks, title updates, and permanent delete.                                                                                                                                             |
| `frontend/lib/server/projectApiRoutes/workspace.ts`                                     | Authenticated workspace handler used by project-aware AI Studio restore/write against the sanitized project snapshot projection.                                                                                                            |
| `frontend/pages/dashboard.tsx`                                                          | `New Project` UI entry plus an `Open Projects` action card that opens the shared saved-project modal and routes selection into AI Studio with `projectId`.                                                                                  |
| `frontend/pages/ai-studio.tsx`                                                          | Current AI Studio page entry where `projectId` coexists with legacy `sid`, gates restore on project resolution, routes visible title edits through project authority, and switches project routes onto project-owned workspace persistence. |
| `frontend/features/ai-studio/components/ProjectsModal.tsx`                              | Saved-project picker modal used by the AI Studio left rail to create, reopen, and delete owned projects without leaving AI Studio.                                                                                                          |
| `frontend/features/ai-studio/hooks/useAiStudioProjectIdentity.ts`                       | Canonical client hook for `projectId` query resolution, owned-project fetch, and AI Studio title updates.                                                                                                                                   |
| `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts` | Canonical client controller for project-owned workspace restore/apply and debounced autosave.                                                                                                                                               |
| `frontend/lib/server/mediaFoldersService.ts`                                            | Canonical server helper for the global Media Library folder tree, membership operations, and folder-access validation used on both project and non-project routes.                                                                          |
| `frontend/pages/api/media/list.ts`                                                      | Shared Media Library media list route that resolves folder-scoped requests through the global membership authority while keeping `All Media` global.                                                                                        |
| `frontend/pages/api/media/prompts/list.ts`                                              | Shared Media Library prompt list route that resolves folder-scoped requests through the global membership authority while keeping `All Media` global.                                                                                       |
| `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`                          | Canonical media/prompt save helper that now attaches saved assets to the active project while keeping the global library inventory user-scoped.                                                                                             |
| `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts`                    | Canonical AI Studio save/autosave hook that associates already-saved outputs/prompts with the active project without reuploading them.                                                                                                      |
| `frontend/lib/server/projectWorkspaceStatesService.ts`                                  | Canonical server helper for project-owned workspace read/write access and snapshot validation.                                                                                                                                              |
| `frontend/lib/server/projectGenerationAssociationsService.ts`                           | Canonical server helper for project-owned generated-output association and workspace-read delivery refresh.                                                                                                                                 |
| `docs/adr/0062-project-identity-foundation.md`                                          | Durable architectural decision establishing `projectId` as the new top-level identity.                                                                                                                                                      |
| `docs/adr/0063-project-workspace-authority.md`                                          | Durable architectural decision establishing project-owned workspace snapshot authority for project routes.                                                                                                                                  |
| `docs/adr/0064-project-asset-association-foundation.md`                                 | Durable architectural decision establishing project-owned association tables over global media/prompt inventory.                                                                                                                            |
| `docs/adr/0065-project-generated-output-association-and-restore-refresh.md`             | Durable architectural decision establishing project-owned generated-output association for reopen-time delivery refresh.                                                                                                                    |
| `docs/adr/0085-global-media-library-folder-authority.md`                                | Durable architectural decision restoring one global Media Library folder authority across project and non-project routes.                                                                                                                   |
| `docs/adr/0070-project-workspace-conversational-runtime-exclusion.md`                   | Durable architectural decision excluding conversational runtime from project-owned workspace persistence.                                                                                                                                   |

## Data model contract

Current project row shape:

- `id`
- `user_id`
- `title`
- `created_at`
- `updated_at`

Rules:

1. Project rows are always user-owned.
2. `title` is normalized server-side through `sanitizeProjectTitle(...)`.
3. Project ids must pass `parseProjectId(...)` UUID validation before read access.
4. Read and update access must fail closed on invalid ids and cross-user lookups.
5. Collection reads may only list caller-owned projects and must apply server-side bounded limits.

## Route contract

### `POST /api/projects/create`

Behavior:

1. Requires authenticated API user.
2. Accepts JSON input with optional `title`.
3. Creates one user-owned project row with a normalized title.
4. Returns:
   - `project.id`
   - `project.title`
   - `project.createdAt`
   - `project.updatedAt`

Operational notes:

1. Project creation is intentionally limited to project identity creation.
2. The route must not bootstrap the legacy user-global Media Library folder model.

### `GET /api/projects`

Behavior:

1. Requires authenticated API user.
2. Accepts optional bounded numeric `limit` query input and also accepts `limit=all` for the in-studio project switcher modal.
3. Returns recent caller-owned projects ordered by `updated_at desc`.
4. Each project row now also includes `previewImageUrls`, with up to four image URLs derived from the saved workspace snapshot.
5. Preview derivation prefers Quick Slot Inventory image outputs and falls back to visible Reference Grid image outputs only when the quick slot has no image previews.
6. Storage-backed preview rows are signed as tiny project-card thumbnail variants before `previewImageUrls` are returned.

### `GET|PATCH|DELETE /api/projects/:projectId`

Behavior:

1. Requires authenticated API user.
2. Validates `projectId` format before querying.
3. `GET` returns one caller-owned project row when found.
4. `PATCH` updates the caller-owned project title with server-side normalization.
5. `DELETE` permanently removes one caller-owned project and relies on project-owned table foreign keys to cascade workspace/folder/association cleanup.
6. Returns:
   - `400` for invalid project id
   - `404` for missing or non-owned project
   - `500` for unexpected server failure

### `GET|PUT /api/projects/:projectId/workspace`

Behavior:

1. Requires authenticated API user.
2. Validates `projectId` format before querying.
3. Resolves the owned project before workspace read/write proceeds.
4. `GET` returns the current caller-owned project workspace snapshot or `workspace: null` when none exists yet.
5. `PUT` validates the posted snapshot through the shared AI Studio snapshot parser before upsert.
6. Current storage contract intentionally reuses the AI Studio session snapshot envelope as a parser boundary, but project persistence sanitizes conversational runtime out of the stored payload.
7. `PUT` writes the sanitized workspace snapshot before association repair runs, so a later backfill failure does not discard the workspace save.
8. `PUT` may return `saveOutcome.status = "saved_with_repair_pending"` when the durable write succeeds but project association repair still needs follow-up.
9. `GET` does not block on generated-output projection/media refresh; project-associated generated outputs refresh asynchronously after AI Studio workspace bootstrap.
10. Returns:

- `400` for invalid project id
- `404` for missing or non-owned project
- `500` for unexpected server failure

## Dashboard and AI Studio handoff workflow

1. User clicks `New Project` or `Open Projects` on `/dashboard`.
2. `New Project` opens a naming modal, then calls `POST /api/projects/create` with the entered title.
3. `Open Projects` opens the shared saved-project modal, which loads the full caller-owned catalog through `GET /api/projects?limit=all`.
4. On project selection from that modal, the dashboard routes to `/ai-studio?projectId=<uuid>`.
5. On create failure, the dashboard keeps the user on `/dashboard` and surfaces a create-project error message.
6. Once already inside AI Studio, the left-rail `Projects` action reuses the same `projectId` handoff boundary by opening that shared saved-project modal, allowing in-modal `New Project` creation, allowing permanent delete for non-current projects, and routing the selected or newly created project back to `/ai-studio?projectId=<uuid>`.

## AI Studio identity boundary

1. `projectId` is now the top-level durable handoff identity for the Projects migration.
2. `sid` still exists as a lower-level runtime/session identity during migration.
3. When `projectId` is present, AI Studio may start project workspace bootstrap as soon as the route id is syntactically valid, but restore only becomes visible after the owned project record resolves successfully.
4. Current shipped behavior is coexistence, not full cutover.
5. Legacy `sid` remains the runtime identity for plain `/ai-studio` routes without `projectId`.

## AI Studio title authority

1. When AI Studio is opened with `?projectId=<uuid>`, the visible Media Library project title is read from the resolved project record.
2. Media Library title commits in that state call `PATCH /api/projects/:projectId` and do not mutate session-only title state.
3. Session-title fallback remains compatibility-only for plain `/ai-studio` routes that do not carry `projectId`.
4. Invalid or cross-user project ids fail closed and block AI Studio restore.

## AI Studio workspace authority

1. When AI Studio is opened with `?projectId=<uuid>`, project routes read/write workspace snapshots through `GET|PUT /api/projects/:projectId/workspace`.
2. The current workspace storage contract reuses the AI Studio session snapshot envelope as a temporary migration schema boundary, but project persistence sanitizes the project payload before write and ignores legacy conversational fields on restore.
3. Unsent Standard Create composer drafts, unsent Edit composer drafts, unsent Video composer drafts, unsent Sound workflow text drafts, and other workflow-shell fields are not restored from project workspace state; they persist only inside the current browser session while the page stays loaded.
4. Project routes do not use the legacy remote `sid` session snapshot API as their primary durable authority.
5. Project routes suppress browser-global workflow-settings session storage and selected-character local storage, and project reopen now fails closed to the shipped blank Create baseline instead of replaying workflow-shell state from the saved snapshot.
6. Project workspace writes reset the project shell back to the shipped blank Create baseline and do not preserve Pulse shell selection, Pulse session instance ids, Character Mode shell state, or active output focus.
7. Project workspace writes also backfill `project_generation_items` from restore-relevant `generationId` values already in the snapshot.
8. Project workspace reads return the sanitized saved snapshot without blocking on `project_generation_items` or generation projection/media hydration; after bootstrap, AI Studio refreshes generated-output delivery from project-owned generation rows rather than scanning all user-global generated outputs.
9. This does not change Media Library folder authority, which remains user-global across projects, and it does not yet make every live generation read path project-scoped.

## AI Studio Media Library folder authority

1. `All Media` remains the canonical user-global Media Library inventory on project routes.
2. The visible custom-folder area above `All Media` is also user-global on project routes.
3. Folder CRUD, folder membership, nested-folder traversal, and folder-canvas persistence all use the same global Media Library APIs on project and non-project routes.
4. Folder-scoped media and prompt listing always resolves through the global user-owned membership tables.
5. Saved media and saved prompts can be assigned to those global folders without duplicating the underlying `media_files` or `media_prompts` rows.
6. Switching to a different project must preserve the same visible folder tree, folder memberships, and folder-canvas state.
7. Project identity affects project-owned workspace persistence and asset association only; it does not create a separate folder authority.

## Project asset association

1. Global `media_files` and `media_prompts` remain the canonical user-owned inventory.
2. Project routes now attach saved media to `project_media_items`, saved prompts to `project_prompt_items`, and restore-relevant generated outputs to `project_generation_items`.
3. Manual save, autosave, and prompt-save flows on project routes use those association tables as the current durable project-ownership seam.
4. Re-saving an already-saved output on a project route should attach the existing media/prompt ids to that project without forcing a duplicate upload or duplicate prompt row.
5. Project workspace writes backstop those associations by extracting restore-relevant `savedMediaIds`, `promptId`, and `generationId` values from the saved snapshot and associating only ids that the caller already owns.
6. Project workspace reads keep the saved snapshot fast; AI Studio's post-bootstrap generated-output maintenance uses `project_generation_items` to refresh delivery for reopen without scanning all user-global generation rows.
7. The AI Studio autosave toggle governs automatic Media Library saving only. It does not disable private restore-durability persistence used to keep local project references restorable across reload or reopen.
8. This association layer is additive; it does not change the visibility of `All Media` or other user-global library surfaces yet.

## Explicit non-goals for the current shipped foundation

1. No project-scoped library filtering/cutover for `All Media` yet.
2. No full live generated-output authority cutover yet outside the shipped project workspace/project-route seams.
3. No `sid` retirement yet.

## Source-of-truth guidance

1. Use this SOP for the shipped Projects foundation contract.
2. Use ADR 0062 for the durable identity decision, ADR 0063 for project workspace authority, ADR 0064 for project media/prompt asset association, ADR 0065 for project generated-output association, ADR 0070 for project conversational-runtime exclusion, and ADR 0085 for global Media Library folder authority across project routes.
3. Use the `docs/planning/ai-studio-project-persistence-*.md` files only for future migration phases, not as the source of truth for already shipped behavior.

## Validation

- `npm -C frontend run test -- tests/api/projects-create.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioProjectIdentity.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioSessionIdentity.test.ts`
- `npm -C frontend run test -- tests/api/media-list.test.ts`
- `npm -C frontend run test -- tests/api/media-prompts-list.test.ts`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/mediaLibraryPanelApi.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioPageSessionPersistence.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioProjectWorkspaceRestoreCandidate.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioPersistenceActions.identity.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/mediaLibraryPersistence.test.ts`
- `npm -C frontend run test -- tests/api/media-list.test.ts`
- `npm -C frontend run test -- tests/api/media-prompts-list.test.ts`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/mediaLibraryPanelApi.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useMediaLibraryFoldersState.test.tsx`
- `npm -C frontend run test -- lib/server/__tests__/projectWorkspaceStatesService.test.ts`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/sessionSnapshot.test.ts`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts`
- `npm -C frontend run type-check`
- `npm -C frontend run docs:check`

## Follow-up lanes

1. Cut generated-output authority over to project-owned seams.
2. Decide whether restore-time verification needs to enforce association completeness beyond the current workspace-save backstop.
