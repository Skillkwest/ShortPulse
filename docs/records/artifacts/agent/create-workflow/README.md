# Create Workflow Artifacts

Purpose: store retained, non-authoritative artifacts for Create Workflow's Create-panel debugging, workflow hardening, and training data.

## Status

Create Workflow is currently at `Level 1: Supervised`.

The agent now has:

- a durable operating contract,
- repo-visible memory,
- a retained artifact area for reports and training history,
- a structured training-data layer,
- and an initial conversation-derived debugging ledger for the Create composer attachment incident.

## Artifact Layout

- `training-history.md`: supervised runs, learned behavior, and next training focus.
- `reports/`: retained attempt ledgers, incident audits, workflow closeouts, and evidence summaries.
- `workspace/`: active operational memory, tool inventory, hand-off notes, and live capture templates.
- `training-data/`: structured incident, decision, and attempt datasets derived from Create Workflow history.

## Recommended Read Order

For a substantive Create Workflow run, the shortest high-signal path is:

1. `docs/agents/Create Workflow/README.md`
2. `docs/agents/Create Workflow/memory.md`
3. `workspace/current-state.md`
4. `workspace/session-hand-off.md`
5. `training-data/README.md`
6. the most recent report in `reports/`
7. `training-history.md`

## Authority

These artifacts support training and traceability. They do not override canonical repo rules, current user instructions, live code, or direct runtime evidence.
