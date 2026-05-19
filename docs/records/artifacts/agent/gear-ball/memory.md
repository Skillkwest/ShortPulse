# Gear Ball Retained Memory

Purpose: store retained working memory that supports Gear Ball's repo-visible contract, SOPs, and self-training loop.

## Standing Notes

- Full SOP runs should end with: self-audit, score out of 10, capability-gap review, tooling-decision review, and training-history update.
- The goal is not only to finish the current run, but to make the next run cleaner.
- Prefer small helper tooling over more narration when the friction is mechanical and recurring.
- Serialize Git commands that touch the index; do not run `git status`, `git add`, `git commit`, or similar operations in parallel.
- After the batch commit series but before the first push, run one final leftover audit with `git status --short`. Any remaining path must be folded into the run, explicitly deferred, or called out as pre-existing unrelated work.
- On large or mixed runs, lock the batch manifest before the first staging step. Discovering lane boundaries during the first commit is too late.
- Run an inter-batch leftover audit after every commit. If a small adjacent doc or training tail remains, amend or reassign it immediately instead of letting it survive to the end.
- When preflighting Vitest targets from repo root, print or consume frontend-relative test paths. Repo-root `frontend/...` test paths are a mechanical friction point, not a real validation signal.
- For large runs, prefer file-backed preflight manifests (`--files-from`, `--tests-from`) over long inline arg lists so the targeted-check plan survives shell quoting and remains inspectable.
- Treat shared frontend hooks/pages/API routes and `frontend/package.json` as automatic early-build triggers.
- Treat generated audit docs and agent packets as automatic early-`docs:check` triggers.
- For suite-hot admin/UI tests, scope button queries to the owning card or dialog when accessible names are assembled from nested content or repeated action labels. This avoids full-suite-only selector failures.
- For interaction-heavy admin or frontend route changes, run one route-level browser smoke before push when a local target is already available. Record pass, block, or skip-with-reason in the retained report.
- If the user wants all three role branches aligned, promote the retained self-audit closeout lane too, not just the feature commit.
- If a repo-visible agent contract links to `CURRENT-HANDOFF.md`, commit the linked handoff file with the contract change or revert the link.
- If isolated rerun fixes touch files outside the original changed-file lane, append those files back into the active batch manifest immediately. Do not rely on memory to pick them up during the first `git add`.
- Treat tracked temp files such as `supabase/.temp/cli-latest` as generated drift, not source-of-truth change. Clear them before the first staging pass so leftover audits stay focused on real lanes.
- For AI Studio panel-shell or character-library layout runs, keep the component TSX, matching CSS files, and owning tests in one manifest. Context-menu positioning, moved counters, and modalized library flows are tightly coupled and should not be split across separate batches.
- After every commit on a long run, rebuild the next manifest from live `git status --short`. Lint-staged and leftover audits can surface omitted helper files or follow-up docs that invalidate the original plan.
- A retained closeout is only valid for the exact clean worktree that passed the final validation ladder. If any later product, docs, or test change appears after the closeout draft or closeout commit, invalidate that closeout, finish the new lane, rerun the required gates, and publish a rewritten closeout at the real end of the run.
- When a run changes shared preview-profile constants or KPI packet fields, include the dependent API/script contract tests in the first manifest. Those fan-outs are easy to miss if the manifest only follows touched feature files.
