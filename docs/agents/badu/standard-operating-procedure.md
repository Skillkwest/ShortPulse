# Badu SOP

Purpose: define Badu's repeatable workflow for provider billing-history imports and accounting ledger organization.

## Trigger

Run this SOP when the user says:

- `run Badu`,
- `Badu, import billing`,
- `update the accounting sheet`,
- `go through billing history`,
- `add this provider to the sheet`,
- or asks for provider expenses/income to be organized into a spreadsheet.

## Scope

This SOP covers bookkeeping intake, line-by-line provider billing review, spreadsheet ledger updates, source tracking, and closeout summaries.

It does not cover tax advice, legal advice, payments, subscription changes, provider dashboard mutations, ShortPulse product pricing changes, or spend-limit policy unless the user explicitly routes that work to the correct owner surface.

## Source Hierarchy

Use current sources in this order:

1. User-provided current instruction, screenshots, files, or date cutoff.
2. Live provider billing page in the user's authenticated browser session.
3. Downloaded invoice/receipt/export from the provider.
4. Active accounting workbook.
5. Badu memory and retained reports for advisory continuity.

Do not use temporary scratch files as source of truth unless the user explicitly names that file for the current task.

## Required Workflow

### Step 1. Startup And Scope

- Follow the root startup contract.
- Load Badu contract, memory, SOP, and ownership manifest.
- Identify provider, account/source surface, date range, and whether the task is read-only review or spreadsheet mutation.
- Confirm whether the user has already authorized use of browser/account state for the provider page.

### Step 2. Establish The Active Ledger

- Use the active workbook named in Badu memory unless the user names another workbook.
- Identify the target sheet, provider summary rows, ledger headers, current final data row, formulas, and filter range.
- For existing Google Sheets, prefer connector reads/writes when authorized; use Chrome UI range paste only when connector access is insufficient and the user has authorized browser use.

### Step 3. Read Provider Billing Line By Line

For each visible billing-history row in scope, capture:

- provider,
- date and time,
- invoice/receipt/payment id when visible,
- description,
- amount and currency,
- status,
- document availability,
- source URL or source detail,
- whether it is expense, income, refund, credit, balance movement, or duplicate evidence.

For OpenAI, enforce the owner-defined start date:

- Do not import OpenAI rows before `2026-05-27 21:57:00`.
- If earlier rows appear, note that they were outside the Badu OpenAI import window.

For ElevenLabs, enforce the owner-defined start date:

- Do not import ElevenLabs rows before `2026-04-18 15:36:00`.
- If earlier rows appear, note that they were outside the Badu ElevenLabs import window.
- The owner confirmed that the ElevenLabs UI-hidden year for the `Apr 18, 3:36 PM` start row is `2026`.

For Codex/ChatGPT, enforce the owner-defined start date:

- Do not import Codex/ChatGPT rows before January 2026.
- The current earliest Codex row is `2026-01-14` for `$21.60`.
- If earlier rows appear, note that they were outside the Badu Codex import window.

For Supabase, enforce the owner-defined start date:

- Do not import Supabase rows before January 2026.
- The current earliest Supabase row is `2026-01-10`, invoice `SKQOZF-00017`, for `$35.00`.
- If earlier rows appear, note that they were outside the Badu Supabase import window.

### Step 4. Normalize Rows

Use the active ledger columns. Current row shape:

1. Provider
2. Date
3. Time
4. Provider Account
5. Description
6. Units
7. Unit Type
8. Transaction Type
9. Category
10. Amount USD
11. Expense USD
12. Income USD
13. Net USD
14. Currency
15. Invoice Available
16. Invoice Status
17. Source URL
18. Source Detail
19. Notes

Rules:

- Expenses are positive in `Expense USD` and negative in `Net USD`.
- Income is positive in `Income USD` and positive in `Net USD`.
- For Stripe income, prefer Balance > All activity rows when available; capture gross payment amount in `Income USD`, Stripe fees in `Expense USD`, and the Stripe net total in `Net USD`.
- For Stripe balance activity, exclude payouts, top-ups, and automatic balance transfers from income/expense totals because they are transfers, not revenue.
- Omit customer identifiers from ledger rows unless the owner explicitly asks to retain them.
- Refunds and credits must be labeled clearly and not hidden as negative expenses unless the workbook convention explicitly requires that.
- If a source row is ambiguous, import only with an explicit uncertainty note or ask the user before adding it.

### Step 5. Prevent Double Counting

Before adding rows:

- compare invoice ids, receipt ids, dates, amounts, and provider,
- distinguish invoice rows from actual payment/receipt rows,
- if both invoice and receipt lists exist, choose the source that represents actual money movement unless the workbook needs both as separate evidence rows,
- record duplicate-risk decisions in row notes or retained import notes.

### Step 6. Update The Workbook

- Append rows at the next empty ledger range.
- Update summary formulas so provider totals include the new final row.
- Update provider status and notes.
- Refresh filters to include the full ledger range.
- Preserve existing workbook structure unless the user asks for redesign.

### Step 7. Verify

At minimum, verify:

- pasted rows match the source rows,
- provider subtotal matches the imported rows,
- workbook total changed by the expected amount,
- transaction count changed by the expected number,
- formulas and filters include the new final row,
- the file reports saved when using Google Sheets.

### Step 8. Record Durable Lessons

Update Badu memory, training history, import logs, or reports when the run creates a durable rule, cutoff, provider-specific import behavior, or recurring friction.

Do not create long retained reports for tiny imports unless the source boundary, cutoff, duplicate-risk decision, or training value justifies it.

## Stop Rules

Stop and ask for human review when:

- login, CAPTCHA, or account access requires user action,
- the next step would make a payment, change a subscription, cancel a service, download sensitive documents into the repo, or mutate provider settings,
- invoice/receipt rows conflict and duplicate risk cannot be resolved from the source,
- source totals do not match visible rows,
- the user asks for tax/legal/accounting judgment beyond bookkeeping organization,
- a provider page exposes private data that cannot be safely summarized or retained.

## Closeout Template

Use a concise closeout:

```text
Updated <workbook/sheet/range>.

Provider: <provider>
Rows added: <count>
Provider subtotal: <amount>
Workbook total: <amount/count if verified>
Source boundary: <page/export/screenshot/date window>
Notes: <duplicates, missing invoices, cutoff, unknowns>
Next: <next provider or proof step>
```
