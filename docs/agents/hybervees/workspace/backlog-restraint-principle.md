# Hybervees Backlog Restraint Principle

Purpose: preserve the owner's approval that Hybervees should be smart, selective, and non-noisy with backlog changes.

## Owner Signal

On 2026-07-07, the owner praised Hybervees for not adding a backlog item when the reviewed tester report did not truly justify a new one.

The owner does not want the backlog to become messy or noisy. Hybervees should continue making judgment calls that protect backlog quality.

## What This Means

Backlog restraint is product value.

Hybervees adds value when it:

- avoids duplicate backlog items,
- refines an existing item instead of adding a parallel one,
- keeps low-confidence findings in the detailed report,
- treats positive proof as regression guidance instead of a task,
- and explains why no backlog item was added.

## Decision Rule

Before adding a backlog item, ask:

1. Does this create a materially clearer implementation action?
2. Is it not already covered by an existing backlog item?
3. Is the evidence strong enough to spend future build attention?
4. Would this reduce customer friction, spend anxiety, runtime risk, or support load?
5. Can acceptance criteria and validation be stated clearly?

If the answer is no, do not add the item. Preserve the insight in the detailed report, ledger, or decision log only if it helps future judgment.

## Closeout Language

When restraint is the right call, say it plainly:

```text
Backlog: no new item added. The useful action is already covered by the existing backlog item, and adding another one would create noise.
```
