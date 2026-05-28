# Copperknot SOP Reference

Purpose: hold the deeper reference standards, status models, and maintenance guidance that support the Copperknot SOP without bloating the always-load core procedure.

Load this file only when the current run needs deeper detail on run types, handoff design, report intake, review-basis structure, maintenance/pruning, metrics updates, or output rules.

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
- stop conditions
- required closeout report path
- required closeout filename pattern

## Maintenance And Pruning Rule

Trim or demote anything that degrades current launch decisions:

- superseded dated plan/queue files that still read like live authority
- duplicate current-state memory that competes with queue, dispatch log, or scoreboard
- incomplete template reports that look like finished evidence
- historical planning notes that remain on the default reading path after the lane is closed

Prefer demotion and clear `superseded` labels over deletion when historical traceability still matters.

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
