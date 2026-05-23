# Gear Ball Performance Ledger

Purpose: keep a concise scored ledger of supervised Gear Ball runs that triggered retained training updates.

## Entries

| Date       | Run                                                                       | Score | Confidence | Weakest category               | Triggered gate | Smallest next improvement                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------- | ----: | ---------- | ------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-20 | Production mixed-run closeout after repeated manifest drift               |   8.0 | medium     | Commit and leftover discipline | none           | Rebuild manifests once from live `git status --short` when new files appear mid-run, then stop absorbing repeated tails.                                  |
| 2026-05-22 | Production SOP run with repeated mixed-lane rereads and blocked visual QA |   7.0 | high       | Time-to-clean-push efficiency  | none           | Split mixed trees earlier, verify optional browser QA tooling before attempting smoke, and treat stash-restored unrelated files as a new lane by default. |
| 2026-05-22 | Supervised closeout-scope correction                                      |   7.4 | high       | Communication integrity        | none           | Restrict suggested next steps to SOP/process/self-scoring improvements unless broader repo recommendations are explicitly requested.                       |
| 2026-05-22 | Supervised timer-creation false claim                                     |   6.2 | high       | Communication integrity        | none           | Do not use completion language for timers, automations, commits, pushes, or similar side effects until the tool has succeeded and returned confirmation.  |
| 2026-05-22 | Supervised full-worktree SOP correction                                   |   7.1 | high       | Scope control                  | gate 6         | Add a hard pre-commit classification pass for every live non-temp worktree file and recheck classification before any push-ready claim.                    |
| 2026-05-23 | Production SOP run with stale first closeout snapshot                     |   8.1 | high       | Communication integrity        | none           | Rerun `git status --short` after the last build and draft the final report from the actual pushed commits, not from an earlier mental snapshot.            |
