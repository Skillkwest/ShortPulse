# AI Studio Right-Rail Performance Implementation Entry Checklist (2026-03-23)

Status: Dormant (`scope closed; reuse only if reopened`)  
Canonical program doc: `docs/planning/ai-studio-right-rail-performance-scope-contract-2026-03-23.md`  
Canonical tracker: `docs/planning/ai-studio-right-rail-performance-tracker-2026-03-23.md`  
Supporting history: `docs/planning/ai-studio-right-rail-performance-master-plan-2026-03-23.md`, `docs/planning/ai-studio-right-rail-performance-master-tracker-2026-03-23.md`, `docs/planning/ai-studio-right-rail-performance-readiness-state-2026-03-23.md`

Use this checklist before starting any additional right-rail implementation slice after the scope is deliberately reopened.

## Entry Checklist
1. Identify the exact open tracker row the slice is meant to close.
2. Confirm the slice is inside scope:
   - `Reference Grid`
   - `Quick Slot Inventory`
   - `rail Canvas`
3. Confirm the slice addresses either:
   - an unmet required tracker row, or
   - a measured/proved bottleneck.
4. Reject the slice if it is justified only by adjacency, easy coverage, or speculative cleanup.
5. Check the current worktree for conflicting dirty files in the same lane before editing.
6. Re-read the current right-rail contract docs:
   - scope contract
   - compact tracker
   - ADR 0049
   - supporting readiness/master docs only if the reopen decision depends on historical execution context
7. Define the targeted validation bundle before editing.
8. Keep the diff limited to the specific right-rail seam that closes the row.
9. Commit immediately after the slice is green.
10. Update the tracker and reassess whether the next step is still better than stopping.

## Do Not Start If
1. The next change widens into Media Library architecture or unrelated AI Studio panels.
2. The next change needs a new lane that is not covered by the master plan.
3. The next change cannot point to a concrete repo-backed problem statement.
4. The next change is likely to create another controller-local policy copy instead of removing one.
