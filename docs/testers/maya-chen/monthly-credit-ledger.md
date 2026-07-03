# Maya Chen Monthly Credit Ledger

Purpose: track Maya Chen's ShortPulse testing credit spend so she stays within the approved `100` credits per calendar month.

## Budget Rule

- Monthly budget: `100` credits.
- Scope: image-generation testing unless the user explicitly expands scope.
- Before any credit-spending action, check this ledger and the visible in-app credit/cost cues.
- If the exact debit is unknown, mark the entry as estimated and reconcile it when the UI makes the actual value clear.

## Monthly Summary

| Month   | Budget | Spent | Remaining | Notes                                           |
| ------- | ------ | ----- | --------- | ----------------------------------------------- |
| 2026-06 | 100    | 0     | 100       | Initial ledger created before first Maya run.   |
| 2026-07 | 100    | 0     | 100       | Authenticated orientation run spent no credits. |

## Run Entries

| Date       | Report                                                                                   | Scenario                                                                  | Credits spent | Exact or estimated | Remaining after run | Notes                                                      |
| ---------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------- | ------------------ | ------------------- | ---------------------------------------------------------- |
| 2026-07-03 | [Authenticated orientation](reports/2026-07-03-authenticated-orientation-maya-report.md) | Dashboard, projects, AI Studio, credits, no-spend prompt/save orientation | 0             | Exact              | 100                 | No generation; created/pinned/saved a text reference only. |
