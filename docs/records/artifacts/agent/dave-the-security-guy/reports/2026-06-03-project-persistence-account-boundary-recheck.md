# Project Persistence Account Boundary Recheck

Date: 2026-06-03
Agent: Dave the Security Guy
Mode: launch-readiness security recheck, no product/UI/UX changes
Repo branch: local `production`

## Scope

This lane rechecked Project Persistence for cross-user leakage risk after the user flagged concern about regressions. The focus was account isolation only: project rows, project workspace snapshots, project output display rows, project media/prompt/generation associations, project preview signing, and saved snapshot references.

## Ranked Finding Shortlist

| Finding | Severity | Confidence | Trust boundary | Launch impact | ROI |
| --- | --- | --- | --- | --- | --- |
| No confirmed cross-user Project Persistence leak in audited current code | Informational | High | Authenticated project/workspace rows and referenced media/generation state | Reduces launch uncertainty on a user-flagged persistence surface | High as audit evidence, no code edit |

## Evidence

Route authority:

- `frontend/pages/api/projects/index.ts` uses `requireApiUser`, then calls `listProjectsForUser({ userId: user.id })`.
- `frontend/pages/api/projects/create.ts` uses `requireApiUser`, then calls `createProjectForUser({ userId: user.id })`.
- `frontend/lib/server/projectApiRoutes/item.ts` uses `requireApiUser`, parses a UUID project id, and calls `getProjectForUser`, `updateProjectTitleForUser`, or `deleteProjectForUser` with `user.id`.
- `frontend/lib/server/projectApiRoutes/workspace.ts` verifies `getProjectForUser({ userId: user.id, projectId })` before workspace read/save/delete.
- `frontend/pages/api/projects/[...projectPath].ts` dispatches project item/workspace routes and returns stable sanitized 500 details.

Service authority:

- `frontend/lib/server/projectsService.ts` scopes create/read/list/update/delete to `user_id`, including preview workspace/display row reads.
- Project card preview signing only signs storage paths that pass `isUserScopedMediaStoragePath(path, userId)` and filters trusted direct preview URLs with `requireUserScope: true`.
- `frontend/lib/server/projectWorkspaceStatesService.ts` reads, deletes, and saves workspace rows by both `project_id` and `user_id`.
- Workspace snapshot write sanitization removes foreign storage paths, drops invalid UUID-shaped references, resolves media/prompt/generation authority through user-scoped queries, and removes unowned IDs before persistence.
- Read-time sanitization re-materializes display items by `(projectId, userId)` and re-sanitizes ownership before returning the snapshot. If ownership resolution fails, it degrades/fails closed to an ownership-safe snapshot rather than returning unchecked foreign references.
- `frontend/lib/server/projectOutputDisplayItemsService.ts` loads display rows by `(projectId, userId)`, stamps `user_id` from the caller on upserts, and deletes stale rows by `(projectId, userId, output_id)`.

SQL backstops:

- `sql/migrations/089_add_projects_foundation.sql` uses RLS isolation policies for `projects`.
- `sql/migrations/091_add_project_workspace_states.sql` defines `project_id` as primary key and adds a composite `(project_id, user_id)` foreign key to `projects(id, user_id)`, plus user-scoped RLS policies.
- `sql/migrations/093_add_project_generation_associations.sql` uses composite project/generation scope constraints and user-scoped RLS.
- `sql/migrations/145_add_project_output_display_items.sql` links display rows to `(project_id, user_id)` workspace scope, enables user-scoped RLS, and grants table access to `service_role` for server-owned persistence.

## Highest-ROI Decision Before Edits

No code edit was selected.

Why: the highest-risk attacker path would be a signed-in user saving or reading another user's project workspace, preview media, output display rows, or generation references. Current code requires authenticated identity, proves project ownership before workspace operations, filters user-scoped storage paths/direct preview URLs, and resolves referenced rows through `user_id` before persistence or readback. A patch would likely duplicate existing controls or shift behavior without closing a proven security boundary.

## Validation

Targeted Project Persistence security regression run:

```bash
npm -C frontend test -- --run tests/api/projects-create.test.ts lib/server/__tests__/projectWorkspaceStatesService.test.ts lib/server/__tests__/projectsService.test.ts
```

Result: 3 test files passed, 79 tests passed.

Continuation revalidation on 2026-06-04:

```bash
npm -C frontend test -- --run lib/server/__tests__/projectWorkspaceStatesService.test.ts lib/server/__tests__/projectsService.test.ts lib/server/__tests__/projectGenerationAssociationsService.test.ts tests/api/projects-create.test.ts
```

Result: 4 test files passed, 104 tests passed.

Additional validation:

```bash
node scripts/check_secret_exposure.js
```

Result: secret exposure checks passed.

## 2026-06-04 Continuation Decision

No code edit was selected after the continuation recheck.

Why: the current primary project routes still require `requireApiUser`, validate project ids, and prove project ownership through `getProjectForUser({ userId, projectId })` before item or workspace read/write/delete. The current workspace service still filters storage paths to the caller's user scope, resolves media/prompt/generation references through caller-owned rows, re-sanitizes on read, and falls back to ownership-safe snapshots when read-time authority resolution degrades. Project association helpers also re-check project ownership and asset/generation ownership before writing service-role association rows. SQL backstops still include project/user composite constraints, user-scoped RLS, and service-role-only display-row access.

Stop rationale: continuing into code would require inventing a new threat statement or touching nearby Project Persistence behavior by momentum. That would be lower launch-readiness ROI than stopping with the current no-fix audit evidence.

## Residual Launch Risk

- This was a local repo audit and test run only; no hosted Supabase or production data was mutated.
- This lane did not investigate UI/UX Project Persistence bugs unless they created a real account-isolation threat.
- The current evidence does not support blaming Dave security work for a confirmed Project Persistence security regression.

## Next Highest-ROI Step

Continue with media-library folder membership and signed-storage delivery if fresh evidence suggests a user can cause another user's media rows or private storage paths to appear in their account.
