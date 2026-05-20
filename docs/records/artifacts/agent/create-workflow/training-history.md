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
  - Reorganized the Create Workflow workspace around the then-active incident model and moved older capture-only context to lookup status.
- Superseded note:
  - This pre-resolution workspace framing was superseded on 2026-05-19 by the resolved chat-only ephemeral composer image contract.
- Next focus:
  - Verify production with delivery state, durable `submissionImageUrl`, visible chip render, and model-send payload evidence in the same capture.

### 2026-05-18 (flight-recorder pass)

- Lesson:
  - The Create image issue needs a deterministic diagnosis surface, not another screenshot-derived UI patch.
- Tool change:
  - Added diagnosis output and send-payload instrumentation to the Create Workflow debug path.
- Artifact change:
  - Pruned hot memory away from stale preview-only hypotheses and temporarily made `getDiagnosis()` the first triage step for the unresolved incident phase.
- Superseded note:
  - After the 2026-05-19 resolution, `getDiagnosis()` became a contradiction/debug helper again, not the default first step for ordinary Create work.
- Next focus:
  - Capture production once and let the diagnosis pick the next failing lane.

### 2026-05-19 (composer image insertion resolved)

- Lesson:
  - The incident was mainly a drag-intake boundary bug. Internal app drags must prefer structured reference hints over raw browser `files`.
- Artifact change:
  - Added a retrospective that compresses the incident into durable debugging heuristics and product-contract lessons.
- Data change:
  - Updated the incident case from unresolved to resolved and appended new failure-pattern, decision-episode, and attempt-ledger rows for the decisive pivots.
- Product lesson:
  - The Create composer image lane should stay chat-only, ephemeral, and visibly staged while loading.
- Next focus:
  - Reuse the snapshot-plus-structured-hints pattern the next time an internal drag/drop lane behaves differently from desktop file drop.
