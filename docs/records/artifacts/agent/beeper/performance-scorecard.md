# Beeper Performance Scorecard

Purpose: define a stable scoring system for Beeper's supervised testing performance so each substantive run can be rated consistently out of 10.

This file governs the `Run Score`, not the whole testing campaign. Campaign-level effectiveness is tracked separately in `campaign-scorecard.md`.

This score is meant to be earned over time through better real-user coverage, cleaner evidence, stronger handoffs, stronger continuity proof, and fewer repeated process mistakes.

## Audit Of The Old System

The earlier version was useful, but not yet a full training tool.

Main weaknesses:

- it measured quality, but did not strongly force behavior change
- it had no hard caps against score inflation from good paperwork over shallow app work
- it did not clearly separate training value from documentation volume
- it did not require a next-run drill tied to the weakest category
- it did not explicitly punish repeated mistakes enough

This version fixes that by adding score caps, training gates, a mandatory remediation loop, and a clearer ROI bias toward route-bundle workflow evidence over artifact volume.

## Scoring Method

Score each category from `0.0` to the category maximum.

Total possible: `10.0`

This is a weighted behavior score, not a documentation score.
High paperwork quality cannot compensate for weak real-user testing depth.

## Categories

### 1. Real-user fidelity (`2.0`)

- `2.0`: followed believable user flow, avoided debugger shortcuts, and tested the experience the way a real user would before applying alpha-tester pressure.
- `1.0`: mixed real-user behavior with too many artificial shortcuts.
- `0.0`: mostly debugger behavior, weak UX evidence.

### 2. Coverage expansion (`1.5`)

- `1.5`: expanded into a meaningfully new route, control set, or create/edit/save action.
- `0.75`: touched something new but shallowly.
- `0.0`: mostly repeated already-covered work without new evidence.

Coverage score should be lowered when a run is over-fragmented into tiny adjacent checks that could have been one coherent route bundle.
Coverage score should also be lowered when the run stops before an obvious continuity or adjacent workflow truth that was reasonably available.

### 3. Evidence quality (`2.0`)

- `2.0`: findings backed by clear repro, usable screenshots or packet data, trustworthy captures, and a clear continuity result when continuity was in scope.
- `1.0`: evidence exists but is incomplete, noisy, or partially ambiguous.
- `0.0`: weak evidence or evidence not preserved.

### 4. Issue identification and triage (`1.5`)

- `1.5`: correctly separated blockers, functional issues, UI/UX notes, and positives, with good severity judgment.
- `0.75`: mostly correct classification with some ambiguity.
- `0.0`: poor classification or unreliable severity calls.

Trust-breaking user moments should be weighted more heavily than minor technical oddities when judging triage quality.

### 5. Code/handoff usefulness (`1.5`)

- `1.5`: narrowed likely code surfaces and produced a useful handoff when needed.
- `0.75`: some technical narrowing, but still broad.
- `0.0`: no meaningful debugging handoff value.

### 6. Training/logging discipline (`1.0`)

- `1.0`: notes, retained report, summary, coverage update, and training updates all completed cleanly.
- `0.5`: one required artifact missing or weak.
- `0.0`: multiple required artifacts missing.

### 7. Operational discipline (`0.5`)

- `0.5`: followed startup contract, used the right tools, avoided unsafe assumptions, and corrected mistakes quickly.
- `0.25`: minor process drift.
- `0.0`: material process miss.

## Hard Training Gates

These gates stop Beeper from earning an inflated score when the app work itself was shallow.

### Gate 1. No deep workflow, no elite score

If the run does not validate at least one meaningful end-to-end user action such as create, edit, save, reopen, logout, or retest, the total score is capped at `8.4`.

### Gate 1B. No continuity proof on a continuity-ready lane

If the lane clearly supported a realistic continuity or persistence check and the run skipped it without a stated reason, the total score is capped at `8.8`.

### Gate 2. Weak evidence cap

If the evidence is clipped, ambiguous, missing, or too noisy to trust, the total score is capped at `7.9`.

### Gate 3. Repeated-mistake cap

If the run repeats a known avoidable mistake without a good reason, the total score is capped at `7.4`.

Examples:

- judging dense UI from a clipped viewport after the wide-browser rule already exists
- repeating a covered shallow lane without a stated reason
- producing a handoff without enough repro or evidence after that gap was already trained

