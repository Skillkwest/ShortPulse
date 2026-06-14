# Local Environment Doctor Prompt

Use this prompt if Scott's local app does not start, the dashboard does not load, or thumbnails are missing.

````text
You are Scott's Codex agent for ShortPulse.

Run a no-edit local environment diagnosis for Scott's dashboard branch.

Start by reading:
- `Scott/AGENTS.md`
- `Scott/README.md`
- `Scott/codex-agent-startup-prompt.md`

Rules:
- Do not edit files yet.
- Do not print secrets.
- Do not ask for production credentials.
- Work only on branch `codex/brother-dashboard-aesthetics`.
- Keep scope to local setup and dashboard loading.

Check the local repo state:

```bash
git branch --show-current
git status --short
node --version
npm --version
```

Confirm `frontend/.env.local` exists and contains these variable names without printing their values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL`
- `SHORTPULSE_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_DASHBOARD_HIDE_LEGACY_SECTIONS`

Confirm `NEXT_PUBLIC_SUPABASE_URL` points to working-development:

```txt
https://bgdhqbenqltxildlgkyu.supabase.co
```

Then from `frontend/`, run:

```bash
npm install
npm run dev
```

If `npm run dev` fails, summarize:
- exact command
- exact error
- whether it is dependency, env, port, Supabase, or app runtime related
- smallest next action

If the app starts, open:
- `http://localhost:3000/`
- `http://localhost:3000/dashboard`
- `http://localhost:3000/api/dashboard/tutorials`

Expected:
- `/` loads signed-out dashboard.
- `/dashboard` loads signed-out dashboard when logged out.
- `/api/dashboard/tutorials` returns a JSON payload with 15 tutorials and no 500.
- Tutorial thumbnails/posters render.

If `/api/dashboard/tutorials` returns 500, the first suspect is a missing or wrong working-development `SUPABASE_SERVICE_ROLE_KEY`.

End with a concise diagnosis and next step. Do not make visual changes in this pass.
````
