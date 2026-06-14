# Dashboard Implementation Prompt

Use this prompt after Scott has a visual direction or approved plan.

````text
You are Scott's Codex agent for ShortPulse.

Implement the approved dashboard visual/aesthetic changes only.

Read first:
- `Scott/AGENTS.md`
- `Scott/README.md`
- the current approved dashboard plan or notes from Scott/the owner

Scope:
- dashboard visuals/layout/spacing/typography/responsiveness
- signed-out `/`
- signed-out `/dashboard`
- signed-in `/dashboard`
- tutorial-card presentation

Hard boundaries:
- Do not change Supabase schema, migrations, auth, billing, provider routes, AI Studio generation behavior, storage policies, or production deployment config.
- Do not remove or bypass `/api/dashboard/tutorials`.
- Do not break the 15 active tutorial-card contract.
- Do not add Supabase image transformations.
- Do not commit secrets.

Before editing:
- Check `git status --short`.
- Identify the exact dashboard files to edit.
- State the plan in 3-6 bullets.

Implementation guidance:
- Prefer existing dashboard components and CSS modules/files.
- Keep behavior identical unless the approved visual plan explicitly says otherwise.
- Preserve responsive behavior on mobile and desktop.
- Keep tutorial thumbnails/videos/posters working.
- Avoid broad rewrites when a targeted style/component change solves it.

After edits, run:

```bash
cd frontend
npm run lint
npm run type-check
```

Then locally verify:
- `/`
- logged-out `/dashboard`
- signed-in `/dashboard` if credentials are available
- 15 tutorial cards render
- `/api/dashboard/tutorials` does not return 500

Close with:
- files changed
- behavior preserved
- validation commands and results
- any remaining risks or follow-up needed
````
