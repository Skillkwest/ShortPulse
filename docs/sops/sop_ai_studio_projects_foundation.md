# SOP: AI Studio Projects Foundation

Purpose: define the currently shipped Projects contract so dashboard handoff, API behavior, AI Studio route identity, and the current project-owned workspace snapshot boundary are documented in one authoritative operational reference instead of being spread across planning docs.

## Scope
- In scope: `projects` table foundation, authenticated project create/list/read/update-title/workspace routes, dashboard `New Project` handoff, dashboard saved-project cards, project-aware AI Studio entry, AI Studio project-title edits backed by `projects.title`, project-owned workspace snapshot read/write for project routes, project-owned media/prompt association for save flows, and current `projectId` + `sid` coexistence behavior.
- Out of scope: project-scoped Media Library folders, full generated-output authority cutover, and full legacy session cleanup.

## Current shipped contract
1. The dashboard `New Project` action creates a real user-owned `projects` row before routing into AI Studio.
2. Project creation is server-authoritative through authenticated API routes; the dashboard does not insert directly into Supabase.
3. AI Studio currently accepts `?projectId=<uuid>` as the top-level project handoff boundary while legacy `sid` session identity still coexists during migration.
4. When `projectId` is present, AI Studio resolves the owned project record before restore continues.
5. The visible Media Library project title now reads from and writes to `projects.title`.
6. Project routes now load and save the shared AI Studio snapshot envelope through a project-owned workspace record instead of the legacy remote `sid` snapshot route.
7. Browser-global workflow-settings, chat-mode, and selected-character persistence are disabled on project routes so the project workspace snapshot becomes the current restore authority for those fields.
8. Media and prompt saves that happen from a project route now attach those saved assets to the active project through project association tables.
9. Project-scoped Media Library folders and full generated-output authority cutover are not shipped yet.

## Primary repo surfaces
| Surface | Role |
| --- | --- |
| `sql/migrations/089_add_projects_foundation.sql` | Creates the foundational `projects` table and ownership policies. |
| `frontend/lib/server/projectsService.ts` | Canonical server helper for project create/list/read/update access and input normalization. |
| `frontend/pages/api/projects/index.ts` | Authenticated collection route used by the dashboard saved-project surface. |
| `frontend/pages/api/projects/create.ts` | Authenticated create route used by the dashboard handoff. |
| `frontend/pages/api/projects/[projectId].ts` | Authenticated single-project item route for ownership checks and title updates. |
| `frontend/pages/api/projects/[projectId]/workspace.ts` | Authenticated workspace route used by project-aware AI Studio restore/write. |
| `frontend/pages/dashboard.tsx` | `New Project` UI entry plus recent-project cards that route into AI Studio with `projectId`. |
| `frontend/pages/ai-studio.tsx` | Current AI Studio page entry where `projectId` coexists with legacy `sid`, gates restore on project resolution, routes visible title edits through project authority, and switches project routes onto project-owned workspace persistence. |
| `frontend/features/ai-studio/hooks/useAiStudioProjectIdentity.ts` | Canonical client hook for `projectId` query resolution, owned-project fetch, and AI Studio title updates. |
| `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts` | Canonical client controller for project-owned workspace restore/apply and debounced save shadow. |
| `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts` | Canonical media/prompt save helper that now attaches saved assets to the active project while keeping the global library inventory user-scoped. |
| `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts` | Canonical AI Studio save/autosave hook that associates already-saved outputs/prompts with the active project without reuploading them. |
| `frontend/lib/server/projectWorkspaceStatesService.ts` | Canonical server helper for project-owned workspace read/write access and snapshot validation. |
| `docs/adr/0062-project-identity-foundation.md` | Durable architectural decision establishing `projectId` as the new top-level identity. |
| `docs/adr/0063-project-workspace-authority.md` | Durable architectural decision establishing project-owned workspace snapshot authority for project routes. |
| `docs/adr/0064-project-asset-association-foundation.md` | Durable architectural decision establishing project-owned association tables over global media/prompt inventory. |

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
2. Accepts optional `limit` query input within server-enforced bounds.
3. Returns recent caller-owned projects ordered by `updated_at desc`.

