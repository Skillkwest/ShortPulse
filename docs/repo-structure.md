# Repo Structure

This document describes the **canonical layout** of the ShortPulse product repo and where to put new work.

## Top-level
- `frontend/`: Next.js (pages router) client-only app.
- `docs/`: Engineering + product documentation (start at `docs/README.md`).
- `sql/`: Supabase bootstrap scripts used by the client app.

## Frontend layout
- `frontend/pages/`: Route entry points (keep thin).
- `frontend/features/`: Feature modules following the documented pattern.
- `frontend/components/`: Shared UI components reused across features.
- `frontend/lib/`: Cross-cutting clients/helpers (e.g., Supabase client, auth guard).
- `frontend/styles/`: Modular CSS imported via `frontend/styles/globals.css`.
- `frontend/public/`: Runtime assets served by Next.js.

## Documentation layout
- `docs/README.md`: docs index (start here).
- `docs/adr/`: architecture decision records (ADRs).
- `docs/sop_*.md`: runbooks/standard operating procedures for specific flows.

## Non-goals
- This repo currently runs **client-only**; don’t introduce a backend dependency without an explicit decision + ADR.

