# Bopper Performance Scorecard

Purpose: define a stable scoring system for Bopper's supervised average-user testing performance so each substantive run can be rated consistently out of 10.

This file governs the `Run Score`, not the whole testing campaign. Campaign-level effectiveness is tracked separately in `campaign-scorecard.md`.

This score is meant to be earned over time through better average-user fidelity, clearer confusion capture, stronger handoffs, and fewer repeated smart-tester mistakes.

## Audit Of The Starting System

The first scaffold was useful, but too thin for real training.

Main weaknesses:

- it did not strongly separate average-user fidelity from generic QA behavior
- it did not punish smart-tester drift enough
- it did not require a next-run drill tied to the weakest category
- it did not clearly prevent paperwork from compensating for weak naive-user truth

This version fixes that by adding score caps, training gates, a remediation loop, and a stronger ROI bias toward trust-breaking user moments over neat artifact volume.

## Scoring Method

Score each category from `0.0` to the category maximum.

Total possible: `10.0`

This is a weighted behavior score, not a documentation score.
High paperwork quality cannot compensate for weak average-user testing depth.

## Categories

### 1. Naive-user fidelity (`2.0`)

- `2.0`: behaved like a believable average user and avoided smart-tester shortcuts.
- `1.0`: mixed naive-user behavior with too much tester intelligence.
- `0.0`: mostly tester behavior.

### 2. Coverage expansion (`1.5`)

- `1.5`: expanded into a meaningfully new first-impression, obvious-control, or abandonment surface.
- `0.75`: touched something new but shallowly.
- `0.0`: mostly repeated already-covered work without new signal.

Coverage score should be lowered when a run is over-fragmented into tiny adjacent checks that could have been one coherent average-user route bundle.

### 3. Evidence quality (`2.0`)

- `2.0`: findings backed by clear repro, usable screenshots or packet data, and trustworthy captures.
- `1.0`: evidence exists but is incomplete, noisy, or partially ambiguous.
- `0.0`: weak evidence or evidence not preserved.

### 4. Confusion and abandonment capture (`1.5`)

- `1.5`: clearly documented what was misunderstood, ignored, retried, or abandoned and why.
- `0.75`: some confusion captured but incompletely.
- `0.0`: weak confusion or abandonment signal.

Trust-breaking average-user moments should be weighted more heavily than minor technical oddities when judging this category.

### 5. Issue / handoff usefulness (`1.5`)

- `1.5`: surfaced a useful user-facing issue and narrowed the next owner well.
- `0.75`: useful but still broad.
- `0.0`: little downstream value.

### 6. Training/logging discipline (`1.0`)

- `1.0`: notes, retained report, summary, coverage update, and training updates all completed cleanly.
- `0.5`: one required artifact missing or weak.
- `0.0`: multiple required artifacts missing.

### 7. Operational discipline (`0.5`)

- `0.5`: followed startup contract, used the right tools, avoided unsafe assumptions, and corrected mistakes quickly.
- `0.25`: minor process drift.
- `0.0`: material process miss.

## Hard Training Gates

### Gate 1. No believable user-path, no elite score

If the run does not test at least one believable visible-entry workflow such as sign-in, first dashboard click, first project entry, first browse, or one safe save path, the total score is capped at `8.4`.

### Gate 2. Weak evidence cap

If the evidence is clipped, ambiguous, missing, or too noisy to trust, the total score is capped at `7.9`.

### Gate 3. Smart-tester drift cap

If the run repeats a known avoidable average-user persona mistake without good reason, the total score is capped at `7.4`.

Examples:

- using deep links when a visible entry path exists
- rescuing the flow with hidden product knowledge
- retrying far beyond what an average user plausibly would
- judging dense UI from a clipped viewport after the wide-browser rule already exists

### Gate 4. Paperwork cannot carry product depth

Training/logging discipline plus operational discipline cannot together outweigh weak product work.

If `naive-user fidelity + coverage expansion + evidence quality` totals below `3.5`, the final run score cannot exceed `7.9`.

### Gate 5. No ROI movement cap

If a run does not do at least one of the following, the total score is capped at `8.6`:

- validates one meaningful naive-user success path,
- finds one believable new trust-breaking average-user issue,
- or materially expands low-coverage route breadth.

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

Bopper does not get a permanent score from one good run.

Bopper earns a stronger operating score by:

- raising the average quality of substantive runs,
- validating deeper visible-entry user workflows,
- reducing smart-tester drift,
- increasing true route/control/action coverage,
- and turning misses into durable process improvements.

The operating score should be judged from:

- the most recent substantive run scores,
- the current average of recent runs,
- and whether the weakest category is actually improving.

The most important question is not "what is the number?"
It is:

- are believable average-user paths getting validated,
- are repeated smart-tester mistakes decreasing,
- and is the weakest category moving upward over time?

## Promotion Thresholds

- `9.0+` average across the latest `5` substantive runs: Bopper is operating strongly
- `8.0+` average across the latest `5` substantive runs: Bopper is useful but still has one or two systemic weak spots
- below `8.0` average across the latest `5` substantive runs: training is still paying off, but the workflow needs correction before scale

## Ledger Rule

Each substantive run should append a row to `docs/records/artifacts/agent/bopper/performance-ledger.md` with:

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

- validate one full visible logout -> sign-back-in loop as an average user
- start dense desktop runs wide before the first capture
- click the most obvious dashboard CTA and stop once confusion becomes believable

Bad drills:

- "be better"
- "test more"
- "improve quality"

## Improvement Rule

When a substantive run scores below `9.0`, Bopper should record:

- the weakest category,
- the smallest mechanical improvement that would raise it,
- and whether the fix belongs in a helper, checklist, SOP, or training note.

When the same weakest category appears in `3` consecutive substantive runs, Bopper should escalate from note-taking to a concrete system fix:

- helper script
- checklist change
- SOP change
- or narrower lane selection on the next run

## ROI Rule

The score system exists to improve tester impact, not to reward artifact neatness.

High-ROI runs usually:

- remove meaningful average-user uncertainty,
- validate one believable visible-entry workflow end to end,
- or isolate a trust-breaking product issue with direct evidence.

Low-ROI runs usually:

- over-focus on process-only maintenance,
- split one coherent route into too many tiny checkpoints,
- or produce clean paperwork without moving average-user understanding very far.

## Relationship To Campaign Scoring

Use this run score to judge checkpoint quality.

Do not use it alone to judge Bopper's whole effectiveness as a tester.

Campaign-level judgment should also consult:

- `docs/records/artifacts/agent/bopper/campaign-scorecard.md`
- `bopper/action-coverage/master-coverage-log.md`
- `bopper/route-success-map.md`
- `docs/records/artifacts/agent/bopper/retest-debt.md`
