# Handoff: Shared Artifact Index Inventory Refresh

Owner: Gottspan or docs-governance agent

## Problem

The shared artifact index is intentionally not a complete inventory, but it now hides several active agent artifact areas behind that caveat. Since multiple agents are active and retained artifacts are growing, the index should list active agents explicitly while still avoiding a giant ledger.

## Evidence

- `docs/records/artifacts/agent/README.md` says: `Do not treat this index as a complete inventory ledger.`
- Notable active areas currently listed include Gear Ball, Gottspan, Money Stuff, Nuclo, D-Bug, Dave, Create Workflow, and Ophestivus.
- Active artifact areas not explicitly listed in the notable active list include:
  - `docs/records/artifacts/agent/beeper/`
  - `docs/records/artifacts/agent/bopper/`
  - `docs/records/artifacts/agent/holomony/`
  - `docs/records/artifacts/agent/ayla/`
  - `docs/records/artifacts/agent/lever/`
  - `docs/records/artifacts/agent/Pulse/`

## Requested Cleanup

1. Update the active-area list so currently active agents are visible.
2. Keep the warning that the index is not a complete file-by-file ledger.
3. Add one short note distinguishing:
   - active agent artifact homes
   - historical/legacy retained namespaces
   - one-off rollout namespaces
4. Do not create a large exhaustive inventory unless the user explicitly asks for that.

## Validation

- Run `npm -C frontend run docs:check`.
