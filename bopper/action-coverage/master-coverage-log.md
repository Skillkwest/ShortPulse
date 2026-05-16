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
| Dashboard first click | `abandoned` | Entered the signed-in dashboard at `/`, clicked `New Project`, accepted the default title, and hit a dead-end project bootstrap error instead of a usable studio. | Retest after the create/open path is fixed. | `docs/records/artifacts/agent/bopper/reports/2026-05-15-local-dashboard-new-project-dead-end.md` |
| Project entry wording | `confused` | Trusted `New Project` plus `Open the AI Studio` as a straight-through promise, then hit a contradictory `Project unavailable` state even though the project existed. | Retest the wording and recovery flow after the route bug is fixed. | `bopper/reports/2026-05-15-local-dashboard-new-project-dead-end.md` |
| AI Studio first impression | `abandoned` | Reached `/ai-studio?projectId=...` through the natural project-create path, but the first impression was a full-page restore/error gate rather than the studio. | Test a healthy natural AI Studio entry after the route bootstrap issue is resolved. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-dashboard-new-project-project-unavailable.md` |
| Media Library first browse | `not-started` | None yet. | Search and empty-state trust. | Pending first run |
| Character first entry | `not-started` | None yet. | First obvious action. | Pending first run |
| Profile/settings basic change | `not-started` | None yet. | One safe setting path. | Pending first run |
