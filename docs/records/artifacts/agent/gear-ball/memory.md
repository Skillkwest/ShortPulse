# Gear Ball Retained Memory

Purpose: store retained working memory that supports Gear Ball's repo-visible contract, SOPs, and self-training loop.

## Standing Notes

- Full SOP runs should end with: self-audit, score out of 10, capability-gap review, tooling-decision review, and training-history update.
- The goal is not only to finish the current run, but to make the next run cleaner.
- Prefer small helper tooling over more narration when the friction is mechanical and recurring.
- Serialize Git commands that touch the index; do not run `git status`, `git add`, `git commit`, or similar operations in parallel.
- If the user wants all three role branches aligned, promote the retained self-audit closeout lane too, not just the feature commit.
- If a repo-visible agent contract links to `CURRENT-HANDOFF.md`, commit the linked handoff file with the contract change or revert the link.
