# Create Workflow Workspace

Purpose: keep the Create Workflow agent's working memory, operational tools, and live-incident capture materials in one durable repo-visible place.

Status: archived hot-path workspace for the May 2026 composer image insertion incident.

Use this workspace only when:

- a similar Create composer drag/drop incident reappears,
- production contradicts the current resolved ephemeral model,
- or deeper historical lookup is needed.

Do not treat this folder as the default read path for ordinary Create work.

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

For a new incident in this same lane, read only these first:

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

Treat this folder as archived operational continuity for a resolved incident family.

When the lane changes materially again, refresh this workspace so the hot path reflects the current contract. Do not leave unresolved-state instructions in the hot path after the incident model changes.
