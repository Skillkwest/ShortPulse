# Bopper Report - 2026-05-15 - dashboard-new-project-dead-end

Purpose: Dashboard first-click project creation dead-end audit.

## Task

- Requested work: Dashboard first-click project creation dead-end audit
- Environment: local
- Base URL: http://localhost:3000
- Interaction fidelity: `mixed` because Chrome already had an authenticated dev dashboard open, but the click path itself stayed naive-user realistic

## Naive-User Path

- Entry route: signed-in dashboard at `/`
- First click: `New Project`
- Next obvious action: keep the default `Untitled project` title and click `Create`
- What Bopper expected: the app would open AI Studio with a fresh project and an obvious first creation surface
- What Bopper ignored: `Open Projects`, top status cards, and the profile menu

## Findings

### Blockers

- Dashboard first-click entry into AI Studio is broken.
  - Repro: load the signed-in dashboard, click `New Project`, leave the default title, click `Create`.
  - Actual result: after a short loading state, the route changes to `/ai-studio?projectId=...&sid=...` and renders `Project unavailable` / `Project not found.` instead of the studio.
  - Why it matters: this is the most obvious task-entry CTA on the signed-in dashboard, so an average user can hit a dead end on the first real click.

### Functional Issues

- Contradictory recovery state.
  - `Open projects` from the error state still lists the just-created `Untitled project`.
  - That makes the error screen feel untrustworthy because the app claims the project is missing while also proving it exists.

### UI / UX Notes

- The `Creating...` modal state gives no progress detail, so the user has no way to distinguish expected wait time from failure.
- The AI Studio error gate uses restore-step language (`Verify session`, `Resolve project`, `Load workspace`) that sounds like an internal recovery screen rather than a first-time creative workspace entry.

## Evidence

- Screenshots:
- Runtime signals:
  - `POST /api/projects/create 200`
  - repeated `GET /api/projects/db95508d-82f2-4827-a60d-32f9f0c48716 404`
  - `GET /api/projects?limit=all 200`
- Code/doc surfaces:
  - `frontend/pages/dashboard.tsx`
  - `frontend/features/projects/hooks/useProjectCreationDialog.ts`
  - `frontend/features/projects/logic/projectCreateClient.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioProjectIdentity.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioProjectRouteRecovery.ts`
  - `frontend/lib/server/projectApiRoutes/item.ts`
  - `frontend/lib/server/projectsService.ts`
  - `frontend/tests/pages/dashboard.actions.test.tsx`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioProjectIdentity.test.ts`
