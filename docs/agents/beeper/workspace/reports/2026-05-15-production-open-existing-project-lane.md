# Production Open Existing Project Lane

## What I Tried

- opened the signed-in dashboard
- clicked `Open Projects`
- selected the saved Beeper production project from the overlay
- landed in AI Studio
- reopened the in-studio projects overlay
- reloaded the AI Studio route

## What Worked

- the dashboard projects overlay opened cleanly
- the saved project button was visible and actionable
- clicking the saved project opened AI Studio with a stable `projectId`
- reopening the in-studio projects overlay worked
- reloading preserved the same `projectId`

## What Did Not Work

- no new failure in this lane

## Real User Read

- this is a real confidence-building path now
- the dashboard project library is not just a shell overlay; it actually restores a saved workspace and lands where the user expects
- reload persistence makes the reopen path feel trustworthy

## UX Notes

- the saved project title is long and synthetic because it comes from Beeper’s own test naming, but the control affordance is still understandable
- the reopen path is clearer than the dashboard’s `Open the AI Studio` semantics lane because the destination and result line up

## Code Follow-Up

- likely route and modal ownership:
  - `frontend/pages/dashboard.tsx:621`
  - `frontend/features/ai-studio/components/ProjectsModal.tsx:407`
- useful detail:
  - the dashboard and AI Studio share the same `ProjectsModal` surface
  - existing project reopen is button-driven and uses project selection state rather than hidden route magic

## Evidence

- packet:
  - `docs/agents/beeper/workspace/runs/2026-05-15-150037-prod-open-existing-project-lane/evidence/open-existing-project-summary.json`
- screenshots:
  - `open-existing-01-dashboard.png`
  - `open-existing-02-projects-overlay.png`
  - `open-existing-03-ai-studio-landing.png`
  - `open-existing-04-in-studio-projects.png`
  - `open-existing-05-after-reload.png`

## Result

- dashboard -> existing project reopen is now validated
- no D-Bug handoff is needed from this checkpoint
- next high-value lane is deeper non-generate AI Studio work inside the reopened project
