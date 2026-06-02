# Project Workspace Account Isolation Audit

Owner: Dave the Security Guy
Date: 2026-06-02
Scope: launch-readiness security audit focused on project rows, project workspace snapshots, project preview signing, and project API error disclosure.

## Decision

One local security issue was confirmed and fixed: authenticated project routes returned raw internal exception text in `details` on some `500` responses. The project/workspace ownership boundary itself is currently well guarded, but raw internals on account-owned project routes are still a sensitive-route error disclosure risk and were worth fixing locally while hosted Supabase RPC remediation remains approval-gated.

## Finding Fixed

- Severity: Medium.
- Confidence: High.
- Affected trust boundary: authenticated project API route error boundary.
- Launch impact: account-owned project/workspace routes could expose internal database/service failure text to authenticated callers during backend failures.
- ROI: High enough for a minimal route-layer fix because it closes a real sensitive-route leakage without changing project persistence behavior, UI/UX, or ownership logic.
- Root cause: `frontend/lib/server/projectApiRoutes/item.ts`, `frontend/lib/server/projectApiRoutes/workspace.ts`, and `frontend/pages/api/projects/index.ts` returned `error.message` or messages derived from `error.message` in client-visible `details`.

## Change Made

- Project list and project item `500` responses now return only stable error strings.
- Project workspace `500` responses keep stable route/failure-stage details but no longer include raw exception messages.
- Server-side `logApiRouteException` still receives the original error for diagnostics.
- Added focused regressions proving internal project list/item failures are logged but not returned to callers, and updated workspace failure expectations to stable sanitized details.

## Ownership Controls Verified

- Project item/list services query with the authenticated `userId`.
- Workspace route calls `requireApiUser`, parses `projectId`, and verifies `getProjectForUser({ userId, projectId })` before workspace read/save/delete.
- Workspace state reads/deletes filter by both `project_id` and `user_id`.
- Workspace state writes persist `user_id` from the verified user and rely on the database `(project_id, user_id)` relationship as a second backstop.
- Workspace snapshot write/read sanitization resolves referenced media, prompt, and generation IDs through `user_id` before preserving them.
- Snapshot storage paths are dropped unless they are shape-safe and under the caller namespace.
- Project preview signing only signs user-scoped storage paths and filters trusted fallback preview URLs by caller scope.
- SQL migrations for `projects`, `project_workspace_states`, `project_media_items`, `project_prompt_items`, and `project_generation_items` use RLS plus user-scoped/composite ownership relationships.

## Validation

Command:

```bash
npm run test -- --run tests/api/projects-create.test.ts lib/server/__tests__/projectWorkspaceStatesService.test.ts lib/server/__tests__/projectsService.test.ts
```

Result: 3 files passed, 68 tests passed.

## Residual Risk

- The previously confirmed hosted Supabase RPC grant drift for storage entitlement helpers remains the highest launch security blocker until Production applies migration `141` or equivalent corrective grant SQL and reruns `sql/check_runtime_sql_security_audit.sql` with `failing_checks = 0`.
- This slice did not mutate hosted Supabase, Vercel, GitHub secrets, provider state, billing state, or production data.
- I did not broaden into generic API error cleanup. Further raw-error work should be prioritized only for sensitive auth, billing, provider, webhook, admin, storage, project, or service-role routes with a concrete leakage path.