### Gate 4. Paperwork cannot carry product depth

Training/logging discipline plus operational discipline cannot together outweigh weak product work.

If `real-user fidelity + coverage expansion + evidence quality` totals below `3.5`, the final run score cannot exceed `7.9`.

### Gate 5. No ROI movement cap

If a run does not do at least one of the following, the total score is capped at `8.6`:

- validates one meaningful user workflow,
- finds one believable new product issue or trust-breaking UX problem,
- or materially expands low-coverage route breadth.

This prevents neat artifact production from reading as a strong run when product uncertainty barely moved.

## Confidence Tag

Each score should also carry a confidence tag:

- `high`: evidence is strong and the score reflects the real work well
- `medium`: one part of the score is somewhat judgmental or incomplete
- `low`: the run was too partial or noisy for a stable score

## Interpretation

- `9.0 - 10.0`: strong supervised run, high reuse value
- `8.0 - 8.9`: good run, useful but with one clear improvement lane
- `7.0 - 7.9`: mixed run, valuable but inefficient or incomplete
- `below 7.0`: weak run, training correction needed before repeating the pattern

## Earning Rule

Beeper does not "get" a permanent score from one good run.

Beeper earns a stronger operating score by:

- raising the average quality of substantive runs,
- validating deeper end-to-end user workflows,
- reducing repeated mistakes,
- increasing true route/control/action coverage,
- and turning misses into durable process improvements.

The operating score should be judged from:

- the most recent substantive run scores,
- the current average of recent runs,
- and whether the weakest category is actually improving.

The most important question is not "what is the number?"
It is:

- are deeper workflows getting validated,
- are repeated mistakes decreasing,
- and is the weakest category moving upward over time?

## Promotion Thresholds

- `9.0+` average across the latest `5` substantive runs: Beeper is operating strongly
- `8.0+` average across the latest `5` substantive runs: Beeper is useful but still has one or two systemic weak spots
- below `8.0` average across the latest `5` substantive runs: training is still paying off, but the workflow needs correction before scale

## Ledger Rule

Each substantive run should append a row to `docs/records/artifacts/agent/beeper/performance-ledger.md` with:

- the run name,
- the total score,
- the score breakdown,
- the confidence tag,
- any hard gate that was triggered,
- the weakest category,
- and the smallest improvement that would raise the next run

## Training Loop

For each substantive run:

1. Score the run.
2. Name the weakest category.
3. Write one specific next-run drill that would raise that category.
4. If a hard gate fired, treat that as the main training failure, not just the raw score.
5. On the next run, prefer the drill over convenience unless the user redirects the task.

## Next-Run Drill Rules

A valid drill must be:

- mechanical, not vague
- small enough to execute in the next substantive run
- tied to one weakest category
- observable in the resulting evidence

Good drills:

- validate one full logout -> sign-back-in loop
- start AI Studio runs in a wide viewport before first capture
- open an existing project from the projects overlay and confirm persistence after reload
- validate one create/edit/save path and then prove it survives reload or reopen

Bad drills:

- "be better"
- "test more"
- "improve quality"

## Improvement Rule

When a substantive run scores below `9.0`, Beeper should record:

- the weakest category,
- the smallest mechanical improvement that would raise it,
- and whether the fix belongs in a helper, checklist, SOP, or training note.

When the same weakest category appears in `3` consecutive substantive runs, Beeper should escalate from note-taking to a concrete system fix:

- helper script
- checklist change
- SOP change
- or narrower lane selection on the next run

## ROI Rule

The score system exists to improve tester impact, not to reward artifact neatness.

High-ROI runs usually:

- remove meaningful user uncertainty,
- validate one believable workflow end to end,
- prove whether the workflow survives continuity pressure,
- or isolate a trust-breaking product issue with direct evidence.

Low-ROI runs usually:

- over-focus on process-only maintenance,
- split one coherent route into too many tiny checkpoints,
- or produce clean paperwork without moving product understanding very far.

## Relationship To Campaign Scoring

Use this run score to judge checkpoint quality.

Do not use it alone to judge Beeper's whole effectiveness as a tester.

Campaign-level judgment should also consult:

- `docs/records/artifacts/agent/beeper/campaign-scorecard.md`
- `beeper/action-coverage/master-coverage-log.md`
- outstanding D-Bug handoffs and retest debt
