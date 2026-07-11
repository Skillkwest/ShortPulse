# Maya Chen Monthly Credit Ledger

Purpose: track Maya Chen's ShortPulse testing credit spend so she stays within the approved `100` credits per calendar month.

## Budget Rule

- Monthly budget: `100` credits.
- Scope: image-generation testing unless the user explicitly expands scope.
- Before any credit-spending action, check this ledger and the visible in-app credit/cost cues.
- If the exact debit is unknown, mark the entry as estimated and reconcile it when the UI makes the actual value clear.

## Monthly Summary

| Month   | Budget | Spent | Remaining | Notes                                                                       |
| ------- | ------ | ----- | --------- | --------------------------------------------------------------------------- |
| 2026-06 | 100    | 0     | 100       | Initial ledger created before first Maya run.                               |
| 2026-07 | 100    | 8     | 92        | Starter account purchased; two paid image generations spent 4 credits each. |

## Run Entries

| Date       | Report                                                                                                        | Scenario                                                                              | Credits spent | Exact or estimated | Remaining after run | Notes                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------- | ------------------ | ------------------- | ------------------------------------------------------------------------- |
| 2026-07-03 | [Authenticated orientation](reports/2026-07-03-authenticated-orientation-maya-report.md)                      | Dashboard, projects, AI Studio, credits, no-spend prompt/save orientation             | 0             | Exact              | 100                 | No generation; created/pinned/saved a text reference only.                |
| 2026-07-04 | [Fresh signup, payment, first image](reports/2026-07-04-fresh-signup-payment-image-generation-maya-report.md) | Fresh email signup, Starter purchase, one image generation, Media check, download     | 4             | Exact              | 96                  | UI showed `350 / 350` before generation and `346 / 350` after generation. |
| 2026-07-05 | [Find generated image context](reports/2026-07-05-find-generated-image-context-maya-report.md)                | Reopened project, recovered saved image, checked prompt recovery and Quick Slot reuse | 0             | Exact              | 96                  | No generation; visible account balance stayed `346 / 350`.                |
| 2026-07-05 | [Prompt detail recovery](reports/2026-07-05-prompt-detail-recovery-maya-report.md)                            | Recovered original prompt/model/details through Media Detail without generation       | 0             | Exact              | 96                  | No generation; visible account balance stayed `346 / 350`.                |
| 2026-07-05 | [Second image variant](reports/2026-07-05-second-image-variant-maya-report.md)                                | Generated one alternate image for Tiny Apartment Reset Kit                            | 4             | Exact              | 92                  | UI showed `346 / 350` before generation and `342 / 350` after generation. |
| 2026-07-06 | [Find both assets later](reports/2026-07-06-find-both-assets-later-maya-report.md)                            | Reopened project and verified both generated images without spending credits          | 0             | Exact              | 92                  | No generation; visible account balance stayed `342 / 350`.                |
| 2026-07-06 | [Credits and renewal confidence](reports/2026-07-06-credits-renewal-confidence-maya-report.md)                | Checked visible balance, renewal, subscription, transactions, and credit activity     | 0             | Exact              | 92                  | No generation; visible account balance stayed `342 / 350`.                |
| 2026-07-06 | [Reference Grid understanding](reports/2026-07-06-reference-grid-understanding-maya-report.md)                | Reopened AI Studio and inspected Reference Grid/Media/Quick Slot reuse clarity        | 0             | Exact              | 92                  | No generation; visible account balance stayed `342 / 350`.                |
| 2026-07-10 | [Quick Slot Inventory understanding](reports/2026-07-10-quick-slot-inventory-maya-report.md)                  | Reopened renter-reset project and tested Quick Slot meaning and persistence           | 0             | Exact              | 92                  | No generation; visible account balance stayed `1,542 / 1,200`.            |
