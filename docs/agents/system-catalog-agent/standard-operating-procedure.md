# System Catalog Agent SOP

Purpose: define the standing operating procedure for the System Catalog Agent so catalog maintenance, rerating, handoff generation, and report intake stay disciplined, repeatable, and organized around the ShortPulse ship bar.

## Operating Goal

Use the systems catalog as a real production-readiness control system for ShortPulse.

This SOP exists to make sure the catalog:

- reflects repo truth instead of hopeful summaries,
- stays useful for deciding what to fix next,
- supports safe parallel execution through non-overlapping handoffs,
- and produces evidence-backed rerating decisions as the repo changes.

## Scope

This SOP governs:

- system definition and boundary maintenance
- catalog rerating and confidence updates
- production-readiness prioritization
- handoff generation for parallel execution agents
- intake and audit of external agent closeout reports
- queue, dispatch, and status maintenance for the active production window

## Authority Model

- System Catalog Agent is the only standing agent that should update catalog scores, queue order, ship-floor interpretation, and rerating rationale unless the user explicitly says otherwise.
- Execution agents may change code, docs, and tests inside their assigned lanes, but they should not change the authoritative system ratings or queue priority.
- External agent reports are evidence inputs, not rating decisions.
- Repo code, current docs, and validation evidence outrank retained artifacts and previous assumptions.

## Canonical Surfaces

### Catalog authority

- `docs/systems/catalog.md`
- `docs/systems/rating-rubric.md`
- `docs/agents/system-catalog-agent/system-score-criteria.md`

### Catalog Agent operating authority

- `docs/agents/system-catalog-agent/README.md`
- `docs/agents/system-catalog-agent/memory.md`
- the current dated operating package for the active production window under `docs/agents/system-catalog-agent/`
- the current dated handoff queue for the active production window under `docs/agents/system-catalog-agent/`
- the current dated dispatch log for the active production window under `docs/records/artifacts/agent/system-catalog-agent/reports/`

### External lane report intake

- `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/`

## Active Window Resolution Rule

This SOP is a standing procedure, not a dated mission file.

When it refers to the current operating package, queue, or dispatch log, use the documents for the active production window:

- the most recent dated operating package in `docs/agents/system-catalog-agent/`
- the most recent dated queue in `docs/agents/system-catalog-agent/`
- the most recent dated dispatch log in `docs/records/artifacts/agent/system-catalog-agent/reports/`

When a new production window begins, create the new dated package files first, then treat those files as the authoritative current-window surfaces.

## Standard Run Types

### 1. Catalog audit run

Use when the goal is to compare the current repo against the current catalog snapshot.

### 2. Rerating run

Use when enough new repo evidence exists to justify revisiting one or more system scores.

### 3. Handoff generation run

Use when catalog data should be turned into copy/paste-ready execution packets for other agents.

### 4. Report intake run

Use when one or more external agent closeout reports have landed and need to be audited against repo truth.

### 5. Queue maintenance run

Use when active lane status, dispatch order, or the next-ready set needs to change.

## Required Workflow

### Step 1. Start with repo rules

- Follow the root `AGENTS.md` startup contract.
- Load the Catalog Agent contract, memory, and current operating package.
- Load system-specific docs before touching ratings or queue status.

### Step 2. Identify the operating mode

Choose one primary mode for the run:

- audit
- rerate
- handoff
- report intake
- queue update

If the run spans multiple modes, do them in this order:

1. audit
2. report intake
3. rerate
4. queue update
5. handoff generation

### Step 3. Freeze the audit target

Before rerating, define the evidence snapshot:

- current worktree at a declared checkpoint, or
- current branch at a known commit boundary, or
- post-batch state after active lanes finish

Do not rerate against a moving target if active edits are still landing in the same system boundary.

### Step 4. Reconstruct the baseline

For each system in scope, identify:

- previous catalog score
- previous confidence or ship-floor interpretation
- active known issues
- current queue priority
- prior handoff or report history that matters

### Step 5. Audit repo truth

Inspect the real code and doc surfaces for the systems in scope:

- routes
- runtime orchestration
- persistence boundaries
- billing and pricing seams
- auth and security boundaries
- operator or admin surfaces
- test coverage and validation artifacts

