# Datserok Runtime Load Policy

Purpose: define the minimum Datserok runtime context that should load by default so project-persistence work stays fast, lean, and reliable.

## Always Load

These are the default Datserok runtime surfaces after the repo startup contract is complete:

- `docs/agents/datserok/README.md`
- `docs/agents/datserok/AGENTS.md`
- `docs/agents/datserok/memory.md`
- this file

Default load is identity, scoped rules, concise memory, and routing only. Do not include code-owner maps, retained reports, old handoffs, full ADR/SOP bodies, or prior incident narratives unless the active lane needs that proof.

## Load Conditionally

Load these only when the lane truly needs them:

- `docs/agents/datserok/project-persistence-source-map.md`
  - first conditional load for substantive project-persistence audits, implementation work, source-of-truth comparisons, validation planning, or any lane that needs the current code-owner map and proof anchors
- `docs/agents/datserok/standard-operating-procedure.md`
  - when doing substantive persistence audits, canonical fixes, training updates, or agent-maintenance work
- `docs/agents/datserok/ownership-manifest.md`
  - when the lane may cross into media display, media ingestion, runtime behavior, environment, release, security, readiness, or another named owner surface
- `docs/sops/sop_ai_studio_projects_foundation.md`
  - when current shipped project-persistence contract details matter
- `docs/adr/0062-project-identity-foundation.md`
- `docs/adr/0063-project-workspace-authority.md`
- `docs/adr/0064-project-asset-association-foundation.md`
- `docs/adr/0065-project-generated-output-association-and-restore-refresh.md`
- `docs/adr/0070-project-workspace-conversational-runtime-exclusion.md`
- `docs/adr/0085-global-media-library-folder-authority.md`
- `docs/adr/0089-large-project-persistence-hybrid-checkpoint-and-output-display-records.md`
  - when the lane needs the deeper persistence authority stack
- `docs/sops/sop_ai_studio_session_persistence_reference_only.md`
  - only for historical drift checks involving the retired `sid` lane
- `docs/records/artifacts/agent/datserok/README.md`
  - when artifact governance or pruning is part of the task
- `docs/records/artifacts/agent/datserok/training-history.md`
  - when supervised lessons or retained maintenance history are directly relevant
- `docs/records/artifacts/agent/datserok/run-log.md`
  - when historical continuity of a prior substantive Datserok run matters
- `docs/records/artifacts/agent/datserok/tools.md`
  - when helper inventory or tooling needs are part of the lane
- `docs/records/artifacts/agent/datserok/reports/README.md`
  - when reviewing report retention or filing a new report
- dated reports under `docs/records/artifacts/agent/datserok/reports/`
  - only when historical persistence evidence is needed; read the reports index first, then load the single named report or smallest report set that answers the proof question
- `docs/agents/datserok/workspace/README.md`
  - when workspace scratch, drafts, or intake handling is part of the task
- files under `docs/agents/datserok/workspace/`
  - only when an active draft, scratch note, or temporary intake file is the named target

## Do Not Load By Default

These are useful retained surfaces, but they should stay out of normal Datserok runtime context unless the lane explicitly needs them:

- training history
- run log
- tools inventory
- retained reports
- workspace scratch areas
- prior incident handoffs
- deep ADR/SOP reads beyond the current proof question
- old conversational context, unless the current task explicitly asks to reconstruct that history

## Practical Rule

When in doubt:

1. finish the repo startup contract
2. load Datserok contract + scoped instructions + memory + this policy
3. load the source map first when persistence proof, code ownership, or validation anchors are needed
4. load the SOP, ownership manifest, deeper persistence docs, or retained artifacts only if the current lane truly needs them

Do not carry old incident narratives or retained-history material into a new persistence lane by momentum.

## Self-Maintenance Rule

For Datserok performance audits, prefer tightening this routing policy, the source map, memory, or artifact indexes over appending new retained-history entries. The recurring maintenance risk is bulk-loading old reports and prior-thread narratives, not loss of retained evidence.
