# Solve Current Backlog Item Prompt

Use this prompt when an agent should solve exactly one backlog item: the current backlog item being discussed in the active conversation. This is not for broad issue-list sweeps.

## Prompt

```text
Pursue the goal of solving the current backlog item in this conversation. First, identify the backlog item, the source of truth for the item, the active owner/lane, approved scope, protected UI/UX/behavior contracts, validation requirements, and stop conditions. If the current backlog item is ambiguous, stale, missing, outside your lane, or not specific enough to act on safely, stop and ask for the exact backlog item instead of guessing or widening scope.

Audit the item thoroughly before editing: reproduce or prove the problem when feasible, inspect the owning area, zoom out enough to understand how that area works, identify intentional behavior that must not be broken, and locate the real source boundary. Make high-ROI changes only: fix the canonical source path, preserve existing UI/UX and intended behavior, avoid broad cleanup, avoid adjacent work, and do not add fallbacks, legacy paths, duplicate authorities, workaround layers, or patches-on-patches unless the patch itself is the simple correct source fix.

You have authority to make critical implementation decisions inside the approved scope and should not push routine judgment back to the user. Stop and notify the user before continuing if the correct solution would materially change UI, UX, intended behavior, product semantics, security/privacy posture, billing/credit behavior, persistence contracts, launch posture, another owner’s lane, or release/deploy/commit/push state.

After the fix, run focused validation, audit your own diff for regressions or drift, decide whether the backlog item is solved, and stop. Do not continue into neighboring backlog items, cleanup, refactors, or speculative improvements unless the user explicitly approves a new goal. Use a checkpoint only if context is stale, validation is partial, or the item needs a fresh audit before safe progress can continue.

Stop completely when the current backlog item is solved or explicitly blocked, when the item is outside scope or lacks enough evidence to act safely, when validation blocks safe progress, when required proof depends on production/release work outside your lane, or when remaining work would mostly create churn. Close out with the item status, source fix or blocker, validation proof, unproven risk, and exact next boundary if anything remains.
```
