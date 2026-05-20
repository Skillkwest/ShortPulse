# Create Workflow Memory

Purpose: keep repo-visible memory for Create Workflow's Create-panel workflow stewardship, especially the runtime, composer, and reference/attachment lanes.

## Standing Preferences

- Formal name: Create Workflow.
- Short name: Create Workflow.
- Role: AI Studio Create-panel workflow steward for Standard/Pulse runtime ownership, composer behavior, reference/attachment intake, and retained training data.
- Default posture: treat production-vs-local contradictions as first-class evidence and preserve an explicit attempt ledger.
- Primary docs:
  - `docs/agents/Create Workflow/README.md`
  - `docs/agents/Create Workflow/create-panel-operating-brief.md`
  - `docs/sops/sop_ai_studio_agent.md`
  - `docs/sops/sop_ai_studio_agent_chat_ops.md`
  - `docs/sops/sop_ai_studio_pulse_mode.md`
  - relevant ADRs for Create runtime separation and session restore behavior
- Specialized competency:
  - the May 2026 composer image-insertion incident is a strong reusable playbook, but it is not the default lens for all Create work

## Durable Lessons

- 2026-05-16: Local test passes are not enough for this lane when production still contradicts them; runtime capture is the next gate, not more preview patching.
- 2026-05-16: Historical lane-specific lesson: the split between chip preview authority and submission authority (`imageUrl` vs `submissionImageUrl`) mattered for the old composer incident, but it is not the first lens for every new Create issue.
- 2026-05-16: The active evidence tools are:
  - `window.__shortpulseCreateWorkflowDebug`
  - `frontend/scripts/create_workflow_capture_ingest.mjs`
  - `frontend/scripts/create_workflow_training_data.mjs`
- 2026-05-19: The resolved Create composer image lane is chat-only and ephemeral. Do not widen this path into project persistence, storage promotion, or durable media recovery unless the product contract changes.
- 2026-05-19: The decisive bug was drag-intake classification, not image rendering alone. For internal app drags, prefer structured/internal/reference hints before raw browser `files`.
- 2026-05-19: The working mental model is:
  - snapshot drag payload synchronously
  - rebuild a stable transfer-like object for async work
  - stage a temporary `preparing` image attachment immediately
  - replace it with the ready attachment after ephemeral image preparation completes
- 2026-05-19: Keep the preview/send authority split, but within the composer lane the goal is a lightweight ChatGPT-style reference attachment, not durable asset management.
- 2026-05-19: Use `window.__shortpulseCreateWorkflowDebug.getDiagnosis()` only when the current runtime contradicts the resolved model; it is a lookup tool, not the default first step for every composer image change.

## Open Follow-Ups

- Verify the preparing-state spinner feels right in deployed Standard and Pulse surfaces.
- Keep the operating brief current when Standard/Pulse boundaries or primary Create surfaces change.
- If a future internal drag regression appears, start by checking source classification before expanding preview or persistence logic.
