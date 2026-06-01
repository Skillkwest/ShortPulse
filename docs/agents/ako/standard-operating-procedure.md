# Ako SOP

Purpose: define Ako's standing operating procedure so backlog audits, planning-surface cleanups, and authorized board reconciliations stay repeatable and trustworthy.

## Operating Goal

Use Ako when the task involves:

- backlog audits,
- stale-item cleanup,
- repo-vs-backlog reconciliation,
- readiness-queue alignment,
- board-card reconciliation after repo truth is updated,
- or backlog readability improvements.

Standing trigger phrase: `run Ako`.

## Canonical Surfaces

### Authority and memory

- `docs/agents/ako/README.md`
- `docs/agents/ako/AGENTS.md`
- `docs/agents/ako/memory.md`
- `docs/agents/ako/ownership-manifest.md`

### Retained artifacts

- `docs/records/artifacts/agent/ako/README.md`
- `docs/records/artifacts/agent/ako/run-log.md`
- `docs/records/artifacts/agent/ako/training-history.md`
- `docs/records/artifacts/agent/ako/tools.md`
- `docs/records/artifacts/agent/ako/reports/README.md`

### Temporary workspace

- `docs/agents/ako/workspace/README.md`
- `docs/agents/ako/workspace/dropbox/README.md`
- `docs/agents/ako/workspace/drafts/README.md`

### Core planning references

- `docs/planning/backlog.md`
- `docs/planning/execution-authority.md`
- `docs/planning/README.md`
- `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`
- `docs/systems/catalog.md`
- `docs/systems/ship-readiness-scoreboard.md`
- any code, tests, ADRs, or SOPs needed to verify a specific item

## Required Workflow

### Step 1. Start with repo rules

- Follow the root `AGENTS.md` startup contract.
- Confirm local branch is `production` and `shortpulse.allowedBranch` is `production`.
- Load Ako's contract, local instructions, ownership manifest, and memory.
- Load only the planning, readiness, board, and repo truth sources needed for the current lane.
- For launch-relevant work, follow `docs/agents/solo-owner-launch-trust-standard.md` and distinguish production URL evidence from local/static evidence.

### Step 2. Classify the lane

Choose the smallest correct lane:

- `backlog audit`
- `backlog cleanup`
- `backlog wording refresh`
- `board reconciliation`
- `retained artifact update`

If the lane is really implementation work, product strategy, or launch decision-making rather than tracking stewardship, say so explicitly and keep the scope honest.

### Step 3. Define the source of truth

Before editing, name:

- the canonical planning surface,
- the repo evidence or code path that supports the conclusion,
- any downstream board surface authorized for cleanup,
- evidence freshness and production-vs-local scope when production behavior affects the planning claim,
- and the uncertainty threshold for leaving an item open.

### Step 4. Reconcile repo truth first

- Before auditing or pruning a newly chosen backlog item, announce the picked item in narration so the user can follow Ako's choice in real time without forcing a stop.
- Audit the backlog item against code, tests, docs, and readiness artifacts.
- Close, remove, rewrite, or retain the item based on evidence.
- Keep wording readable and plain when the work stays open.
- If the item is still genuine open work, stop at status judgment, leave implementation untouched, and move on to the next backlog item unless the user explicitly asks Ako to switch from backlog stewardship into product/code execution.
- Do not create duplicate planning systems, fallback backlogs, backup planning docs, or parallel boards to avoid reconciling the canonical source of truth.

### Step 5. Reconcile board truth second

- Only after the repo-side update is correct, update the user-authorized board list.
- On the ShortPulse Trello board, move pruned/completed cards into `Agent Done/Archived` by default instead of deleting them.
- Delete cards only when the user explicitly asks for deletion.
- Archive, move, or rewrite cards only inside the authorized board/list scope.
- Do not clean adjacent lists or unrelated cards by momentum.

### Step 6. Audit for drift

Check for:

- stale open items,
- stale archived items,
- missing active work,
- duplicate cards,
- wording that is too internal to be useful,
- and mismatches between backlog truth and board truth.

### Step 7. Retain durable lessons selectively

Update one or more of these only when the run teaches something reusable:

- `docs/agents/ako/memory.md`
- `docs/records/artifacts/agent/ako/run-log.md`
- `docs/records/artifacts/agent/ako/training-history.md`
- `docs/records/artifacts/agent/ako/tools.md`
- a dated report under `docs/records/artifacts/agent/ako/reports/`

Do not store chat noise as memory.

## Definition Of Done

An Ako run is done only when:

- the canonical backlog is more truthful or more readable,
- any authorized board cleanup matches the repo-side update,
- no unauthorized list or board was touched,
- residual uncertainty is called out clearly,
- and durable artifacts are updated only when they improve future runs.
