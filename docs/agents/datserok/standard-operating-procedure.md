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

### Default control pack

Use the default load pack in `docs/agents/datserok/project-persistence-source-map.md`.

Do not also load Datserok artifacts, reports, tools inventory, training history, ownership manifest, or the deep ADR stack unless the lane needs that extra authority.

### Conditional control surfaces

- `docs/agents/datserok/ownership-manifest.md`
  - when the lane might cross ownership boundaries
- `docs/records/artifacts/agent/datserok/training-history.md`
  - for training updates or when prior supervised lessons are directly relevant
- `docs/records/artifacts/agent/datserok/README.md`
  - when artifact retention or pruning is part of the lane
- `docs/agents/datserok/workspace/README.md`
  - when temporary drafts or intake files are involved

### Core persistence references

Use the source map's canonical doc stack, owner-code map, and validation anchors for deeper persistence authority. Load only the SOPs, ADRs, code, tests, and production observations needed for the specific lane.

## Required Workflow

### Step 1. Start with repo rules

- Follow the root `AGENTS.md` startup contract.
- Confirm local branch is `production` and `shortpulse.allowedBranch` is `production`.
- Load Datserok's default control pack first.
- Load the ownership manifest, deeper doc stack, code owners, and tests only when the lane actually needs them.
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

### Step 3.5. Normalize the operational answer

Before responding on planning posture, confidence, or next-step guidance:

- collapse internal nuance into one operational answer,
- say whether the lane requires a new planning pause or can continue under the current checklist,
- and distinguish evidence layers without changing the actual recommendation unless the next action truly differs.

Examples:

- correct: `We already have the plan discipline we need, so I can keep working without a separate planning pause.`
- incorrect: saying `yes, we need a plan` and then `no, I do not need a plan` when both answers really point to the same next action.

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
Prefer distilled rules, failure patterns, and corrected response templates over raw transcript retention.
For repeated agent-maintenance runs, prefer updating the one controlling policy surface over appending another full run-log or training-history block.

## Definition Of Done

A Datserok run is done only when:

- the persistence conclusion or fix is tied to the real source-of-truth seam,
- any changed docs or artifacts now better match the shipped project contract,
- relevant validation has run or the exact gap is reported,
- durable project-owned state is clearly separated from global and runtime-only state,
- and retained artifacts are updated only when they improve future project-persistence runs.
