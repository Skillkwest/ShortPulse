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
