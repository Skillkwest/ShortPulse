# SOP: AI Studio Projects Foundation

Purpose: define the currently shipped Projects foundation contract so dashboard handoff, API behavior, and AI Studio route identity are documented in one authoritative operational reference instead of being spread across planning docs.

## Scope
- In scope: `projects` table foundation, authenticated project create/list/read/update-title routes, dashboard `New Project` handoff, dashboard saved-project cards, project-aware AI Studio entry, AI Studio project-title edits backed by `projects.title`, and current `projectId` + `sid` coexistence behavior.
- Out of scope: project workspace restore, project-scoped Media Library folders, and legacy session cleanup.

## Current shipped contract
1. The dashboard `New Project` action creates a real user-owned `projects` row before routing into AI Studio.
2. Project creation is server-authoritative through authenticated API routes; the dashboard does not insert directly into Supabase.
3. AI Studio currently accepts `?projectId=<uuid>` as the top-level project handoff boundary while legacy `sid` session identity still coexists during migration.
4. When `projectId` is present, AI Studio resolves the owned project record before session restore continues.
5. The visible Media Library project title now reads from and writes to `projects.title`.
6. Full project workspace restore is not shipped yet.

## Primary repo surfaces
| Surface | Role |
| --- | --- |
| `sql/migrations/089_add_projects_foundation.sql` | Creates the foundational `projects` table and ownership policies. |
| `frontend/lib/server/projectsService.ts` | Canonical server helper for project create/list/read/update access and input normalization. |
| `frontend/pages/api/projects/index.ts` | Authenticated collection route used by the dashboard saved-project surface. |
| `frontend/pages/api/projects/create.ts` | Authenticated create route used by the dashboard handoff. |
| `frontend/pages/api/projects/[projectId].ts` | Authenticated single-project item route for ownership checks and title updates. |
| `frontend/pages/dashboard.tsx` | `New Project` UI entry plus recent-project cards that route into AI Studio with `projectId`. |
| `frontend/pages/ai-studio.tsx` | Current AI Studio page entry where `projectId` coexists with legacy `sid`, gates restore on project resolution, and routes visible title edits through project authority. |
| `frontend/features/ai-studio/hooks/useAiStudioProjectIdentity.ts` | Canonical client hook for `projectId` query resolution, owned-project fetch, and AI Studio title updates. |
| `docs/adr/0062-project-identity-foundation.md` | Durable architectural decision establishing `projectId` as the new top-level identity. |

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

## Dashboard handoff workflow
1. `/dashboard` loads recent caller-owned projects through `GET /api/projects?limit=3`.
2. User clicks `New Project` or an existing project card on `/dashboard`.
3. `New Project` calls `POST /api/projects/create`.
4. On success, the dashboard routes to `/ai-studio?projectId=<uuid>`.
5. On create failure, the dashboard keeps the user on `/dashboard` and surfaces a create-project error message.

## AI Studio identity boundary
1. `projectId` is now the top-level durable handoff identity for the Projects migration.
2. `sid` still exists as a lower-level runtime/session identity during migration.
3. When `projectId` is present, AI Studio resolves the owned project record before session restore continues.
4. Current shipped behavior is coexistence, not full cutover.
5. Do not document current AI Studio restore behavior as project-authoritative yet.

## AI Studio title authority
1. When AI Studio is opened with `?projectId=<uuid>`, the visible Media Library project title is read from the resolved project record.
2. Media Library title commits in that state call `PATCH /api/projects/:projectId` and do not mutate session-only title state.
3. Session-title fallback remains compatibility-only for plain `/ai-studio` routes that do not carry `projectId`.
4. Invalid or cross-user project ids fail closed and block AI Studio restore.

## Explicit non-goals for the current shipped foundation
1. No project workspace restore yet from the dashboard open surface.
2. No project workspace snapshot restore yet.
3. No project-scoped Media Library folder authority yet.
4. No `sid` retirement yet.

## Source-of-truth guidance
1. Use this SOP for the shipped Projects foundation contract.
2. Use ADR 0062 for the durable identity decision.
3. Use the `docs/planning/ai-studio-project-persistence-*.md` files only for future migration phases, not as the source of truth for already shipped behavior.

## Validation
- `npm -C frontend run test -- tests/api/projects-create.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioProjectIdentity.test.ts`
- `npm -C frontend run test -- features/ai-studio/hooks/__tests__/useAiStudioSessionIdentity.test.ts`
- `npm -C frontend run docs:check`

## Follow-up lanes
1. Introduce project-owned workspace restore after the runtime entry contract is ready.
2. Replace the visible user-global Media Library folder authority with project-scoped folders in a later migration phase.
