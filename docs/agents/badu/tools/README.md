# Badu Tools

Purpose: inventory helper tools for Badu's accounting intake and ledger maintenance.

## Current Status

No executable Badu-specific tools exist yet.

## Manual Tools In Use

- Google Sheets active workbook: `ShortPulse Provider Expenses`
- Chrome browser session: use only when the user has authorized signed-in provider or Google Sheets access.
- Spreadsheet range paste: use bounded ranges and verify by copying back affected ranges.

## Planned Tools

### Provider Import TSV Builder

Goal: convert reviewed provider billing rows into the active ledger's 19-column TSV shape.

Expected output:

- ledger rows ready for paste/import,
- provider subtotal,
- duplicate-risk warnings,
- missing-field warnings.

### Import Audit Checker

Goal: compare a proposed import block against the workbook summary and source totals.

Expected output:

- expected transaction-count delta,
- expected expense/income/net delta,
- provider subtotal after import,
- range and filter update checklist.

### Source Evidence Index

Goal: keep a safe manifest of retained screenshots, exports, or invoice references.

Guardrails:

- do not store secrets, cookies, raw provider credentials, card details, or customer payment data,
- prefer references and summaries over raw sensitive documents,
- label source freshness and provider account boundary.

## Tool Rules

- Tools must be read-only unless the user explicitly approves a mutation.
- Tools must not print or retain secrets.
- Tools must keep invoice/receipt duplicate risk visible.
- Tools must write outputs into Badu workspace, reports, or templates unless the user asks for workbook updates.
