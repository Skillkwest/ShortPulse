# Scott Dashboard Branch Setup

Purpose: help Scott and Scott's Codex agent get the ShortPulse dashboard branch running locally without touching production.

This folder is the handoff package for the dashboard visual/aesthetic lane. Follow it before making changes.

For copy/paste prompts Scott can give directly to his Codex agent, use:

- `Scott/codex-agent-startup-prompt.md`: first-time clone/fetch/checkout and local startup.
- `Scott/local-environment-doctor-prompt.md`: diagnose local setup, env, or thumbnail loading issues without edits.
- `Scott/dashboard-baseline-audit-prompt.md`: no-edit dashboard visual audit before changing UI.
- `Scott/dashboard-implementation-prompt.md`: scoped dashboard visual implementation prompt after a plan is approved.
- `Scott/dashboard-validation-and-handoff-prompt.md`: final validation and handoff prompt after changes.
- `Scott/worktree-test-commit-push-sop.md`: standard operating procedure for testing, committing, and pushing worktree changes on the dashboard branch.

## Lane Boundary

- Branch: `codex/brother-dashboard-aesthetics`
- Scope: dashboard visuals, layout, spacing, typography, responsive behavior, and tutorial-thumbnail presentation.
- Signed-out dashboard surfaces: `/` and signed-out `/dashboard`.
- Signed-in dashboard surface: signed-in `/dashboard`.
- Do not change Supabase schema, migrations, auth, billing, AI Studio generation behavior, provider routes, storage policies, or production deployment config.
- Do not use production Supabase credentials locally.
- Do not commit `frontend/.env.local` or any secret file.

## What Is Already Prepared

- `origin/working-development` and `origin/codex/brother-dashboard-aesthetics` were created from current production commit `8d13f1738`.
- The working-development Supabase project is schema-aligned with production for the dashboard lane.
- Working-development has the admin-managed dashboard content Scott needs:
  - `1` active dashboard offer.
  - `15` active dashboard tutorial rows.
  - `15` active original thumbnail paths.
  - `15` active display thumbnail/video paths.
  - `15` active poster paths.
  - `0` missing active thumbnail references.
- The bucket has `45` objects because each active tutorial has source + display derivative + poster. That still represents `15` active tutorial cards.

## First Local Setup

```bash
git clone <repo-url>
cd ShortPulse
git fetch origin
git checkout codex/brother-dashboard-aesthetics
cd frontend
npm install
cp ../Scott/frontend.env.local.template .env.local
```

Then fill in `frontend/.env.local` with the working-development values supplied out-of-band.

## What The Owner Must Provide

Scott needs these values through a secure channel such as a password manager, encrypted note, or direct local handoff:

- Working-development Supabase anon key.
- Working-development Supabase service-role key.
- A non-production working-development login account if signed-in dashboard testing is needed.

Do not provide production Supabase keys. Do not provide Kie, Fal, OpenAI, ElevenLabs, Stripe, Vercel, or database URL credentials for this dashboard visual lane.

## Required Local Environment

Use only the working-development Supabase project:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://bgdhqbenqltxildlgkyu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<working-development anon key>
SUPABASE_SERVICE_ROLE_KEY=<working-development service-role key>
APP_BASE_URL=http://localhost:3000
SHORTPULSE_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_DASHBOARD_HIDE_LEGACY_SECTIONS=true
```

Why the service-role key is needed locally: `/api/dashboard/tutorials` reads global dashboard tutorial rows and signs private tutorial-thumbnail assets from the `dashboard_tutorial_thumbnails` bucket. Without a working-development `SUPABASE_SERVICE_ROLE_KEY`, the page may run but tutorial thumbnails can fail to load.

Keep this service-role key local only. Never paste it into chat, docs, Git, screenshots, or issue comments.

## Start The App

From `frontend/`:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000/
http://localhost:3000/dashboard
```

For signed-in dashboard work, create or use a non-production working-development account. Do not use production accounts or production Supabase.

## Verification Checklist

Before starting design work:

- `npm run dev` starts without missing-env errors.
- `http://localhost:3000/` loads the signed-out dashboard.
- `http://localhost:3000/dashboard` loads the signed-out dashboard when logged out.
- After signing into a working-development account, `/dashboard` loads the signed-in dashboard.
- The tutorial section shows `15` active tutorial cards.
- Tutorial thumbnail videos/posters render without `/api/dashboard/tutorials` returning `500`.
- Browser console has no repeated missing-thumbnail, auth, or Supabase permission errors.

## If It Fails

- If `/api/dashboard/tutorials` returns `500`, check `frontend/.env.local` has the working-development `SUPABASE_SERVICE_ROLE_KEY`.
- If thumbnails are blank, check the app is using `https://bgdhqbenqltxildlgkyu.supabase.co`, not production or staging.
- If login/callback behaves strangely, confirm `APP_BASE_URL=http://localhost:3000`.
- If `npm run dev` exits because the generation worker needs env, confirm the service-role key is present. For dashboard-only visual work, do not add provider keys unless the owner explicitly asks.

## Safe Change Rules

- Edit dashboard files only unless the owner expands scope.
- Likely dashboard files live under:
  - `frontend/features/dashboard/`
  - `frontend/pages/dashboard.tsx`
  - `frontend/pages/index.tsx`
  - dashboard-related CSS in `frontend/styles/`
- Preserve behavior while improving visuals.
- Do not remove the tutorial API, signed thumbnail flow, or the 15-card content contract.
- Do not add Supabase image transformations. ShortPulse prohibits Supabase image transformations on every path.
- When finished, run at least:

```bash
cd frontend
npm run lint
npm run type-check
```

If those are too broad for the current machine, report the exact command and failure instead of guessing.
