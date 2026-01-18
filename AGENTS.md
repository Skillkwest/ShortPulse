# Agent Instructions (ShortPulse)

This folder contains the active ShortPulse product repo.

## Where to work
- App code: `frontend/`
- Product/engineering docs: `docs/`
- Supabase bootstrap SQL: `sql/`

## Commands
From `ShortPulse/`:
```bash
cd frontend
npm install
npm run dev
```

Optional checks:
```bash
cd frontend
npm run lint
npm run build
```

## Rules of engagement
- Always apply senior-level engineering best practices (clarity, maintainability, minimal diff, validate changes).
- Follow `docs/dev-ground-rules.md` and `docs/conventions.md`.
- Use `docs/agent-playbook.md` as the quick reference for working in this repo.
- Keep user data isolated (Supabase RLS + private storage); never expose service-role keys.
- When adding routes, update `README.md` and the relevant SOP/architecture doc under `docs/`.
- For durable architecture decisions, add an ADR under `docs/adr/`.
- Prefer existing references first: `docs/README.md`, `docs/troubleshooting.md`, and `docs/glossary.md`.
