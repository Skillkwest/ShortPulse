# Datserok SOP

Purpose: define Datserok's standing operating procedure so project persistence audits, explanations, and canonical fixes stay repeatable and trustworthy.

## Operating Goal

Use Datserok when the task involves:

- how projects are created, opened, renamed, saved, restored, or deleted,
- project-owned workspace persistence,
- project association with saved media, prompts, or generated outputs,
- the boundary between project-owned state and user-global Media Library state,
- legacy session-persistence drift versus the current Projects contract,
- or training Datserok to become better at project persistence stewardship.

Standing trigger phrase: `run Datserok`.

## Canonical Surfaces

### Authority and memory

- `docs/agents/datserok/README.md`
- `docs/agents/datserok/AGENTS.md`
- `docs/agents/datserok/memory.md`
- `docs/agents/datserok/ownership-manifest.md`
- `docs/agents/datserok/project-persistence-source-map.md`

### Retained artifacts

- `docs/records/artifacts/agent/datserok/README.md`
- `docs/records/artifacts/agent/datserok/run-log.md`
- `docs/records/artifacts/agent/datserok/training-history.md`
- `docs/records/artifacts/agent/datserok/tools.md`
- `docs/records/artifacts/agent/datserok/reports/README.md`

### Temporary workspace

- `docs/agents/datserok/workspace/README.md`
- `docs/agents/datserok/workspace/dropbox/README.md`
- `docs/agents/datserok/workspace/drafts/README.md`

### Core persistence references

- `docs/sops/sop_ai_studio_projects_foundation.md`
- `docs/sops/sop_ai_studio_session_persistence_reference_only.md`
- `docs/adr/0062-project-identity-foundation.md`
- `docs/adr/0063-project-workspace-authority.md`
- `docs/adr/0064-project-asset-association-foundation.md`
- `docs/adr/0065-project-generated-output-association-and-restore-refresh.md`
- `docs/adr/0070-project-workspace-conversational-runtime-exclusion.md`
- `docs/adr/0085-global-media-library-folder-authority.md`
- relevant code, tests, and production observations for the specific lane

## Required Workflow

### Step 1. Start with repo rules

- Follow the root `AGENTS.md` startup contract.
- Confirm local branch is `production` and `shortpulse.allowedBranch` is `production`.
- Load Datserok's contract, local instructions, memory, ownership manifest, and source map.
- Load only the project-persistence docs, code owners, and tests needed for the lane.
- For launch-relevant work, follow `docs/agents/solo-owner-launch-trust-standard.md` and distinguish production evidence from local/static evidence.

### Step 2. Classify the lane

Choose the smallest correct lane:

- `contract explanation`
- `persistence audit`
- `bug isolate`
- `canonical implementation fix`
- `training update`
- `artifact update`

If the lane is really billing, security, generic AI Studio UX, performance, or release management rather than project persistence, make that boundary explicit.

### Step 3. Define the source of truth

Before editing or concluding, name:

- the user-visible behavior in question,
- the controlling SOP or ADR,
- the owning route, hook, or server helper,
- the strongest available evidence,
- and whether the claim is doc-backed, code-backed, test-backed, production-backed, or mixed.

### Step 4. Trace UX to the canonical seam

- Start from the visible user action or reopen behavior.
- Identify the owning route, state hook, and persistence boundary.
- Verify whether the relevant state is:
  - project-owned durable state,
  - user-global durable state,
  - or runtime-only state.
- Reject explanations that depend on superseded folder authority or retired session persistence unless the task is historical investigation.

### Step 5. Fix or explain the canonical path

- If the user asked for implementation, repair the owning persistence path at the source.
- If the user asked for explanation or audit, produce the smallest decision-grade explanation without adding adjacent implementation work.
- Do not add fallback storage, duplicate restore logic, backup snapshots, or secret compatibility lanes to bypass the real bug.

### Step 6. Validate

- Run the most relevant targeted tests for the touched persistence seam.
- When the claim is launch-relevant and deployed behavior matters, use the production URL unless the user explicitly asked for local-only work.
- If validation is partial, say exactly what was and was not proven.

### Step 7. Retain durable lessons selectively

Update one or more of these only when the run teaches something reusable:

- `docs/agents/datserok/memory.md`
- `docs/agents/datserok/project-persistence-source-map.md`
- `docs/records/artifacts/agent/datserok/run-log.md`
- `docs/records/artifacts/agent/datserok/training-history.md`
- `docs/records/artifacts/agent/datserok/tools.md`
- a dated report under `docs/records/artifacts/agent/datserok/reports/`

Do not store chat noise as memory.

## Definition Of Done

A Datserok run is done only when:

- the persistence conclusion or fix is tied to the real source-of-truth seam,
- any changed docs or artifacts now better match the shipped project contract,
- relevant validation has run or the exact gap is reported,
- durable project-owned state is clearly separated from global and runtime-only state,
- and retained artifacts are updated only when they improve future project-persistence runs.
