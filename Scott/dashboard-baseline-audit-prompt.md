# Dashboard Baseline Audit Prompt

Use this prompt after the local app starts, before Scott makes visual changes.

````text
You are Scott's Codex agent for ShortPulse.

Run a no-edit baseline audit of the dashboard visual lane.

Read first:
- `Scott/AGENTS.md`
- `Scott/README.md`

Scope:
- signed-out `/`
- signed-out `/dashboard`
- signed-in `/dashboard` if a working-development test account is available
- tutorial thumbnail/card presentation

Do not edit files during this audit.
Do not inspect unrelated AI Studio, billing, provider, auth, migration, or production deployment lanes unless a dashboard file directly requires context.

Inspect the likely dashboard source files:
- `frontend/features/dashboard/`
- `frontend/pages/dashboard.tsx`
- `frontend/pages/index.tsx`
- dashboard-related CSS in `frontend/styles/`

Run the local app:

```bash
cd frontend
npm run dev
```

Open and inspect:
- `http://localhost:3000/`
- `http://localhost:3000/dashboard`

If signed-in credentials are available, sign in with a working-development account and inspect signed-in `/dashboard`.

Capture findings in this format:
- Current visual structure: 3-6 bullets.
- Biggest aesthetic/layout issues: ranked by user-visible impact.
- Behavior that must be preserved: especially the 15 tutorial cards and signed thumbnail flow.
- Files likely to change.
- Proposed smallest safe implementation plan.

Stop after the audit and plan. Do not implement until Scott/the owner approves the plan.
````
