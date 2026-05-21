# Gear Ball Hot Path Checklist

Purpose: give Gear Ball a compact execution checklist for normal worktree batching and publish runs. Use this as the hot path. Use the full SOP when a step is unclear or the run is unusual.

## Before First Edit Or Git Write

1. Confirm mode: no-edit vs implementation.
2. Run the repo startup contract.
3. Verify current branch and `shortpulse.allowedBranch`.
4. Run the workspace artifact safety check.
5. Select one run profile:
   - `docs-only`
   - `product-targeted`
   - `shared-runtime`
   - `production-critical`
6. If the run is large or mixed, lock a file-backed manifest before staging.

## Default Profiles

### `docs-only`

1. Inventory the diff.
2. Default to one commit.
3. Run docs validation only.
4. Commit.
5. Push if asked.

### `product-targeted`

1. Inventory the diff.
2. Default to one commit.
3. Run targeted tests first.
4. Run `build` only if shared page/runtime/API triggers fire.
5. Commit.
6. Push if asked.

### `shared-runtime`

1. Inventory the diff.
2. Default to one commit unless a real risk boundary exists.
3. Run `gear-ball:preflight`.
4. Run targeted tests.
5. Run `build`.
6. Escalate to the full suite only when:
   - the profile explicitly demands it
   - the run is mixed/cross-cutting
   - or first-pass validation is unstable
7. Commit.
8. Push if asked.

### `production-critical`

1. Inventory the diff.
2. Default to one commit unless a real risk boundary exists.
3. Run `gear-ball:preflight`.
4. Run targeted tests.
5. Run `build`.
6. Usually run the full suite.
7. Run stricter leftover audits.
8. Run smoke only when the changed route and profile require it.
9. Commit.
10. Push if asked.

## Common Rules

1. Start from one intended commit and split only on real boundaries.
2. Use `gear-ball:preflight` for substantial or risky batches, not every tiny docs-only edit.
3. Run `git status --short` after every commit before staging the next batch.
4. Once the commit phase starts, keep Git commands serialized. Do not run parallel `git status`, `git add`, `git diff --cached`, or `git commit` calls.
5. Before push, rerun only the final required validation on the exact final tree.
6. Push only the approved branch.

## Closeout

Always:

1. Self-audit the run.
2. Score it out of 10.

Only when exception-triggered:

3. Update retained reports/training/KPIs/process docs if:
   - the run was `production-critical`
   - the score was below threshold
   - a new recurring failure mode appeared
   - or the process/tooling itself changed

4. If a user correction is recurring, encode it in:
   - `docs/records/artifacts/agent/gear-ball/conversation-training-dataset.jsonl`

## Stop Conditions

- Branch mismatch
- unclear push target
- unclear production authorization
- stale validation after a mid-run fix
- leftover files after a supposed final closeout
- any need to bypass hooks, branch rules, or protected flows
- any temptation to broaden a normal product run into agent-process maintenance without a concrete trigger

## Canonical References

- Full worktree SOP:
  - `docs/sops/sop_gear_ball_worktree_batch_commit_operations.md`
- GitHub/merge SOP:
  - `docs/sops/sop_gear_ball_github_pr_merge_operations.md`
- Shared-risk map:
  - `docs/agents/gear-ball/shared-file-risk-map.md`
- Active rules:
  - `docs/agents/gear-ball/memory.md`
