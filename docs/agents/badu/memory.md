# Badu Memory

Purpose: concise durable memory for Badu, the ShortPulse accountant agent.

Local memory is advisory. Current user instructions, source billing pages, active workbook contents, and repo contracts outrank this file.

## Current Workbook

- Active accounting workbook: `ShortPulse Finances`
- URL: `https://docs.google.com/spreadsheets/d/1QchjaYKjY-hzUXKnenHgPI1Zx-LTDk6CkXt58vaFcXo/edit?pli=1&gid=0#gid=0`
- Current workbook structure after the 2026-07-08 restructure: `Dashboard`, `Ledger`, `Expenses_View`, `Income_View`, `Monthly_Summary`, `Provider_Summary`, `Config`, `Source_Log`, and `Archive_Initial_Intake_2026-07-08`.
- `Ledger` is the canonical editable transaction table. `Expenses_View`, `Income_View`, `Monthly_Summary`, `Provider_Summary`, and `Dashboard` are derived views/summaries.
- `Source_Log` stores provider cutoff and source-boundary rules. `Archive_Initial_Intake_2026-07-08` preserves the original single-tab intake layout.
- Active provider summary rows currently include Kie.ai, fal.ai, OpenAI, Supabase, Codex, Vercel, ElevenLabs, and Stripe.
- Monthly navigation/checklist source: `docs/agents/badu/provider-account-map-and-monthly-checklist.md`.

## Provider Import State

As of the supervised 2026-07-08 dry-run SOP audit:

- Kie.ai imported: 58 transactions, `$995.00` expenses, `199000` credits, first date `2026-01-24`, latest date `2026-07-07`.
- fal.ai imported: 8 receipt/payment rows, `$720.00` expenses, first date `2026-02-19`, latest date `2026-06-23`; 13 invoice rows were reviewed without double-counting invoice/receipt duplicates.
- OpenAI imported: 2 paid invoices, `$108.01` expenses, both created `2026-05-27 21:57:00`.
- Supabase imported: 8 paid invoice rows, `$262.42` expenses, first date `2026-01-10`, latest date `2026-06-25`; includes one zero-dollar paid invoice retained for completeness.
- Codex imported: 7 paid invoice rows, `$1,141.94` expenses, first date `2026-01-14`, latest date `2026-06-10`.
- Vercel imported: 2 paid June 2026 invoice rows, `$20.00` expenses, date `2026-06-11`; includes one zero-dollar paid invoice retained for completeness; unpaid upcoming estimated invoice excluded.
- ElevenLabs imported: 8 paid invoice rows, `$88.56` expenses, first date `2026-04-18`, latest date `2026-07-08`.
- Stripe imported: 33 rows after test-account reclassification and the dry-run catch-up, `$3,602.00` gross income, `$302.44` expenses, `$3,299.56` net income impact, first date `2026-05-25`, latest date `2026-07-08`; payouts and top-ups excluded as transfers.
- Workbook total after the full dry-run SOP audit: 126 transactions, `$3,638.37` expenses, `$3,602.00` income, and `-$36.37` net.
- Full dry-run verification on `2026-07-08` reported screenshot-only rows `0`, payment-page fee gaps `0`, audit warnings `0`, rows with blank source URL `0`, and ledger math check `0`.

## OpenAI Start-Date Rule

Owner instruction from 2026-07-08:

- For future OpenAI billing-history reviews, start at `2026-05-27 21:57:00`.
- Earliest OpenAI row to import: invoice `517B9912-0018`, paid, `$10.80`, created `May 27, 2026, 9:57 PM`.
- Same initial batch includes invoice `517B9912-0019`, paid, `$97.21`, created `May 27, 2026, 9:57 PM`.
- Ignore OpenAI invoices or billing-history rows before this date/time unless the owner explicitly changes the rule in the current thread.

## ElevenLabs Start-Date Rule

Owner instruction from 2026-07-08:

- For future ElevenLabs billing-history reviews, start at `2026-04-18 15:36:00`.
- Earliest ElevenLabs row to import: invoice `in_1TNhTWLmdOdiMXBsDXkwfI26`, paid, `$10.80`, created `Apr 18, 3:36 PM`.
- The ElevenLabs UI did not display `2026` for this row, but the owner confirmed that this April date is in `2026`.
- Import the ElevenLabs rows above this start row as current expenses. Ignore earlier ElevenLabs invoices unless the owner explicitly changes the rule in the current thread.

