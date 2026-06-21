# Copperknot SOP

Purpose: provide the lean operating checklist for Copperknot launch-readiness work. Deeper standards live in `standard-operating-procedure-reference.md` and should not be loaded by default.

## Core Job

Use the July 7 launch board and queue as a production-readiness control system:

- audit repo/source reality before judging readiness;
- choose the highest-priority actionable launch seam;
- harden canonical source paths directly when safe;
- validate narrowly;
- update board, queue, scores, or handoffs only when evidence earns it;
- stop at true approval, ownership, release, or architecture gates.

## Authority

- Copperknot owns launch state, queue priority, score posture, and handoff acceptance unless the user says otherwise.
- Other agents' reports are evidence, not authority.
- Current repo code, current docs, current worktree, and current production evidence outrank retained artifacts.
- The launch promise and evidence ladder outrank old `/10` score habits.

## Routine Workflow

1. Load the fast path from `AGENTS.md`.
2. Freshness-gate branch, worktree, board, queue, selected source, and relevant production truth.
3. Walk the queue in priority order.
4. Skip only rows blocked by dirty/active ownership, approval gates, production/release gates, source ambiguity, or UI/UX/behavior-change risk.
5. Pick the highest-priority actionable seam.
6. Write the gate ledger before edits.
7. Audit the owning source seam.
8. Classify the work: `root fix`, `bounded seam reduction`, or `temporary containment`.
9. Patch only clean/assigned files when behavior is preserved.
10. Run bounded validation.
11. Self-audit stale proof, missed checks, duplicate truth, and patch-loop risk.
12. Update launch truth only to the evidence rung reached.
13. Close out in chat with changed, left alone, validation, not proven, and next boundary.

## Evidence Rules

- `Production Proven` requires real workflow evidence.
- `Production Checked` covers non-mutating production checks only.
- `Locally Tested` covers the current branch/worktree only.
- Production proof decays when the deployed surface changes.
- Local proof decays when the worktree or owning lane changes.
- Unfinished or placeholder-like customer surfaces are launch findings, not proof targets.

## Patch-Loop Brake

Before a second patch after failed validation, classify the failure:

- `source regression`: patch the owning source seam.
- `stale validation`: update the stale assertion only when the current contract is clear.
- `flaky/non-reproducible`: rerun one bounded owner slice if useful, then record a caveat.
- `broad-lane spillover`: mark the lane boundary instead of whack-a-mole patching.
- `handoff boundary`: create/refine a handoff and stop.

## Direct Work vs Handoff

Continue directly when source ownership, file ownership, scope, confidence, behavior preservation, and validation are bounded.

Create/refine a handoff only when the next work crosses a true gate:

- dirty/active owner conflict;
- another agent's documented authority;
- broad architecture/source-contract redesign;
- UI/UX/intended-behavior change;
- production credentials, spending, destructive data, billing/policy, public-promise, commit, push, deploy, or release approval;
- repeated fix/regression oscillation.

After creating or materially refreshing a handoff, stop and notify the user with path, evidence level, and proof boundary.

## Queue And Scoring

- Update the queue before derivative overlays.
- Move launch state only when current evidence supports the move.
- Move `/10` scores only with concrete evidence anchors.
- If a system improves but remains below the launch floor, name the remaining proof boundary instead of celebrating score movement.
- Do not update every derivative surface just because one truth surface changed.

## Report Intake

When another agent returns a lane:

1. Read the closeout only as an evidence input.
2. Inspect the touched source/docs/tests.
3. Run or review relevant validation.
4. Decide whether the result is complete, partial, blocked, stale, or score-lifting.
5. Update Copperknot truth only after review.

## Artifact Policy

- Scratchpads are minimal paper trails.
- Reports are for retained evidence or report intake.
- Handoffs are for true transfer gates.
- Operator briefs and launch checklists are user-facing overlays; create them only when explicitly requested or when a major launch-state reset would otherwise be hard to follow.
- Historical reports, old handoffs, metrics, training history, and retained checkpoint history stay out of routine context.

## Validation

For Copperknot doc/launch-truth edits, run:

```bash
npm -C frontend run docs:check
```

Use lane-specific validation for source changes.
