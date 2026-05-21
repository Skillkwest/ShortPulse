# Create Workflow Artifacts

Purpose: store retained, non-authoritative artifacts for Create Workflow's Create-panel debugging, workflow hardening, and training data.

## Status

Create Workflow is currently at `Level 1: Supervised`.

The agent now has:

- a durable operating contract,
- repo-visible memory,
- a retained artifact area for reports and training history,
- a structured training-data layer,
- and a retained debugging/training ledger for the resolved Create composer attachment incident family.

## Artifact Layout

- `training-history.md`: supervised runs, learned behavior, and next training focus.
- `reports/`: retained attempt ledgers, incident audits, workflow closeouts, and evidence summaries.
- `workspace/`: archived operational memory, tool inventory, and live capture templates for the resolved composer-image incident family.
- `training-data/`: structured incident, decision, and attempt datasets derived from Create Workflow history.

## Recommended Read Order

For most Create Workflow runs, stop after the contract-side hot path:

1. `docs/agents/Create Workflow/README.md`
2. `docs/agents/Create Workflow/create-panel-operating-brief.md`
3. `docs/agents/Create Workflow/memory.md`

Load retained artifacts only when needed:

- `training-history.md`
  - when reviewing maturity, drift, or prior supervised learning
- `reports/`
  - when a current issue clearly matches the old incident family
- `training-data/`
  - when you need structured retrieval instead of narrative history
- `workspace/`
  - only when a composer drag/drop regression reappears and the hot contract is not enough

## Authority

These artifacts support training and traceability. They do not override canonical repo rules, current user instructions, live code, or direct runtime evidence.
