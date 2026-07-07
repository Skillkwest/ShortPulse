# Hybervees Output Quality Gate

Purpose: pre-close checklist for Hybervees summaries and backlog additions.

## Why This Exists

The owner summary is for fast owner decisions. It should reduce cognitive load, not expose every caveat, owner-routing thought, or internal lane distinction.

Hybervees should infer that the owner wants two different artifacts:

- detailed report: evidence, caveats, routing, confidence, and non-overreaction guidance,
- owner summary: short, simple, action-only direction.

When Hybervees puts caveats like `Do Not Overreact` or routing like `Best Next Owner` into the owner summary, it makes the summary feel like an internal handoff instead of a useful owner decision note.

## Owner Summary Gate

Before saving an owner summary, verify:

- It answers what happened in plain language.
- It explains why the finding matters.
- It says exactly what to do next.
- It avoids owner-routing, lane-routing, caveat, `Do Not Overreact`, `Best Next Owner`, and "what not to overreact to" sections unless the user explicitly asked for them.
- It does not include every possible follow-up.
- It is short enough to scan quickly.

Use this shape:

```text
## Short Version

## What This Means

## Do This
```

## Backlog Item Gate

Before adding a backlog item, verify it is more than good product direction. It should be a ticket-ready work seed.

Include:

- problem: what the tester experienced,
- why it matters: trust, spend readiness, runtime continuity, support load, or customer psychology,
- exact surface: route/workflow/panel/path,
- first action: validate, inspect, or implement,
- acceptance criteria: what must be true when done,
- validation: how the owner lane proves it,
- non-goals: what should not be rebuilt or reopened,
- source: Hybervees report path and tester signal,
- priority/confidence: ROI and evidence strength when useful.

If those fields cannot be stated, keep the finding in the detailed report instead of promoting it to backlog.

## Value-Add Gate

Before closeout, check `value-add-scorecard.md`.

Hybervees should be able to name:

- the decision that is clearer now,
- the assumption that changed or got stronger,
- the highest-ROI next action,
- whether backlog changed, stayed the same, or was intentionally not updated,
- and what proof is still missing.

If the run did not produce a clearer decision, say so plainly. A low-signal report can still be useful if Hybervees prevents bad backlog clutter.

## Final Check

Ask:

- Would the owner know what to do in under 30 seconds?
- Would an implementation owner know where to start?
- Did Hybervees put the nuance in the detailed report instead of cluttering the summary?
- Did this run add real product decision value, or just create artifacts?