## Codex Start-Date Rule

Owner instruction from 2026-07-08:

- For future Codex/ChatGPT billing-history reviews, start with January 2026 expenses.
- Earliest Codex row to import: `Jan 14, 2026`, paid, `$21.60`, from ChatGPT Settings > Billing invoices.
- Import that row and every later Codex/ChatGPT invoice as current Codex expenses.
- Ignore earlier Codex/ChatGPT billing rows unless the owner explicitly changes the rule in the current thread.

## Supabase Start-Date Rule

Owner instruction from 2026-07-08:

- For future Supabase billing-history reviews, start with January 2026 expenses.
- Earliest Supabase row to import: invoice `SKQOZF-00017`, paid, `$35.00`, dated `Jan 10, 2026`.
- Import that row and every later Supabase invoice as current Supabase expenses.
- Ignore earlier Supabase billing rows unless the owner explicitly changes the rule in the current thread.

## Stripe Income Import Rule

Owner instruction from 2026-07-08:

- Use Stripe Balance > All activity as the preferred income source when available because it exposes gross amount, fees, and net total.
- Import payment and charge rows as income, with Stripe processing fees captured in `Expense USD` and gross customer payments captured in `Income USD`.
- Import standalone Stripe billing-fee rows as expenses.
- Exclude payouts, top-ups, and automatic balance transfers from income/expense totals because they are transfers, not revenue.
- Omit customer identifiers from ledger rows unless the owner explicitly asks to retain them.
- When the owner supplies test-account emails, match Stripe payments for those accounts but do not persist the raw email list in repo memory. Treat matched gross Stripe income as `Testing expense`; reclassify existing balance-activity ledger rows in place with original Stripe fees bundled into `Expense USD`, and append payment-page-only matches with a note that fee detail is not captured until Balance activity is reviewed.
- Treat refunds tied to owner/test purchases as negative `Testing expense` rows when that is the workbook convention for reducing prior test-purchase cost; keep the original processing fee as a real Stripe fee unless the source explicitly reverses it.
- Do not classify Stripe payments as testing expense unless the source proves a match to the owner-supplied test-account list. If Stripe detail pages load only a shell, keep the payment as customer revenue and note that the test-account match was not proven.

## Working Lessons

- Use the browser/Chrome session when the provider or Google Sheet depends on the user's signed-in state.
- Use connector/native spreadsheet APIs when available and authorized; otherwise use bounded range selection and clipboard paste through the Google Sheets UI.
- If the Google Sheets connector reports insufficient write scope, use Chrome UI bounded paste only after identifying the exact target range, then verify by connector readback or copied-back ranges.
- Preserve source detail per row when no invoice URL is captured.
- Append future imports to `Ledger` and refresh the `Ledger` filter range plus derived formulas/views when the final row changes.
- Keep durable provider cutoff/source rules in `Source_Log` instead of burying all source-boundary narrative in the raw ledger.
- Verify by copying the affected summary/ledger ranges back from the sheet and checking the file reports saved.
- For monthly SOP runs, import the previous completed month only: paid provider invoices/receipts and posted Stripe balance activity. Exclude upcoming, estimated, pending, payout, top-up, and automatic transfer rows.
- Monthly cadence: run Badu on the first of each month. Provider charge timing and Stripe payment timing can differ; keep the workbook current with posted/paid actuals as of the run date and record timing gaps in `Source_Log`/`Audit_Status` instead of forcing accrual alignment.
- Kie.ai login note: the visual UI is misleading. The first option is Google login and may look like an email entry field/button with the owner's email already present; click that first option/entry field to continue with Google. The second option is Microsoft login.
- Stripe testing classification note: use the owner-supplied testing email list from the local credential/source file. Payments from those emails are tests; payments from any other email are real customer revenue. Do not persist the raw email list in repo docs, reports, memory, or spreadsheet notes.

## Guardrails To Remember

- Do not store secrets, cookies, raw provider credentials, card details, or private customer payment data.
- Do not mutate provider billing settings or payment actions without explicit approval.
- Do not make tax/legal/CPA-grade claims.
- Do not double-count invoices and receipts for the same payment.
