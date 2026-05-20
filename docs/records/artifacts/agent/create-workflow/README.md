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
- `workspace/`: archived operational memory, tool inventory, hand-off notes, and live capture templates for the resolved composer-image incident family.
- `training-data/`: structured incident, decision, and attempt datasets derived from Create Workflow history.

## Recommended Read Order

For a substantive Create Workflow run, the shortest high-signal path is:

1. `docs/agents/Create Workflow/README.md`
2. `docs/agents/Create Workflow/create-panel-operating-brief.md`
3. `docs/agents/Create Workflow/memory.md`
4. `docs/agents/Create Workflow/standard-operating-procedure.md`
5. `training-history.md`

Read `workspace/` only when a live Create composer incident is active again or when a similar drag/drop contradiction reappears.

Use `training-data/`, `reports/`, and `training-history.md` as lookup-only context unless the hot path is insufficient.

## Authority

These artifacts support training and traceability. They do not override canonical repo rules, current user instructions, live code, or direct runtime evidence.
