# Copperknot SOP

Purpose: define the standing operating procedure for the Copperknot so catalog maintenance, rerating, handoff generation, and report intake stay disciplined, repeatable, and organized around the ShortPulse ship bar.

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

- Copperknot is the only standing agent that should update catalog scores, queue order, ship-floor interpretation, and rerating rationale unless the user explicitly says otherwise.
- Execution agents may change code, docs, and tests inside their assigned lanes, but they should not change the authoritative system ratings or queue priority.
- External agent reports are evidence inputs, not rating decisions.
- Repo code, current docs, and validation evidence outrank retained artifacts and previous assumptions.

## Canonical Surfaces

### Catalog authority

- `docs/systems/catalog.md`
- `docs/systems/rating-rubric.md`
- `docs/agents/copperknot/system-score-criteria.md`

### Copperknot operating authority

- `docs/agents/copperknot/README.md`
- `docs/agents/copperknot/memory.md`
- the current dated operating package for the active production window under `docs/agents/copperknot/`
- the current dated handoff queue for the active production window under `docs/agents/copperknot/`
- the current dated dispatch log for the active production window under `docs/records/artifacts/agent/copperknot/reports/`

### External lane report intake

- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`

## Active Window Resolution Rule

This SOP is a standing procedure, not a dated mission file.

When it refers to the current operating package, queue, or dispatch log, use the documents for the active production window:

- the most recent dated operating package in `docs/agents/copperknot/`
- the most recent dated queue in `docs/agents/copperknot/`
- the most recent dated dispatch log in `docs/records/artifacts/agent/copperknot/reports/`

When a new production window begins, create the new dated package files first, then treat those files as the authoritative current-window surfaces.

Mark the previous dated plan or queue files as `superseded` at the top and exclude them from routine load so old window files do not compete with live launch truth.

## Standard Run Types

### 1. Catalog audit run

Use when the goal is to compare the current repo against the current catalog snapshot.

### 2. Rerating run

Use when enough new repo evidence exists to justify revisiting one or more system scores.

### 3. Handoff generation run

Use when catalog data should be turned into copy/paste-ready execution packets for other agents.

### 3a. Dispatch-ready audit output run

Use when a meaningful audit should end with an ordered next-work list and paste-ready prompts for external agents.

### 4. Report intake run

Use when one or more external agent closeout reports have landed and need to be audited against repo truth.

### 5. Queue maintenance run

Use when active lane status, dispatch order, or the next-ready set needs to change.

## Required Workflow

### Step 1. Start with repo rules

- Follow the root `AGENTS.md` startup contract.
- Load the Copperknot contract, memory, and current operating package.
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
6. dispatch-ready output
7. operator brief

### Step 3. Freeze the audit target

Before rerating, define the evidence snapshot:

- current worktree at a declared checkpoint, or
- current branch at a known commit boundary, or
- post-batch state after active lanes finish

Do not rerate against a moving target if active edits are still landing in the same system boundary.

For full repo audits, explicitly record all of these:

- active branch
- commit anchor
- whether the worktree is included
- whether the pass is production-only, local-only, or mixed evidence

### Step 3a. Classify evidence quality

Before updating queue order or score posture, classify the evidence:

- `production durable`
  - committed repo truth on the active release path
  - retained production reports with concrete route/runtime evidence
- `repo durable`
  - current code or docs in the repo or worktree that materially change likely next work
- `local follow-up`
  - local-only reports or local dev findings that are useful but not launch truth by themselves
- `incomplete artifact`
  - template shells, partial stubs, or unfilled reports that should not drive queue or score movement

Use these rules:

- `production durable` can move launch-state fields and queue order.
- `repo durable` can move packaging, queue readiness, and follow-up scope.
- `repo durable` alone should not lift a score unless validation and evidence anchors are strong enough.
- `local follow-up` can inform future lanes, but should not become production blocker truth without corroboration.
- `incomplete artifact` should be ignored for rating and queue decisions until it becomes real evidence.

### Step 4. Reconstruct the baseline

For each system in scope, identify:

- previous catalog score
- previous confidence or ship-floor interpretation
- active known issues
- current queue priority
- whether the row is active, ready, held, queue-only, or reviewed-complete
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
- relevant current worktree diffs when the audit target includes the worktree

Do not treat agent claims or report prose as sufficient proof by themselves.

### Step 6. Compare against rerating gates

Use `docs/agents/copperknot/system-score-criteria.md` plus the ship-bar doctrine to decide:

- whether the score should move
- whether confidence should move
- whether the system is now at or above ship floor
- whether new follow-up scope is required instead of a score lift

For any score movement proposal, name all of these explicitly:

- previous score
- proposed new score
- score delta:
  - `+1`
  - `0`
  - `-1`
- exact evidence anchors:
  - report path
  - commit id or declared worktree checkpoint
  - validation commands
  - blocker or incident refs when relevant

Do not move a score upward unless those anchors are present.
Do not move a score downward on vague concern alone. Name the concrete failure evidence.

### Step 7. Update the catalog surfaces

Only after the audit, update the relevant surfaces:

- `docs/systems/catalog.md` when a score or rationale changes
- queue docs when priority changes
- dispatch log when lane state changes
- operating package when the active lane snapshot changes
- dated reports when the audit itself should be retained
- superseded dated queue/plan files when a production window rolls forward

### Step 8. Generate handoffs carefully

When creating new handoffs:

- assign one lane per bounded system problem
- define a narrow owned write surface
- name explicit avoid surfaces when conflict risk exists
- include stop conditions
- include a mandatory endgame that requires validation, self-audit, and in-scope follow-on cleanup before stop
- include required report path and report filename pattern
- avoid overlapping file ownership across concurrently active lanes

### Step 9. Produce dispatch-ready audit output

After a meaningful audit, produce an ordered next-work list using:

- `docs/agents/copperknot/dispatch-ready-audit-output-template.md`

The output should:

- run from highest priority to lowest priority
- include only the next meaningful lanes, not every system row
- include the handoff path for each item
- include a paste-ready prompt block for the receiving agent

If a high-priority queue item is still `queue-only` and lacks a handoff, do one of these before closing the run:

- create the missing handoff, or
- explicitly record that the missing handoff is the next Copperknot action

Keep reviewed-complete lanes out of the exact next-work list unless they have actually reopened. Track them separately as follow-up or rerate candidates so the queue stays actionable.

### Step 10. Ingest external lane reports

When an execution lane ends:

- confirm the closeout report exists in `external-lane-closeouts/`
- if the closeout report is missing, reconstruct the lane from repo evidence before rerating:
  - inspect `git diff`, touched files, and validation evidence
  - use the source handoff packet as the intended-scope reference
  - create a Copperknot review note or dated report if the missing closeout increases uncertainty
- inspect the reported files and claims in the repo
- run the relevant validation
- decide whether the result is:
  - complete and score-lifting
  - complete but unrated pending broader review
  - partial with follow-up required
  - blocked and queue-affecting

### Step 11. Validate and self-audit

Before ending the run:

- run `npm -C frontend run docs:check` for catalog/doc changes
- run any targeted checks required by the systems touched
- self-audit for index drift, status drift, or inconsistent lane wording

### Step 12. Produce user operator brief

After every meaningful run, create one ADHD-friendly operator brief using:

- `docs/agents/copperknot/operator-brief-template.md`

The brief should:

- summarize what changed in scan-friendly form
- list only the currently actionable or still-open handoff lanes with clear status
- tell the user the exact next paste action
- clearly separate only live action states such as:
  - already running
  - ready to paste now
  - ready but hold

Do not use the operator brief as a history surface. Keep these out of the brief unless they have reopened:

- reviewed-complete lanes
- closed closeout-intake items
- at-floor systems with no current action
- archived dispatch history

Prefer one dated retained report per run over scattered ad hoc summaries.

Always create a companion HTML render next to the Markdown brief so the summary can be opened as a formatted artifact instead of raw Markdown source.

Treat the HTML file as the canonical user-facing operator brief.
Treat the Markdown file as source-only backing material for repo traceability.

At closeout, surface both paths to the user:

- the HTML rendered brief
- the Markdown source brief

Launch-ready checklists may also keep a sibling HTML render when Copperknot is maintaining a user-facing launch snapshot.

All other Copperknot artifacts should remain Markdown-only unless the user explicitly asks for an additional HTML version.

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
- mandatory endgame
- done state
- send-to-catalog rule

## Maintenance And Pruning Rule

Trim or demote anything that degrades current launch decisions:

- superseded dated plan/queue files that still read like live authority
- duplicate current-state memory that competes with queue, dispatch log, or scoreboard
- incomplete template reports that look like finished evidence
- historical planning notes that remain on the default reading path after the lane is closed

Prefer demotion and clear `superseded` labels over deletion when historical traceability still matters.
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

Before that stop is considered complete, the handoff should require the receiving agent to:

- audit the touched repo area for adjacent regressions, incomplete acceptance criteria, and obvious missed cleanup
- fix high-value in-scope issues discovered during that self-audit
- explicitly name what was left unresolved because it was out of scope, blocked, or too architectural for the lane

## External Lane Report Standard

Closeout reports from execution agents belong in:

- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`

