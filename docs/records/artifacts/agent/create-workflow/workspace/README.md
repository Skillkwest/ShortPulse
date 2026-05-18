# Create Workflow Workspace

Purpose: keep the Create Workflow agent's working memory, operational tools, and live-incident capture materials in one durable repo-visible place.

Use this workspace when a new run needs to continue the Create composer attachment investigation without reconstructing context from chat.

## Contents

- `current-state.md`
  - latest known symptom state, proven fixes, unresolved gaps, and highest-value next move
- `session-hand-off.md`
  - concise hand-off notes for the next agent run
- `tool-inventory.md`
  - helper code, scripts, skills, and the specific problem each one is meant to reduce
- `production-capture-template.md`
  - exact capture checklist and artifact format for the next live failing repro
- `captures/`
  - landing area for raw and summarized production repro captures

## Hot Read Path

For the next debugging run, read only these first:

1. `current-state.md`
2. `session-hand-off.md`
3. `production-capture-template.md`
4. `tool-inventory.md`

## Lookup Only

Use broader reports and training data only when the hot path does not answer the question:

- `../reports/`
- `../training-data/`
- `../training-history.md`

## Rule

Treat this folder as the operational continuity layer for Create Workflow.

When the lane changes materially, update this workspace first, then update broader reports only if the change is durable enough to matter outside the immediate incident. Keep stale hypotheses out of the hot path.
