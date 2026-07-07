# Gear Ball Hot Path Checklist

Purpose: give Gear Ball the shortest default-loaded checklist for its real job: inventory the live tree, validate enough, commit cleanly, and push the approved branch.

## Startup

1. Confirm mode: no-edit/process-work vs normal SOP publish.
2. Verify branch and guard: `git branch --show-current` and `git config --local shortpulse.allowedBranch`.
3. Run the workspace artifact safety check before broad commands.
4. Treat conversation older than 30 minutes as cold unless this lane explicitly needs it.
5. If this is process-work, stay inside `docs/agents/gear-ball/` and `docs/records/artifacts/agent/gear-ball/`; do not enter the commit/push ladder unless separately asked.

## Inventory

1. Build the manifest from live `git status --short`, not memory or tracked diffs.
2. Classify every non-temp repo-backed change as `publish now`, `defer intentionally`, or `ignore temp/noise`.
3. Collapse to the fewest honest lanes. Default to one lane; split only on real risk, owner, review, or validation boundaries.
4. For broad route/runtime/helper work, run one related sweep before validation:
   `node scripts/ops/gear_ball_related_sweep.mjs --files <paths...>`
5. Refresh the manifest after any formatting, generated artifact, or validation-fix mutation.

## Validation Profiles

- `docs-only`: Prettier/docs checks, `git diff --check`, secret scan.
- `product-targeted`: owning tests plus build only when shared page/API/runtime/style triggers fire.
- `shared-runtime` / `production-targeted`: `gear-ball:preflight`, repo-wide `type-check`, `git diff --check`, secret scan, build.
- `production-broad`: manifest preflight, type-check, diff/secret checks, build, plus only concrete sibling tests from the related sweep.

Use the manual ladder instead of `gear-ball:preflight` when the wrapper is predictably noisy for the manifest, such as config-file or ignored-file edge cases.

## Commit And Push

1. Serialize Git writes: no parallel `git add`, `git commit`, `git status`, or cached-diff commands.
2. Before each commit, compare `git diff --cached --name-only` to the intended manifest.
3. Commit one coherent lane by default.
4. After commit, run `git status --short`.
5. Rerun validation only if hooks rewrote validated files, a related tail was folded in, or a post-validation fix changed committed content.
6. Push only the approved branch after the live tree is clean or all remaining files are explicitly deferred.
7. Do not claim commit, push, branch, timer, automation, or deploy completion until the tool confirms it.

## Closeout

1. Build the final report from fresh status, actual commit hash, actual validation, and actual push result.
2. For substantive SOP publish runs, append one compact row to `docs/records/artifacts/agent/gear-ball/performance-ledger.md` after the final commit set is complete.
3. Score control quality, not eventual recovery. Penalize preventable formatting loops, late manifest tails, stale proof, and build-only discoveries.
4. Keep next steps inside Gear Ball's lane unless the user asked for broader product follow-up.

## Stop Conditions

- Branch or push target mismatch.
- Unclear production authorization.
- Stale validation after a fix.
- Unclassified repo-backed leftovers before a push-ready claim.
- Any need to bypass hooks, branch rules, protected flows, or test integrity.
- Any temptation to broaden normal SOP work into agent/process maintenance without explicit scope.

## References

- Full SOP: `docs/sops/sop_gear_ball_worktree_batch_commit_operations.md`
- Active memory: `docs/agents/gear-ball/memory.md`
- Shared-risk map: `docs/agents/gear-ball/shared-file-risk-map.md`
