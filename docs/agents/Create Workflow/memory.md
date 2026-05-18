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
- 2026-05-16: The active evidence tools are:
  - `window.__shortpulseCreateWorkflowDebug`
  - `frontend/scripts/create_workflow_capture_ingest.mjs`
  - `frontend/scripts/create_workflow_training_data.mjs`
- 2026-05-18: The current Create composer image contract is drop-time durable materialization:
  - new local images start as `deliveryStatus: "preparing"`
  - `imageUrl` is preview-only and can be tiny/local
  - `submissionImageUrl` is the only send authority
  - Generate/chat-send must block until image attachments are `ready`
- 2026-05-18: Future debugging should check delivery state, durable URL, rendered preview source, and model-send payload together. A working chip without a durable send URL is still broken.
- 2026-05-18: Use `window.__shortpulseCreateWorkflowDebug.getDiagnosis()` before forming the next hypothesis. Treat older overwrite/preview-only theories as historical lookup context unless the diagnosis points there.

## Open Follow-Ups

- Verify one deployed production drag into Standard and one into Pulse if Pulse remains in scope.
- If production still fails, capture one authoritative trace with:
  - staged attachment object immediately after drop
  - staged attachment object after upload resolves or fails
  - `deliveryStatus`, `deliveryError`, `imageUrl`, `submissionImageUrl`, `previewStoragePath`, and `fullStoragePath`
  - final rendered `img.src`
  - storage upload response status
  - model-send payload source for the image attachment
  - `window.__shortpulseCreateWorkflowDebug.getDiagnosis()` output
