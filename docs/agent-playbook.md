# Agent Playbook

Single-page guide for AI agents and contributors to work safely in this repo.

## Canonical commands
- Frontend dev server: `cd frontend && npm run dev`
- One-time deps: `cd frontend && npm install`
- Optional checks: `cd frontend && npm run lint` / `npm run build`

## Structure to respect
- App lives in `frontend/` (Next.js pages router, client-only).
- Docs in `docs/`; start at `docs/README.md` and keep ADRs in `docs/adr/`.
- Supabase bootstrap SQL in `sql/`; do not add secrets.
- Follow feature module pattern (`features/<name>/{types,constants,data,utils,logic,components}`) and keep pages thin.
- Aim to keep files under ~500 lines; if they exceed, document why and plan a split.

## Styling rules
- Use modular CSS under `frontend/styles/`; do not add rules to `globals.css`.
- Prefer feature-scoped CSS files rather than growing very large sheets; split when practical.

## Supabase and security
- Only use anon key on the client; never check in service-role keys or `.env.local`.
- Enforce per-user isolation: RLS on `saved_creators`, `media_files`, and private `media_library` bucket paths (`auth.uid()` scoped).
- Protected routes: `/dashboard`, `/performance`, `/saved-creators`, `/media-library`, `/profile`, `/ai-studio`, `/creator-studio`.
- Reuse `frontend/lib/supabaseClient` and `useProtectedRoute` instead of ad-hoc clients.

## File hygiene
- Every file needs a top-level purpose comment; exported functions/components get doc comments when not obvious.
- Avoid embedding sample data in pages; keep fixtures in `data/`.
- Do not edit generated output (`.next/`, `node_modules/`).

## When adding features
- Create a feature folder first, define types/constants, then utils/logic, then components; pages orchestrate only.
- Add or update SOPs/docs for new routes and Supabase tables; add ADRs for durable architectural changes.
- Update `docs/routes.md` and `docs/repo-structure.md` if new routes/folders are created.

## Safe defaults for agents
- Prefer existing helpers/components before adding new dependencies.
- Keep UI consistent with existing palette/spacing (see `docs/styles-structure.md`).
- For large refactors, propose a plan and execute incrementally; avoid exceeding file size limits.

## Maintenance skills
- Run `npm -C frontend run docs:check` to validate API docs are indexed.
- Use `skills/skill-pricing-audit/SKILL.md` before changing pricing/models or credit logic.
- Use `skills/skill-doc-index/SKILL.md` when adding or renaming docs.
