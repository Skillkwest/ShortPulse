# Gear Ball Performance Ledger

Purpose: keep a concise scored ledger of supervised Gear Ball runs that triggered retained training updates.

## Entries

| Date       | Run                                                                       | Score | Confidence | Weakest category               | Triggered gate | Smallest next improvement                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------- | ----: | ---------- | ------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-20 | Production mixed-run closeout after repeated manifest drift               |   8.0 | medium     | Commit and leftover discipline | none           | Rebuild manifests once from live `git status --short` when new files appear mid-run, then stop absorbing repeated tails.                                  |
| 2026-05-22 | Production SOP run with repeated mixed-lane rereads and blocked visual QA |   7.0 | high       | Time-to-clean-push efficiency  | none           | Split mixed trees earlier, verify optional browser QA tooling before attempting smoke, and treat stash-restored unrelated files as a new lane by default. |
