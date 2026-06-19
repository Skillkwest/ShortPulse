# Gear Ball Hot Path Checklist

Purpose: give Gear Ball the compact execution checklist for its real job: analyze the worktree, validate the intended batch enough, commit it, and push it.

## Before First Edit Or Git Write

1. Confirm mode: no-edit vs implementation.
2. Run the repo startup contract.
3. Verify current branch and `shortpulse.allowedBranch`.
4. Run the workspace artifact safety check.
5. Drop old thread residue. Unless the lane explicitly needs historical evidence, treat conversational material older than 30 minutes as cold and re-anchor on repo-local instructions.
6. Select one run profile:
   - `docs-only`
   - `product-targeted`
   - `shared-runtime`
   - `production-targeted`
   - `production-broad`
7. Build a full live-worktree inventory and classify every non-temp repo-backed change into:
   - publish now
   - defer intentionally
   - ignore as temp/noise
8. Collapse the inventory into the fewest honest lanes possible. Default target: 1 to 3 lanes total.
9. Build the first manifest from full `git status --short`, not from tracked diffs or memory.
10. Do one explicit sibling-surface sweep around the touched route/runtime/helper area before the first validation pass. Use `node scripts/ops/gear_ball_related_sweep.mjs --files <paths...>` when the lane is broad enough that a quick ranked sweep beats ad hoc rereads.
11. Bias toward catching same-lane siblings early. Late manifest undercounting is usually a bigger speed loss than a slightly broader first validation pass.
12. If the run is large or mixed, lock a file-backed manifest before staging.
13. If optional browser smoke or visual QA might help, verify the browser toolchain is actually available before budgeting time for it.

## Default Ladders

- `docs-only`
  - docs validation
  - one commit
  - push if asked
- `product-targeted`
  - targeted tests
  - `build` only if shared runtime/page/API triggers fire
  - one commit
  - push if asked
- `shared-runtime`
  - `gear-ball:preflight` unless ignore-matched config files force the manual ladder
  - targeted tests
  - `build`
  - escalate only when the lane is mixed, unstable, or explicitly broad
- `production-targeted`
  - same as `shared-runtime`
  - stricter leftover audit
  - smoke only when the changed route truly needs it
- `production-broad`
  - strongest ladder
  - broader validation
  - stricter leftover audit
  - smoke only when the changed route truly needs it

## Common Rules

1. Start from one intended commit and split only on real boundaries.
2. Do not refine lane boundaries past the point of decision usefulness. Once 1 to 3 coherent lanes are obvious, move to validation.
3. Use `gear-ball:preflight` for substantial or risky batches, not every tiny docs-only edit.
4. If the manifest includes ignore-matched config files like `frontend/next.config.js`, skip `gear-ball:preflight` immediately and run the manual validation ladder instead of paying the wrapper noise cycle.
5. When canonical helpers, route metadata, or memoization boundaries move, rerun the dependent repo check or optimization-sensitive test immediately instead of waiting for the final build/docs rung to discover the seam.
6. Run `git status --short` after every commit before staging the next batch.
7. If post-commit stash restore resurfaces unrelated files, treat them as a new lane by default and defer them unless they are required for correctness.
8. Before any push or push-ready claim, rerun `git status --short` and confirm that every remaining non-temp change has been explicitly classified.
9. Once the commit phase starts, keep Git commands serialized. Do not run parallel `git status`, `git add`, `git diff --cached`, or `git commit` calls.
10. Before every commit, rerun `git diff --cached --name-only` and compare it to the intended lane manifest so pre-staged files cannot silently leak across batch boundaries.
11. After every commit, run a post-commit convergence loop:

- rerun `git status --short`
- compare the live tree to the just-validated lane manifest
- use `node scripts/ops/gear_ball_tail_check.mjs --files <paths...>` when stash restore or mixed tails make the relation call non-obvious
- if related tails surfaced, fold them back into the same lane before any push or score-loop writeback
- do not treat the run as stable until this loop returns clean or only intentionally deferred unrelated work remains

12. Do not commit the score loop while any related repo-backed tail is still live. Score-loop writeback happens only after the final commit set is complete.
13. Before push, rerun validation only when the final committed content materially differs from the already-validated content. Valid triggers are:

- commit hooks rewrote validated files
- related tails were folded into the lane after the earlier proof
- a post-validation fix changed committed content

If rerun is required, rerun only the affected rung set (`gear-ball:preflight`, owning tests, `build`, or `docs:check`). Do not duplicate the full earlier ladder just because a commit happened.
14. After the last validation rung and before the final report, rerun `git status --short`. If any non-temp repo-backed file is still live, the run is not finished.
15. After a CI-recovery push, classify any remaining or newly exposed GitHub failures before editing again:
   - `same-root`
   - `adjacent-test-contract`
   - `environment-only`
   - `new-product-risk`
16. If local full tests passed but GitHub unit tests still fail, begin with the exact failed files from CI. Do not jump straight to broad reruns or product rewrites.
17. If the post-push failures are no longer clearly the same lane, would require user-facing behavior changes just to satisfy tests, or widen beyond the bounded failed-file set, stop and report the new lane instead of continuing by momentum.
18. Push only the approved branch.
19. For timers, automations, commits, pushes, branch changes, and similar tool-backed side effects, do not use completion language until the tool confirms success.
20. Do not broaden the lane into general process, governance, or ops work unless the user explicitly asked for that separate job.
21. Treat routine progress narration as an efficiency cost. Unless blocked or asked for status, keep normal execution chatter internal.

## Closeout

1. Self-audit the run.
2. Decide three things explicitly:
   - what Gear Ball did right
   - what Gear Ball did wrong
   - the smallest change that would raise the next run's score
3. Score it out of 10.
4. Recheck whether the score is over-crediting eventual recovery. If the run needed multiple preventable correction cycles, late tails, or late toolchain seams, push the score down until it matches the control quality rather than just the final outcome.
5. Append one compact training row for the run to `docs/records/artifacts/agent/gear-ball/performance-ledger.md` only after the final commit set is actually complete.
6. If the run scored below `9.0` or taught a new durable lesson, update only the smallest retained surfaces needed.
7. Build the final chat report from the actual pushed commits and final live status, not from an earlier mental snapshot.
8. If a post-push GitHub run diverges from local proof, say that plainly:
   - what passed locally
   - what failed in GitHub
   - whether the remaining work is the same lane or a new lane
9. Keep suggested next steps inside Gear Ball's lane by default:
   - SOP/process improvements
   - self-scoring improvements
   - validation/manifest/leftover-discipline improvements
10. Do not expand the run into Gear Ball process maintenance unless the user explicitly asked for that separate job.
11. Treat user corrections about missing full-worktree accounting as behavior/SOP drift and record them in retained training data when the lesson is still new.

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
