# Bopper Checkpoint Summary - 2026-05-15

## Bottom Line
I clicked the obvious signed-in `New Project` path, and the app made it look like my new project existed and did not exist at the same time.

## What I Tried
I entered the signed-in dashboard, clicked `New Project`, left the default title alone, and clicked `Create`. I ran this in the local environment.

## What Worked
The project creation request itself returned `200`.
The new project still showed up in `Open projects`, so it looked like something had been created.

## What Broke
Natural entry into AI Studio landed on `Project unavailable` / `Project not found.` instead of a usable studio.
That first full-page AI Studio error gate was the believable abandonment point for me.

## My Take
I would stop here because this feels like the app is contradicting itself right after asking me to start working.
This is the kind of failure that makes me question whether I can trust the app with real work.
> "If you tell me my project is there and then tell me it isn't, I don't know why I would keep going."

Handoff: `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-dashboard-new-project-project-unavailable.md`
Read next: `bopper/reports/2026-05-15-local-dashboard-new-project-dead-end.md` and `docs/records/artifacts/agent/bopper/reports/2026-05-15-local-dashboard-new-project-dead-end.md`
