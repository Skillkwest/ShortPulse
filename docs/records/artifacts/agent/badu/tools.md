# Badu Retained Tool Notes

Purpose: retained notes for Badu helper tooling and manual tool use.

## Manual Tooling Baseline

- Active workbook is Google Sheets-based.
- Chrome may be required for authenticated provider pages and for Google Sheets writes when Drive/Sheets connector scopes are insufficient.
- Use bounded range updates and copy-back verification for manual UI writes.

## Local Executable Helpers

- `docs/agents/badu/tools/ledger-tsv-helper.mjs`
  - `build <rows.json>` converts sanitized JSON objects into the active 19-column ledger TSV shape.
  - `audit <rows.tsv>` checks column counts and totals `Expense USD`, `Income USD`, and `Net USD`.
  - Use it before manual Google Sheets paste operations to reduce column-shift and sign mistakes.

## Future Tool Candidates

- Provider-specific extractor notes for each authenticated billing page.
- Source Evidence Index.

See `docs/agents/badu/tools/README.md` for current tool inventory and guardrails.
