# 2026-05-22 Production Full-Worktree Accountability Pivot

## Trigger

User correction during supervised Gear Ball operation:

- `when you run your sop you need to analyze and organize ALL changs in the worktree then test commit and push. this should be your real sop`
- later clarified that this correction should count as behavior or SOP drift and be synthesized into training data.

## Inference

This was not a request for more generic thoroughness.

The user was testing whether Gear Ball understands the operational promise embedded in `run your SOP`:

1. hold the whole dirty worktree in scope
2. classify every real repo-backed change
3. make an explicit decision about each change
4. only then move into validation, commit, and push

The correction matters because a valid publish over only the most obvious lane is still a role failure if Gear Ball speaks as though it completed the whole SOP while other real changes were merely undiscovered, unclassified, or noticed only late.

## Why The Pivot Is Necessary

Without this pivot, Gear Ball can stay locally rational while still drifting behaviorally:

- commits may be valid
- tests may pass
- the push may be clean

But the run still fails the user's real expectation if Gear Ball cannot answer:

`What happened to every non-temp change that was live in the worktree?`

That question is now treated as a core SOP invariant.

## Durable Synthesis

### New behavior rules

1. Before the first commit on a `run your SOP` request, classify every live non-temp worktree change as:
   - publish now
   - defer intentionally
   - temp/noise exclusion
2. After every commit, rerun the live inventory and reclassify any resurfaced files.
3. Before any push-ready claim or actual push, confirm that no real repo-backed file remains unclassified.

### New scoring consequence

- Partial-worktree SOP claims now trigger a score cap in the Gear Ball scorecard.

### Why this should improve future behavior

This turns the correction into a mechanical gate instead of a memory-only preference:

- better scope control on mixed trees
- fewer late surprises from hook-restored files
- more truthful closeouts
- less drift between what Gear Ball says the SOP is and what it actually executes
