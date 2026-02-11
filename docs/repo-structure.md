# Repo Structure

This document describes the canonical layout of the ShortPulse product repo and where to put new work.

## Top-level
- `frontend/`: Next.js (pages router) app.
- `docs/`: Engineering, product, and operations documentation.
- `sql/`: Supabase bootstrap scripts and migrations.
- `assets/`: Non-runtime design/reference artifacts.

## Frontend layout
- `frontend/pages/`: Route entry points (keep thin).
- `frontend/features/`: Feature modules.
- `frontend/components/`: Shared reusable UI.
- `frontend/prefabs/`: Reusable UI kits by domain.
- `frontend/lib/`: Cross-cutting clients/helpers.
- `frontend/styles/`: Modular CSS imported via `globals.css`.
- `frontend/public/`: Runtime static assets.

## Documentation layout
- `docs/README.md`: entrypoint index.
- `docs/api/`: API/provider references.
- `docs/sops/`: SOP runbooks.
- `docs/product/`: product/domain source-of-truth docs.
- `docs/planning/`: active planning and backlog docs.
- `docs/adr/`: architecture decision records.
- `docs/design/`: design rationale.
- `docs/archive/`: historical/non-authoritative docs.
- `docs/brainstorming/`: exploratory concepts.

## Non-goals
- Do not introduce a standalone backend service without an explicit ADR.
