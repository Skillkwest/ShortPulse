# Gear Ball Hot Path Checklist

Purpose: give Gear Ball a compact execution checklist for normal worktree batching and publish runs. Use this as the hot path. Use the full SOP when a step is unclear or the run is unusual.

## Before First Edit Or Git Write

1. Confirm mode: no-edit vs implementation.
2. Run the repo startup contract.
3. Verify current branch and `shortpulse.allowedBranch`.
4. Run the workspace artifact safety check.
5. If the run is large or mixed, lock a file-backed manifest before staging.

## Normal SOP Path

1. Inventory:
   - `git status --short`
   - `git diff --name-status`
2. Build logical batches.
3. Run `gear-ball:preflight` on each substantial batch before staging.
4. For compound-risk frontend lanes:
   - run `build` before the final full suite
5. For docs/agent packet lanes:
   - run docs checks before the first commit
6. Stage one batch only.
7. Inspect staged diff.
8. Commit.
9. Run leftover audit:
   - `git status --short`
10. Repeat for the next batch.
11. Before push:

- rerun final required validation on the exact final tree

12. Push only the approved branch.

## Mandatory Closeout

1. Self-audit the run.
2. Score it out of 10.
3. Decide whether a tool/SOP/mechanical remediation is needed.
4. Update retained training surfaces.
5. If the user correction is recurring, encode it in:
   - `docs/records/artifacts/agent/gear-ball/conversation-training-dataset.jsonl`

## Stop Conditions

- Branch mismatch
- unclear push target
- unclear production authorization
- stale validation after a mid-run fix
- leftover files after a supposed final closeout
- any need to bypass hooks, branch rules, or protected flows

## Canonical References

- Full worktree SOP:
  - `docs/sops/sop_gear_ball_worktree_batch_commit_operations.md`
- GitHub/merge SOP:
  - `docs/sops/sop_gear_ball_github_pr_merge_operations.md`
- Shared-risk map:
  - `docs/agents/gear-ball/shared-file-risk-map.md`
- Active rules:
  - `docs/agents/gear-ball/memory.md`
