# Gear Ball Hot Path Checklist

Purpose: give Gear Ball the compact execution checklist for its real job: analyze the worktree, validate the intended batch enough, commit it, and push it.

## Before First Edit Or Git Write

1. Confirm mode: no-edit vs implementation.
2. Run the repo startup contract.
3. Verify current branch and `shortpulse.allowedBranch`.
4. Run the workspace artifact safety check.
5. Select one run profile:
   - `docs-only`
   - `product-targeted`
   - `shared-runtime`
   - `production-targeted`
   - `production-broad`
6. Build a full live-worktree inventory and classify every non-temp repo-backed change into:
   - publish now
   - defer intentionally
   - ignore as temp/noise
7. Collapse the inventory into the fewest honest lanes possible. Default target: 1 to 3 lanes total.
8. If the run is large or mixed, lock a file-backed manifest before staging.
9. If optional browser smoke or visual QA might help, verify the browser toolchain is actually available before budgeting time for it.

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
2. Default to one commit unless a real risk boundary exists. Do not split merely because the lane spans UI, tests, and closely-coupled docs.
3. Run `gear-ball:preflight`.
4. Run targeted tests.
5. Run `build`.
6. Escalate to the full suite only when:
   - the profile explicitly demands it
   - the run is mixed/cross-cutting
   - or first-pass validation is unstable
7. Commit.
8. Push if asked.

### `production-targeted`

1. Inventory the diff.
2. Default to one commit unless a real risk boundary exists.
3. Run `gear-ball:preflight`.
4. Run targeted tests.
5. Run `build`.
6. Run stricter leftover audits.
7. Run smoke only when the changed route and profile require it.
8. Commit.
9. Push if asked.

### `production-broad`

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
2. Do not refine lane boundaries past the point of decision usefulness. Once 1 to 3 coherent lanes are obvious, move to validation.
3. Use `gear-ball:preflight` for substantial or risky batches, not every tiny docs-only edit.
4. Run `git status --short` after every commit before staging the next batch.
5. If post-commit stash restore resurfaces unrelated files, treat them as a new lane by default and defer them unless they are required for correctness.
6. Before any push or push-ready claim, rerun `git status --short` and confirm that every remaining non-temp change has been explicitly classified.
7. Once the commit phase starts, keep Git commands serialized. Do not run parallel `git status`, `git add`, `git diff --cached`, or `git commit` calls.
8. Before every commit, rerun `git diff --cached --name-only` and compare it to the intended lane manifest so pre-staged files cannot silently leak across batch boundaries.
9. Before push, rerun only the final required validation on the exact final tree.
10. After the last validation rung and before the final report, rerun `git status --short`. If any non-temp repo-backed file is still live, the run is not finished.
11. Push only the approved branch.
12. For timers, automations, commits, pushes, branch changes, and similar tool-backed side effects, do not use completion language until the tool has succeeded and returned confirmation.
13. Do not broaden the lane into general process, governance, or ops work unless the user explicitly asked for that separate job.

## Closeout

1. Self-audit the run.
2. Decide three things explicitly:
   - what Gear Ball did right
   - what Gear Ball did wrong
   - the smallest change that would raise the next run's score
3. Score it out of 10.
4. Append one compact training row for the run to `docs/records/artifacts/agent/gear-ball/performance-ledger.md`.
5. If the run scored below `9.0` or taught a new durable lesson, update the smallest necessary retained training surfaces (`training-history`, SOP, memory, scorecard, or dataset).
6. Build the final chat report from the actual pushed commits and final live status, not from an earlier mental snapshot.
7. Keep suggested next steps inside Gear Ball's lane by default:
   - SOP/process improvements
   - self-scoring or training-loop improvements
   - validation/manifest/leftover-discipline improvements
8. Do not expand the run into Gear Ball process maintenance unless the user explicitly asked for that separate job.
9. Treat user corrections about missing full-worktree accounting as behavior/SOP drift and record them in retained training data.

## Stop Conditions

- Branch mismatch
- unclear push target
- unclear production authorization
- stale validation after a mid-run fix
- leftover files after a supposed final push-ready check
- any need to bypass hooks, branch rules, or protected flows
- any temptation to broaden a normal product run into agent-process maintenance without a concrete trigger

## Canonical References

- Full worktree SOP:
  - `docs/sops/sop_gear_ball_worktree_batch_commit_operations.md`
- Shared-risk map:
  - `docs/agents/gear-ball/shared-file-risk-map.md`
- Active rules:
  - `docs/agents/gear-ball/memory.md`
