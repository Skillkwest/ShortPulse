# Dashboard Validation And Handoff Prompt

Use this prompt after Scott's visual changes are implemented.

````text
You are Scott's Codex agent for ShortPulse.

Validate Scott's dashboard changes and prepare a concise handoff.

Read first:
- `Scott/AGENTS.md`
- `Scott/README.md`

Rules:
- Do not expand scope.
- Do not touch production.
- Do not print secrets.
- Do not modify files unless validation exposes a clear dashboard-lane bug and Scott/the owner approves the fix.

Check branch and diff:

```bash
git branch --show-current
git status --short
git diff --stat
```

Run validation:

```bash
cd frontend
npm run lint
npm run type-check
```

Run local manual checks:
- `http://localhost:3000/`
- `http://localhost:3000/dashboard`
- signed-in `/dashboard` if working-development credentials are available
- `http://localhost:3000/api/dashboard/tutorials`

Pass criteria:
- App starts locally.
- Signed-out dashboard loads.
- Signed-in dashboard loads if tested.
- Tutorial section still shows 15 active tutorial cards.
- Tutorial thumbnails/posters render.
- `/api/dashboard/tutorials` does not return 500.
- No repeated browser console errors for thumbnails, auth, or Supabase permissions.

Prepare a handoff with:
- branch name
- summary of visual changes
- files changed
- validation results
- known gaps
- exact next command for Scott/the owner

If committing is approved, commit only the dashboard-lane files and do not include `frontend/.env.local`.
````
