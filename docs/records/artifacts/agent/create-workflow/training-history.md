# Create Workflow Training History

Purpose: track how Create Workflow is trained, what behavior improves, and what still needs refinement.

## History

### 2026-05-16

- Lesson:
  - Preserve an explicit attempt ledger whenever production keeps contradicting local fixes.
- Artifact change:
  - Created the Create Workflow contract, memory, and initial incident audit.
- Next focus:
  - Capture the real production attachment lifecycle before more code changes.

### 2026-05-16 (workspace + tooling pass)

- Lesson:
  - Build evidence-capture tooling when the lane is stuck in production-vs-local contradiction.
- Artifact change:
  - Added the Create Workflow workspace bundle.
- Tool change:
  - Added `createWorkflowDebug`, the summarizer, and the capture skill.
- Next focus:
  - Capture one failing production drag with the runtime helper.

### 2026-05-16 (structured training-data pass)

- Lesson:
  - Training value comes from incident rows, decision pivots, and attempt families, not raw transcript alone.
- Artifact change:
  - Added the structured training-data layer.
- Tool change:
  - Added the training-data CLI and package commands.
- Next focus:
  - Append the first production-capture-derived rows after the next failing repro.

### 2026-05-16 (toolchain pass)

- Lesson:
  - Training data is operational only when the repo can validate, summarize, brief, and ingest new captures.
- Artifact change:
  - Added failure patterns and capture workflow docs.
- Tool change:
  - Added the capture-ingest CLI.
- Next focus:
  - Capture one failing production snapshot and run the ingest loop end to end.

### 2026-05-18 (workspace refresh)

- Lesson:
  - Stale hot-path context can degrade debugging by making the agent optimize for an old failure model.
- Artifact change:
  - Reorganized the Create Workflow workspace around the current drop-time durable image contract and moved older capture-only context to lookup status.
- Next focus:
  - Verify production with delivery state, durable `submissionImageUrl`, visible chip render, and model-send payload evidence in the same capture.

### 2026-05-18 (flight-recorder pass)

- Lesson:
  - The Create image issue needs a deterministic diagnosis surface, not another screenshot-derived UI patch.
- Tool change:
  - Added diagnosis output and send-payload instrumentation to the Create Workflow debug path.
- Artifact change:
  - Pruned hot memory away from stale preview-only hypotheses and made `getDiagnosis()` the first triage step.
- Next focus:
  - Capture production once and let the diagnosis pick the next failing lane.
