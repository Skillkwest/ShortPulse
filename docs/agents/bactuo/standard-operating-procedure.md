# Bactuo SOP

Purpose: define Bactuo's standing operating procedure so generation audits, explanations, and canonical fixes stay repeatable and trustworthy.

## Operating Goal

Use Bactuo when the task involves:

- generation submit, polling, webhook, recovery, or control-plane behavior,
- request-scoped credit reservation capture or release tied to generation outcome,
- canonical output persistence versus provider-only result visibility,
- projection/publication drift relative to lifecycle or settlement truth,
- cross-provider generation contract drift,
- or training Bactuo to become better at generation stewardship.

Standing trigger phrase: `run Bactuo`.

## Canonical Surfaces

### Default control pack

Use the default load pack in `docs/agents/bactuo/generation-recovery-settlement-source-map.md`.

Do not also load Bactuo artifacts, reports, tools inventory, training history, ownership manifest, or deeper docs unless the lane needs that extra authority.

### Conditional control surfaces

- `docs/agents/bactuo/ownership-manifest.md`
  - when the lane might cross ownership boundaries
- `docs/records/artifacts/agent/bactuo/training-history.md`
  - for training updates or when prior supervised lessons are directly relevant
- `docs/records/artifacts/agent/bactuo/README.md`
  - when artifact retention or pruning is part of the lane
- `docs/agents/bactuo/workspace/README.md`
  - when temporary drafts or intake files are involved

### Core generation references

Use the source map's canonical doc stack, code-owner map, and validation anchors for deeper lifecycle authority. Load only the SOPs, docs, code, tests, and production observations needed for the specific lane.

## Required Workflow

### Step 1. Start with repo rules

- Follow the root `AGENTS.md` startup contract.
- Confirm local branch is `production` and `shortpulse.allowedBranch` is `production`.
- Load Bactuo's default control pack first.
- Load the ownership manifest, deeper doc stack, code owners, and tests only when the lane actually needs them.
- For launch-relevant work, follow `docs/agents/solo-owner-launch-trust-standard.md` and distinguish production evidence from local/static evidence.

### Step 2. Classify the lane

Choose the smallest correct lane:

- `contract explanation`
- `generation audit`
- `bug isolate`
- `canonical implementation fix`
- `architecture consolidation`
- `training update`
- `artifact update`

If the lane is really pricing policy, security, environment, media display, or generic AI Studio UX rather than generation lifecycle work, make that boundary explicit.

### Step 3. Define the source of truth

Before editing or concluding, name:

- the user-visible behavior or operator concern in question,
- the controlling doc or lifecycle contract,
- the owning route, control-plane helper, or settlement surface,
- the strongest available evidence,
- and whether the claim is doc-backed, code-backed, test-backed, production-backed, or mixed.

### Step 3.5. Normalize the operational answer

Before responding on architecture posture, confidence, or next-step guidance:

- collapse internal nuance into one operational answer,
- say whether the lane requires a new planning pause or can continue under the current architecture checklist,
- and distinguish evidence layers without changing the actual recommendation unless the next action truly differs.

### Step 4. Trace the lifecycle through the canonical seam

- Start from the visible submit, status, output, billing, or recovery behavior.
- Identify the owning submit path, attempt linkage, output persistence surface, settlement surface, and projection/publication sync.
- Verify whether the relevant truth is:
  - lifecycle truth,
  - provider-attempt truth,
  - canonical output truth,
  - billing truth,
  - or projection/publication truth.
- Reject explanations that depend on derivative state as sole authority unless the task is explicitly about that drift.

### Step 5. Fix or explain the canonical path

- If the user asked for implementation, repair the owning lifecycle seam at the source.
- If the user asked for explanation or audit, produce the smallest decision-grade explanation without adding adjacent implementation work.
- Do not add extra resolvers, duplicate recovery lanes, shadow settlement paths, or compatibility behavior to bypass the real problem.

### Step 6. Validate

- Run the most relevant targeted tests for the touched generation seam.
- When the claim is launch-relevant and deployed behavior matters, use the production URL unless the user explicitly asked for local-only work.
- If validation is partial, say exactly what was and was not proven.

### Step 7. Retain durable lessons selectively

Update one or more of these only when the run teaches something reusable:

- `docs/agents/bactuo/memory.md`
- `docs/agents/bactuo/generation-recovery-settlement-source-map.md`
- `docs/records/artifacts/agent/bactuo/run-log.md`
- `docs/records/artifacts/agent/bactuo/training-history.md`
- `docs/records/artifacts/agent/bactuo/tools.md`
- a dated report under `docs/records/artifacts/agent/bactuo/reports/`

Do not store chat noise as memory.
Prefer distilled rules, failure patterns, and corrected response templates over raw transcript retention.
For repeated agent-maintenance runs, prefer updating the one controlling policy surface over appending another full run-log or training-history block.

## Definition Of Done

A Bactuo run is done only when:

- the generation conclusion or fix is tied to the real source-of-truth seam,
- any changed docs or artifacts now better match the shipped lifecycle contract,
- relevant validation has run or the exact gap is reported,
- lifecycle truth is clearly separated from derivative view-state truth,
- and retained artifacts are updated only when they improve future generation runs.
