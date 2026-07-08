# Badu Ledger Row Template

Purpose: define the current ledger row shape for Badu provider imports.

Use one row per accounting-relevant transaction:

```tsv
Provider	Date	Time	Provider Account	Description	Units	Unit Type	Transaction Type	Category	Amount USD	Expense USD	Income USD	Net USD	Currency	Invoice Available	Invoice Status	Source URL	Source Detail	Notes
```

Rules:

- `Date`: `YYYY-MM-DD`.
- `Time`: `HH:MM:SS` when available.
- `Transaction Type`: use `Expense`, `Income`, `Refund`, `Credit`, or `Balance Movement`.
- `Expense USD`: positive amount for expenses.
- `Income USD`: positive amount for income.
- `Net USD`: negative for expenses, positive for income/refunds unless the workbook convention changes.
- `Source Detail`: include screenshot/export/provider page context when no document URL is available.
- `Notes`: include duplicate-risk, cutoff, missing invoice, or status notes.
