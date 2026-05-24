# D-Bug Handoff: dashboard-new-project-project-unavailable

### Source

- Source agent: Bopper
- Source task: local dashboard first-click project creation dead-end audit
- Date: 2026-05-15

### Failing surface

- Route, component, script, command, or subsystem: signed-in dashboard -> `New Project` -> AI Studio project bootstrap
- Environment: local
- User-visible symptom: creating a new project from the dashboard routes into AI Studio and immediately fails with `Project unavailable` / `Project not found.`
- Exact error text or signature:
  - UI: `Project unavailable`
  - UI detail: `Project not found.`
  - Runtime: `POST /api/projects/create 200` followed by repeated `GET /api/projects/db95508d-82f2-4827-a60d-32f9f0c48716 404`

### Why this is a D-Bug lane

- Why the source agent stopped: Bopper proved a high-value user-facing trust break but did not have enough surface evidence to claim a safe fix path.
- Why this should be treated as debugging instead of feature work: the first-click workflow is already intended to work; the failure is contradictory runtime behavior inside the existing project create/open path.

### Current evidence

- Reproduction steps:
  1. Open the signed-in dashboard at `http://localhost:3000/`.
  2. Click `New Project`.
  3. Leave the default `Untitled project` title.
  4. Click `Create`.
  5. Wait for the route to change into AI Studio.
- Expected behavior:
  - route lands in a usable AI Studio workspace for the new project
- Actual behavior:
  - route lands on a full-page error state
  - header says `Project unavailable`
  - message says `Project not found.`
  - `Open projects` then lists the newly created `Untitled project`, so the app simultaneously claims the project is missing and present
- Logs, stack traces, screenshots, or file references:
  - Bopper retained report: `docs/records/artifacts/agent/bopper/reports/2026-05-15-local-dashboard-new-project-dead-end.md`
  - Bopper full workflow report: `docs/agents/bopper/workspace/reports/2026-05-15-local-dashboard-new-project-dead-end.md`
  - Bopper run packet: `docs/agents/bopper/workspace/runs/2026-05-15-181132-dashboard-new-project-dead-end/notes.md`
  - Runtime signals:
    - `POST /api/projects/create 200 in 2.6s`
    - repeated `GET /api/projects/db95508d-82f2-4827-a60d-32f9f0c48716 404`
    - `GET /api/projects?limit=all 200`
- Frequency: reproduced on the first supervised run of the dashboard create path

### Scope control

- Owned write surface: dashboard project create/open lane and the minimal tests that protect it
- Avoid surface: broader AI Studio redesign, auth flows, media library behavior, billing/status cards
- In scope:
  - explain why create succeeds but the immediate project bootstrap read fails
  - identify the smallest credible fix
  - add or tighten the smallest useful test so create -> open does not regress silently
- Out of scope:
  - redesigning the dashboard CTA copy
  - reworking the full AI Studio bootstrap UX
  - branch/push/commit execution

### Attempts already made

1. Verified the local app through the natural signed-in dashboard entry path.
2. Followed the obvious `New Project` CTA and default project-name flow.
3. Observed the full-page AI Studio failure state.
4. Confirmed the just-created project still exists in the recovery modal.
5. Narrowed probable ownership to dashboard project routing, project identity bootstrap, and single-project API reads.

### Current hypotheses

1. The single-project read route (`/api/projects/:id`) is failing an ownership/read boundary that the list route (`/api/projects?limit=all`) is not.
2. The dashboard create path may be pushing a valid `projectId`, but the immediate AI Studio bootstrap read is using a stale or mismatched project identity boundary.
3. Current dashboard tests only assert the route push after create, not that the newly created project can actually be read/opened by the AI Studio bootstrap path.

### Required context

Read first:

- `docs/records/artifacts/agent/bopper/reports/2026-05-15-local-dashboard-new-project-dead-end.md`
- `docs/agents/bopper/workspace/reports/2026-05-15-local-dashboard-new-project-dead-end.md`

Inspect first:

- `frontend/pages/dashboard.tsx`
- `frontend/features/projects/hooks/useProjectCreationDialog.ts`
- `frontend/features/projects/logic/projectCreateClient.ts`
- `frontend/features/ai-studio/hooks/useAiStudioProjectIdentity.ts`
- `frontend/features/ai-studio/hooks/useAiStudioProjectRouteRecovery.ts`
- `frontend/lib/server/projectApiRoutes/item.ts`
- `frontend/lib/server/projectsService.ts`
- `frontend/tests/pages/dashboard.actions.test.tsx`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioProjectIdentity.test.ts`

### Questions for D-Bug

1. Why does the create route succeed while the immediate project bootstrap read returns `404`?
2. Are the list route and single-project route reading the same ownership contract in local dev?
3. What is the smallest test that proves create -> readable project -> studio bootstrap, not just create -> router push?

### Expected output

- debug plan, or
- bounded patch with validation, or
- blocked-with-evidence escalation

### Recommended downstream owner after D-Bug

- Stay with D-Bug, or
- Gear Ball for commit/push/branch-hygiene execution if D-Bug produces the patch

### Suggested validation

- Create a project from the dashboard and confirm AI Studio opens without the `Project unavailable` gate.
- Confirm the new project is readable through the single-project API path immediately after create.
- Run the smallest dashboard/project bootstrap tests that cover the fixed path.

### Suggested stop condition

- Stop when D-Bug can explain the create/read contradiction and identify the smallest fix or protective test.

### Done state

- D-Bug can explain why the first-click dashboard project-create path dead-ends and can point to the smallest fix or test addition.
