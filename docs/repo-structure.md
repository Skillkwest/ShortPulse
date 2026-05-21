# Repo Structure

This document describes the canonical layout of the ShortPulse product repo and where to put new work.

## Top-level

- Core product and documentation surfaces:
  - `frontend/`: Next.js (pages router) app.
  - `docs/`: Engineering, product, and operations documentation.
  - `scripts/`: repository validation, deployment, and operator tooling.
  - `sql/`: Supabase bootstrap scripts and migrations.
- Root operational workspaces:
  - `ayla/`: Ayla-owned working drafts, support packets, and temporary intake.
  - `beeper/`: Beeper testing workspace for route audits, reports, and helper scripts.
  - `bopper/`: Bopper average-user testing workspace for confusion, abandonment, and checkpoint evidence.
  - `nuclo/`: Nuclo-owned workspace for environment/version management scratch, inbox, and handoffs.
- Support and reference surfaces:
  - `agent-teaching/`: local teaching and agent-training curriculum.
  - `assets/`: non-runtime design/reference artifacts.
  - `research/`: deep research and hardening writeups that are useful context but not canonical product truth.
  - `skills/`: repo-local skill helpers referenced by the startup contract and specialized lanes.
  - `supabase/`: Supabase CLI config plus local temp metadata; operational support surface, not product source of truth.
  - `mini-ecosystem/`: separate entity; exclude from default audits and planning unless the task explicitly includes Mini Ecosystem scope.

## Workspace Model

ShortPulse uses three distinct agent-facing layers:

- `docs/agents/<name>/` or a file-based contract such as `docs/agents/ophestivus.md`:
  durable contract, memory entrypoint, and standing instructions.
- `docs/records/artifacts/agent/<name>/`:
  retained non-authoritative run artifacts, reports, KPIs, and training history.
- repo-root workspaces such as `ayla/`, `beeper/`, `bopper/`, and `nuclo/`:
  active scratch, handoff, and temporary working material that should stay separate from canonical product code and docs.

Root workspaces are operational surfaces, not source of truth. Durable lessons should be promoted into `docs/agents/` or `docs/records/artifacts/agent/` when they need to survive beyond the active working lane.

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
- `docs/systems/`: authoritative systems catalog and rating docs.
- `docs/planning/`: active planning and backlog docs.
- `docs/adr/`: architecture decision records.
- `docs/design/`: design rationale.
- `docs/archive/`: historical/non-authoritative docs.
- `docs/brainstorming/`: exploratory concepts.

## Non-goals

- Do not introduce a standalone backend service without an explicit ADR.