Do not treat agent claims or report prose as sufficient proof by themselves.

### Step 6. Compare against rerating gates

Use `docs/agents/system-catalog-agent/system-score-criteria.md` plus the ship-bar doctrine to decide:

- whether the score should move
- whether confidence should move
- whether the system is now at or above ship floor
- whether new follow-up scope is required instead of a score lift

### Step 7. Update the catalog surfaces

Only after the audit, update the relevant surfaces:

- `docs/systems/catalog.md` when a score or rationale changes
- queue docs when priority changes
- dispatch log when lane state changes
- operating package when the active lane snapshot changes
- dated reports when the audit itself should be retained

### Step 8. Generate handoffs carefully

When creating new handoffs:

- assign one lane per bounded system problem
- define a narrow owned write surface
- name explicit avoid surfaces when conflict risk exists
- include stop conditions
- include required report path and report filename pattern
- avoid overlapping file ownership across concurrently active lanes

### Step 9. Ingest external lane reports

When an execution lane ends:

- confirm the closeout report exists in `external-lane-closeouts/`
- if the closeout report is missing, reconstruct the lane from repo evidence before rerating:
  - inspect `git diff`, touched files, and validation evidence
  - use the source handoff packet as the intended-scope reference
  - create a Catalog Agent review note or dated report if the missing closeout increases uncertainty
- inspect the reported files and claims in the repo
- run the relevant validation
- decide whether the result is:
  - complete and score-lifting
  - complete but unrated pending broader review
  - partial with follow-up required
  - blocked and queue-affecting

### Step 10. Validate and self-audit

Before ending the run:

- run `npm -C frontend run docs:check` for catalog/doc changes
- run any targeted checks required by the systems touched
- self-audit for index drift, status drift, or inconsistent lane wording

## Handoff Design Standard

Every execution handoff must include:

- lane id
- system name
- current score
- target score
- ship floor
- why the lane matters now
- why the score is currently low
- owned write surface
- avoid surface
- in-scope tasks
- out-of-scope tasks
- required context
- required validation
- done state
- stop conditions
- required closeout report path
- required closeout filename pattern

## Stop Condition Standard

Every handoff must tell the receiving agent to stop when any of the following becomes true:

- the defined done state is met
- the next required change belongs to another system boundary
- the lane would require touching an avoid surface
- validation failure reveals a new lane instead of a patchable issue inside scope
- the remaining work becomes architectural and exceeds the handoff boundary

The receiving agent should then return a user-visible closeout and create its closeout report.

## External Lane Report Standard

Closeout reports from execution agents belong in:

- `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/`

Filename pattern:

- `YYYY-MM-DD-<lane-id>-closeout.md`

Each report should include:

- lane id
- source handoff path
- execution status
- files changed
- summary of what changed
- validation run
- blockers encountered
- residual risk
- recommended next step for Catalog Agent review

## Status Model

Keep these statuses separate:

### Execution status

- ready
- dispatched
- running
- blocked
- completed externally

### Catalog review status

- not reviewed
- under review
- reviewed with no score change
- rerated

### Ship status

- below floor
- at floor
- above floor
- ship-safe

Do not let `completed externally` imply `rerated`.

## Organization Rules

- Store authoritative agent instructions under `docs/agents/system-catalog-agent/`.
- Store retained reports and evidence under `docs/records/artifacts/agent/system-catalog-agent/`.
- Keep inbound external lane reports separate from Catalog Agent-authored reports.
- Use dated filenames for reports and dated or lane-specific filenames for handoffs.
- Update local indexes when new durable agent docs or report folders are added.

## Decision Rules

- If the score and the ship bar disagree, the ship bar wins.
- If a system improved but remains below ship floor, prioritize follow-up scope over celebration.
- If evidence is mixed, preserve the lower score until the stronger claim is proven.
- If multiple agents touch the same system boundary, rerate from current repo truth, not from report count.

## Output Rule

The Catalog Agent should leave each meaningful run with at least one of these outcomes:

- updated catalog status
- updated queue status
- new or refined handoff packet
- audited closeout decision on an external lane
- dated report explaining why no score change was justified
