# Create Workflow Training History

Purpose: track how Create Workflow is trained, what behavior improves, and what still needs refinement.

## History

### 2026-05-16 to 2026-05-18 (incident foundation and tooling)

- Lesson:
  - When production keeps contradicting local fixes, the agent needs an explicit attempt ledger and capture-first discipline instead of another speculative patch loop.
- Artifact change:
  - Created the Create Workflow contract, memory, incident audit, workspace bundle, and structured training-data layer.
- Tool change:
  - Added `createWorkflowDebug`, the capture summarizer, the capture-ingest path, and the training-data CLI.
- Retained caution:
  - These materials were created during the unresolved phase and should not be treated as the default hot path after resolution.
- Next focus at the time:
  - capture one authoritative production repro instead of deepening local-only fixes

### 2026-05-18 (mid-incident maintenance)

- Lesson:
  - Stale hot-path incident context can degrade judgment by keeping the agent locked onto an outdated failure model.
- Artifact change:
  - Reorganized the workspace and diagnosis tooling so unresolved-state materials became easier to consult selectively.
- Superseded note:
  - This phase was still operating before the final chat-only ephemeral contract was locked in.
- Next focus at the time:
  - use runtime capture to distinguish preview issues from source-classification and send-preparation failures

### 2026-05-19 (composer image insertion resolved)

- Lesson:
  - The decisive bug was a drag-intake boundary problem. Internal app drags must prefer structured reference hints over raw browser `files`.
- Artifact change:
  - Added the retrospective and updated the incident case, failure patterns, decision episodes, and attempt ledger to reflect the resolved model.
- Product lesson:
  - The Create composer image lane should stay chat-only, ephemeral, and visibly staged while loading.
- Ongoing reusable rule:
  - Reuse the snapshot-plus-structured-hints pattern the next time an internal drag/drop lane behaves differently from desktop file drop.
