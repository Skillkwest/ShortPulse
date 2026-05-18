# Create Workflow Workspace

Purpose: keep the Create Workflow agent's working memory, operational tools, and live-incident capture materials in one durable repo-visible place.

Use this workspace when a new run needs to continue the Create composer attachment investigation without reconstructing context from chat.

## Contents

- `current-state.md`
  - latest known symptom state, proven fixes, unresolved gaps, and highest-value next move
- `tool-inventory.md`
  - helper code, scripts, skills, and the specific problem each one is meant to reduce
- `production-capture-template.md`
  - exact capture checklist and artifact format for the next live failing repro
- `session-hand-off.md`
  - concise hand-off notes for the next agent run

## Rule

Treat this folder as the operational continuity layer for Create Workflow.

When the lane changes materially, update this workspace first, then update broader reports only if the change is durable enough to matter outside the immediate incident.
