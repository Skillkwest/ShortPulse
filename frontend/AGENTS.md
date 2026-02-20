# Agent Instructions (ShortPulse Frontend)

Scope: `ShortPulse/frontend/` (Next.js pages router with client UI and internal server API routes under `pages/api/*`).

## Default expectations

- Prefer the feature module pattern described in `../docs/frontend-architecture.md` (`features/<name>/{types,constants,data,utils,logic,components}`).
- Keep `pages/` thin (composition + orchestration only); push logic into `features/*/logic` or `features/*/utils`.
- Use modular CSS under `styles/` and keep `styles/globals.css` as an import-only aggregator (see `../docs/styles-structure.md`).
- See `../docs/agent-playbook.md` for the one-page checklist.

## Don’ts

- Don’t edit `node_modules/` or generated output (`.next/`).
- Don’t introduce external backend services without an explicit product decision; server-side logic in `pages/api/*` is already part of this repo’s architecture.
- Don’t add secrets to the repo; never paste `.env.local` contents.

## Validation

- Prefer `npm run lint` and `npm run build` from `ShortPulse/frontend/` before finalizing changes.
