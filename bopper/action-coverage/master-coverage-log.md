# Bopper Master Coverage Log

Purpose: track which obvious-entry routes and first-click workflows Bopper has already exercised.

## Status Key

- `not-started`
- `seen`
- `clicked`
- `confused`
- `abandoned`
- `validated`

## Coverage Matrix

| Surface / Workflow | Current status | What was tried already | What still needs testing | Best artifact |
| --- | --- | --- | --- | --- |
| Dashboard first click | `validated` | Retested the signed-in dashboard at `/dashboard`, clicked `New Project`, accepted the default title, and landed in usable AI Studio. | Compare trust against reopening an existing project from the same surface. | `docs/records/artifacts/agent/bopper/reports/2026-05-15-local-dashboard-new-project-fix-retest.md` |
| Public dashboard first click | `confused` | Entered the public dashboard at `/`, clicked `New Project`, and got routed to pricing instead of directly toward creation or a workspace. | Validate whether wording or route intent should change, then complete the auth -> dashboard leg with a paid test identity. | `docs/records/artifacts/agent/bopper/reports/2026-05-15-local-dashboard-new-project-retest.md` |
| Project entry wording | `validated` | Retested the core signed-in `New Project` wording and the adjacent project-library create wording; both now lead where the user expects. | Recheck if the public `New Project` wording remains sales-tilted for returning paid users. | `bopper/reports/2026-05-15-local-dashboard-new-project-fix-retest.md` |
| AI Studio first impression | `validated` | Reached `/ai-studio?projectId=...` naturally through both signed-in create variants and landed in a usable studio with clear next actions. | Broaden into a first prompt/file action on a future lane. | `docs/records/artifacts/agent/bopper/reports/2026-05-15-local-dashboard-new-project-fix-retest.md` |
| Auth visible entry | `seen` | Reached `/auth?next=%2Fdashboard` through the public `New Project` -> `Log in` path, but could not complete sign-in because no saved paid identity was available in this browser session. | Complete the same route with a real paid test identity and verify the post-auth destination. | `docs/records/artifacts/agent/bopper/reports/2026-05-15-local-dashboard-new-project-retest.md` |
| Project library first entry | `seen` | Entered `Open Projects` during the signed-in dashboard retest and used its visible `New Project` fallback to create a project successfully. | Run it as a deliberate first-choice lane and compare trust vs reopening an existing project. | `docs/records/artifacts/agent/bopper/reports/2026-05-15-local-dashboard-new-project-fix-retest.md` |
| Media Library first browse | `not-started` | None yet. | Search and empty-state trust. | Pending first run |
| Character first entry | `not-started` | None yet. | First obvious action. | Pending first run |
| Profile/settings basic change | `not-started` | None yet. | One safe setting path. | Pending first run |
