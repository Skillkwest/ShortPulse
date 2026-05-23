# Handoff: Change Impact Auditor Folder Consistency

Owner: docs-governance agent or Gottspan

## Problem

`change-impact-auditor` remains a flat file under `docs/agents/`, while most active agents now use a folder with `README.md` and optional memory/SOP surfaces. This is not a functional blocker, but it is an agent-discoverability inconsistency.

## Evidence

- Flat file:
  - `docs/agents/change-impact-auditor.md`
- Indexed from:
  - `docs/agents/README.md`
  - `docs/README.md`
- Most active agents now live under:
  - `docs/agents/<agent-name>/README.md`

## Requested Cleanup

1. Decide whether `change-impact-auditor` is an active agent or a simple helper contract.
2. If active, convert it to:
   - `docs/agents/change-impact-auditor/README.md`
   - optional `memory.md` only if durable local memory is truly needed.
3. If it remains a helper, explicitly mark it as a file-based helper rather than a full agent.
4. Update `docs/agents/README.md` and `docs/README.md` if the path changes.

## Validation

- Run `npm -C frontend run docs:check`.