### `GET|PATCH /api/projects/:projectId`
Behavior:
1. Requires authenticated API user.
2. Validates `projectId` format before querying.
3. `GET` returns one caller-owned project row when found.
4. `PATCH` updates the caller-owned project title with server-side normalization.
5. Returns:
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
6. Current storage contract intentionally reuses the AI Studio session snapshot envelope while project-owned asset association is still migrating.
7. Returns:
   - `400` for invalid project id
   - `404` for missing or non-owned project
   - `500` for unexpected server failure

## Dashboard handoff workflow
1. `/dashboard` loads recent caller-owned projects through `GET /api/projects?limit=3`.
2. User clicks `New Project` or an existing project card on `/dashboard`.
3. `New Project` calls `POST /api/projects/create`.
4. On success, the dashboard routes to `/ai-studio?projectId=<uuid>`.
5. On create failure, the dashboard keeps the user on `/dashboard` and surfaces a create-project error message.

## AI Studio identity boundary
1. `projectId` is now the top-level durable handoff identity for the Projects migration.
2. `sid` still exists as a lower-level runtime/session identity during migration.
3. When `projectId` is present, AI Studio resolves the owned project record before restore continues.
4. Current shipped behavior is coexistence, not full cutover.
5. Legacy `sid` remains the runtime identity for plain `/ai-studio` routes without `projectId`.

## AI Studio title authority
1. When AI Studio is opened with `?projectId=<uuid>`, the visible Media Library project title is read from the resolved project record.
2. Media Library title commits in that state call `PATCH /api/projects/:projectId` and do not mutate session-only title state.
3. Session-title fallback remains compatibility-only for plain `/ai-studio` routes that do not carry `projectId`.
4. Invalid or cross-user project ids fail closed and block AI Studio restore.

## AI Studio workspace authority
1. When AI Studio is opened with `?projectId=<uuid>`, project routes read/write workspace snapshots through `GET|PUT /api/projects/:projectId/workspace`.
2. The current workspace storage contract reuses the AI Studio session snapshot envelope (`workspace`, `outputs`, `agent`, optional `canvas`, optional `expertEdit`) as a temporary migration schema boundary.
3. Project routes do not use the legacy remote `sid` session snapshot API as their primary durable authority.
4. Project routes suppress browser-global workflow-settings session storage, chat-mode local storage, and selected-character local storage so those values restore through the project workspace snapshot instead.
5. This does not yet make generated-output hydration, Media Library folder authority, or asset association fully project-scoped.

## Project asset association
1. Global `media_files` and `media_prompts` remain the canonical user-owned inventory.
2. Project routes now attach saved media to `project_media_items` and saved prompts to `project_prompt_items`.
3. Manual save, autosave, and prompt-save flows on project routes use those association tables as the current durable project-ownership seam.
4. Re-saving an already-saved output on a project route should attach the existing media/prompt ids to that project without forcing a duplicate upload or duplicate prompt row.
5. This association layer is additive; it does not change the visibility of `All Media` or other user-global library surfaces yet.

## Explicit non-goals for the current shipped foundation
1. No project-scoped Media Library folder authority yet.
2. No project-owned generated-output authority cutover yet.
3. No project-scoped library filtering/cutover for `All Media` yet.
4. No `sid` retirement yet.

## Source-of-truth guidance
1. Use this SOP for the shipped Projects foundation contract.
2. Use ADR 0062 for the durable identity decision, ADR 0063 for project workspace authority, and ADR 0064 for project asset association.
3. Use the `docs/planning/ai-studio-project-persistence-*.md` files only for future migration phases, not as the source of truth for already shipped behavior.

## Validation
- `npm -C frontend run test -- tests/api/projects-create.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioProjectIdentity.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioSessionIdentity.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioPageSessionPersistence.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioPersistenceActions.identity.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreHydration.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/mediaLibraryPersistence.test.ts`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/sessionSnapshot.test.ts`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts`
- `npm -C frontend run type-check`
- `npm -C frontend run docs:check`

## Follow-up lanes
1. Cut generated-output authority over to project-owned seams.
2. Replace the visible user-global Media Library folder authority with project-scoped folders in a later migration phase.
3. Decide whether project workspace writes should also batch-associate restore-relevant saved media/prompt ids as a belt-and-suspenders backstop.