Filename pattern:

- `YYYY-MM-DD-<lane-id>-closeout.md`

Each report should include:

- lane id
- source handoff path
- execution status
- systems touched
- files changed
- summary of what changed
- acceptance criteria reached
- evidence snapshot
- validation run
- validation evidence
- blockers encountered
- residual risk
- recommended next step for Copperknot review

## Review-Basis Standard

When updating `Review basis` in the catalog, prefer this structure:

- baseline:
  - prior retained report or kickoff packet
- refresh or rerate:
  - exact dated report path
- code snapshot:
  - commit id when available
  - or a declared worktree checkpoint when uncommitted
- validation:
  - short command list or test reference

Do not leave `Review basis` as a vague label when a stronger evidence anchor exists.

## Catalog Tool Health Review

At least once per active production week, review whether the catalog tool itself is still working well enough to trust.

Check at minimum:

- closeout compliance:
  - how many finished lanes produced a closeout report
- evidence quality:
  - how many rerating decisions had exact report, snapshot, and validation anchors
- rerating lead time:
  - how long completed lanes sat before Copperknot review
- launch-state freshness:
  - whether scoreboard, queue, dispatch log, and catalog launch fields still match
- queue usefulness:
  - whether recent work validated the current next-lane ordering or exposed reprioritization pressure

