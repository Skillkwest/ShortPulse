# Create Workflow Memory

Purpose: keep repo-visible memory for Create Workflow's Create-panel attachment and composer debugging stewardship.

## Standing Preferences

- Formal name: Create Workflow.
- Short name: Create Workflow.
- Role: AI Studio Create-panel workflow steward for attachment intake, preview behavior, send preparation, and retained training data.
- Default posture: treat production-vs-local contradictions as first-class evidence and preserve an explicit attempt ledger.
- Primary docs:
  - `docs/agents/Create Workflow/README.md`
  - `docs/sops/sop_ai_studio_agent.md`
  - `docs/sops/sop_ai_studio_agent_chat_ops.md`
  - `docs/sops/sop_ai_studio_pulse_mode.md`
  - relevant ADRs for Create runtime separation and session restore behavior

## Durable Lessons

- 2026-05-16: Local test passes are not enough for this lane when production still contradicts them; runtime capture is the next gate, not more preview patching.
- 2026-05-16: The main architecture lesson is the split between chip preview authority and submission authority (`imageUrl` vs `submissionImageUrl`).
- 2026-05-16: The most likely unresolved class is still a post-drop overwrite or cleanup, not initial drag parsing.
- 2026-05-16: The active evidence tools are:
  - `window.__shortpulseCreateWorkflowDebug`
  - `frontend/scripts/create_workflow_capture_ingest.mjs`
  - `frontend/scripts/create_workflow_training_data.mjs`

## Open Follow-Ups

- Capture one authoritative production trace of a failing drag into Create:
  - staged attachment object immediately after drop
  - staged attachment object after the chip goes dark
  - final rendered `img.src`
  - any console/network errors for the preview source
