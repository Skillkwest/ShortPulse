# D-Bug Scorecard Operations

Purpose: define how D-Bug scores checkpoint performance, captures training evidence, freezes baselines, and turns repeated weak spots into workflow improvements.

## Operating Goal

Use the scorecard as a real quality-control system for D-Bug, not as decorative self-commentary.

The scorecard exists to make D-Bug:

- compare checkpoints consistently,
- detect drift,
- record repeated strengths and weaknesses,
- and improve tooling or workflow when low-score patterns repeat.

## Canonical Surfaces

- `docs/records/artifacts/agent/d-bug/performance-scorecard.md`
- `docs/records/artifacts/agent/d-bug/checkpoint-review-template.md`
- `docs/records/artifacts/agent/d-bug/overall-training-log.md`
- `docs/records/artifacts/agent/d-bug/training-history.md`
- `scripts/d_bug_scorecard.mjs`

## Scoring Rule

- Score every meaningful checkpoint, not every trivial action.
- Score checkpoints against their actual status:
  - `open`
  - `blocked`
  - `handed_off`
  - `done`
- Derive the weighted overall score with:
  - `node scripts/d_bug_scorecard.mjs --scope <n> --evidence <n> --validation <n> --stop <n> --communication <n> --learning <n>`
- Do not hand-calculate the overall score when the helper script can do it.
- If a critical failure override is triggered, the checkpoint is failed regardless of weighted score.

## Required Categories

Every scored checkpoint must record:

- scope control
- evidence quality
- validation discipline
- communication clarity
- stop-condition discipline
- learning capture

Also record:

- weighted overall score
- score band
- whether a critical failure override was triggered
- override reason when triggered

Do not record a freehand overall score that differs from the helper-script output.

## Required Checkpoint Review

Use `checkpoint-review-template.md`.

Every meaningful checkpoint should record:

- what was done
- how it was done
- what went right
- what went wrong
- the score breakdown
- the weakest category
- one improvement action
- whether the improvement belongs in training history

## Training-Evidence Split

Use the retained surfaces this way:

- active report checkpoint reviews:
  - execution evidence for the current lane
- `training-history.md`:
  - dated durable workflow changes, scoring changes, or learned behaviors
- `overall-training-log.md`:
  - repeated patterns across multiple lanes

The retained artifact area stores the evidence.
This SOP remains the standing authority for how scoring and training capture should work.

## Baseline Rule

- Keep the baseline provisional until at least 3 real checkpoint-scored lanes are complete.
- Use one final checkpoint summary score per lane for the first numeric baseline.
- Average those lane-final weighted scores to freeze the first numeric baseline.
- Do not rewrite the frozen baseline later; append comparison notes instead.

## Low-Score Response Rule

When a checkpoint score falls below `8.0`:

- record one explicit improvement action
- explain the weakest category
- decide whether a helper, checklist rule, or SOP change is warranted

When a checkpoint falls below `6.0` or triggers a critical failure override:

- treat the checkpoint as failed regardless of weighted score
- record the failure clearly
- add a durable training-history note unless the issue is obviously one-off noise

## Drift Rule

When the same weak category repeats across multiple runs:

- add it to `overall-training-log.md`
- decide whether the fix is:
  - a workflow change,
  - a script/tool,
  - a contract change,
  - or a narrower scope boundary

## Improvement Rule

Prefer the smallest durable fix for repeated scoring weakness:

- script/tool for mechanical repetition
- SOP change for repeated process ambiguity
- contract change for repeated ownership ambiguity
- template change for repeated reporting ambiguity

## Rewrite Trigger

Rewrite this SOP when any of these becomes true:

- a recurring weak score category is caused by the scoring workflow itself
- the helper script and the written rubric diverge
- checkpoint reviewers are repeatedly unsure how to score `open`, `blocked`, `handed_off`, or `done`
- the baseline rule changes
