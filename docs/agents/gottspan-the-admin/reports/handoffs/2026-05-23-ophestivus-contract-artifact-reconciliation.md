# Handoff: Ophestivus Contract And Artifact-Home Reconciliation

Owner: Ophestivus

## Problem

Ophestivus is split awkwardly. The visible contract in `docs/agents/ophestivus/README.md` is thin and product-future oriented, while the active local identity, memory, instructions, tools, and reports live under `docs/records/artifacts/agent/ophestivus/`. That makes it hard for a new run to know which surface is authoritative for active Ophestivus work.

## Evidence

- Thin visible contract:
  - `docs/agents/ophestivus/README.md`
- Active local home:
  - `docs/records/artifacts/agent/ophestivus/AGENTS.md`
  - `docs/records/artifacts/agent/ophestivus/README.md`
  - `docs/records/artifacts/agent/ophestivus/memory.md`
  - `docs/records/artifacts/agent/ophestivus/tools.md`
  - `docs/records/artifacts/agent/ophestivus/sops.md`
  - `docs/records/artifacts/agent/ophestivus/reports/`
- Artifact AGENTS says the artifact folder is Ophestivus's canonical local home, while the docs/agents contract remains the visible product-side contract.

## Requested Cleanup

1. Decide whether active Ophestivus operating instructions should remain in artifacts or move into `docs/agents/ophestivus/`.
2. If the split remains intentional, update `docs/agents/ophestivus/README.md` so it clearly points to the active local home and explains the distinction.
3. If the split is not intentional, migrate the active contract/load policy into `docs/agents/ophestivus/` and leave artifacts for retained history only.
4. Avoid duplicating SOP text; keep canonical workflows in `docs/sops/`.
5. Make the default load path obvious in one place.

## Validation

- Run `npm -C frontend run docs:check`.
- Confirm a new Ophestivus run can identify its active contract, memory, tools, and SOP index without reading historical reports.