Record the result in the standing Copperknot health-metrics surface.

## Measurement And Learning Update Rule

When a run materially changes launch-state interpretation, score posture, or queue confidence, update the retained learning logs:

- `docs/records/artifacts/agent/copperknot/metrics/launch-metrics-log.md`
- `docs/records/artifacts/agent/copperknot/metrics/score-movement-log.md`
- `docs/records/artifacts/agent/copperknot/metrics/decision-outcome-log.md`

Use them to record:

- what changed
- what stayed intentionally unchanged
- whether a queue decision looks stronger or weaker in hindsight

During an active production window, also:

- add or update one retained weekly review entry
- update lane cycle-time entries for lanes whose status changed materially
- record misses when the process or the earlier judgment was meaningfully weak
- backtest meaningful production findings against prior catalog beliefs

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

- Store authoritative agent instructions under `docs/agents/copperknot/`.
- Store retained reports and evidence under `docs/records/artifacts/agent/copperknot/`.
- Keep inbound external lane reports separate from Copperknot-authored reports.
- Use dated filenames for reports and dated or lane-specific filenames for handoffs.
- Update local indexes when new durable agent docs or report folders are added.

## Decision Rules

- If the score and the ship bar disagree, the ship bar wins.
- If a system improved but remains below ship floor, prioritize follow-up scope over celebration.
- If evidence is mixed, preserve the lower score until the stronger claim is proven.
- If multiple agents touch the same system boundary, rerate from current repo truth, not from report count.

## Output Rule

The Copperknot should leave each meaningful run with at least one of these outcomes:

- updated catalog status
- updated queue status
- new or refined handoff packet
- audited closeout decision on an external lane
- dated report explaining why no score change was justified
