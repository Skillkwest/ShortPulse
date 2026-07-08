# Badu Training History

Purpose: supervised-run learning log for Badu, the ShortPulse accountant agent.

## 2026-07-08 Initial Accounting Sheet Build

Prompt/use case:

- The owner asked for provider billing histories to be reviewed line by line and added into a Google Sheet, starting with Kie.ai, then fal.ai, then OpenAI.

Behavior learned:

- Use the active Google Sheet `ShortPulse Provider Expenses`.
- Preserve provider, date/time, description, amount, status, invoice availability, source detail, and notes.
- Update provider summaries, workbook totals, formulas, and filters after imports.
- Verify by copying back affected summary and ledger ranges and checking the file is saved.

Provider-specific lessons:

- Kie.ai import covered 58 transaction rows totaling `$995.00`.
- fal.ai import should use actual receipt/payment rows when invoice rows and receipt rows would otherwise double-count the same payment; initial fal.ai import covered 8 receipt/payment rows totaling `$720.00`.
- OpenAI import start date is `2026-05-27 21:57:00`; do not import earlier OpenAI billing rows unless the owner explicitly changes the cutoff.

SOP/template updates:

- Created Badu contract, SOP, memory, ownership manifest, tools index, workspace, assets guidance, and ledger row template.

Remaining friction:

- Google Drive connector did not have sufficient scope for the existing Chrome-created sheet, so the live sheet was updated through Chrome UI and clipboard paste.
- Future imports may need provider-specific duplicate rules for invoices versus receipts.

Next training focus:

- Import the next provider using the Badu SOP and produce a retained import report if the source boundary or duplicate-risk decisions are nontrivial.

## 2026-07-08 ElevenLabs Start-Date Import

Prompt/use case:

- The owner provided the ElevenLabs invoice page screenshot and stated that the `Apr 18, 3:36 PM` row is an April 2026 date and should be the start date for current ElevenLabs expenses.

Behavior learned:

- For ElevenLabs, start future imports at `2026-04-18 15:36:00`.
- Include the start row and every row above it in the current expense window.
- When ElevenLabs hides the year for recent rows, infer `2026` only when the owner has confirmed that boundary.

Rows imported:

- 8 paid invoice rows from `2026-04-18` through `2026-07-08`.
- Subtotal: `$88.56`.
- Workbook after import: 76 transactions and `$1,911.57` expenses.

SOP/template updates:

- Added ElevenLabs start-date rule to Badu contract, scoped instructions, memory, and SOP.

Remaining friction:

- ElevenLabs displays recent invoice dates without the year, so future runs must preserve the owner-confirmed cutoff instead of relying on visible date text alone.

Next training focus:

- Continue provider imports using provider-specific cutoff rules and verify any UI-hidden year assumptions before adding rows.

## 2026-07-08 Codex Start-Date Import

Prompt/use case:

- The owner stated that January 2026 is the start date for Codex expenses and provided access to the ChatGPT Settings > Billing invoice modal in the in-app browser.

Behavior learned:

- For Codex/ChatGPT, start future imports with January 2026 expenses.
- The current start row is `Jan 14, 2026`, paid, `$21.60`.
- Include that row and every later invoice as current Codex expenses.

Rows imported:

- 7 paid invoice rows from `2026-01-14` through `2026-06-10`.
- Subtotal: `$1,141.94`.
- Workbook after import: 83 transactions and `$3,053.51` expenses.

SOP/template updates:

- Added Codex start-date rule to Badu contract, scoped instructions, memory, and SOP.

Remaining friction:

- ChatGPT Settings > Billing did not expose invoice ids in the modal table; row descriptions should preserve dates and source-detail notes unless individual invoice views are opened later.

Next training focus:

- Continue provider imports using provider-specific cutoff rules and capture invoice ids when available without interrupting the import flow.

## 2026-07-08 Supabase Start-Date Import

Prompt/use case:

- The owner asked Badu to use the logged-in Supabase billing page in Chrome and import invoices starting January 2026.

Behavior learned:

- For Supabase, start future imports with January 2026 expenses.
- The current start row is `Jan 10, 2026`, invoice `SKQOZF-00017`, paid, `$35.00`.
- Include that row and every later Supabase invoice as current Supabase expenses.
- Include paid zero-dollar invoices as zero-amount ledger rows when they are part of the in-scope invoice sequence.

Rows imported:

- 8 paid invoice rows from `2026-01-10` through `2026-06-25`.
- Subtotal: `$262.42`.
- Workbook after import: 91 transactions and `$3,315.93` expenses.

SOP/template updates:

- Added Supabase start-date rule to Badu contract, scoped instructions, memory, and SOP.

Remaining friction:

- Google Drive connector did not have permission for the existing workbook, so the import used Chrome UI bounded range paste and readback verification.

Next training focus:

- Continue with Vercel import using the same source-boundary and readback workflow.

## 2026-07-08 Vercel Current-Invoice Import

Prompt/use case:

- The owner provided the Vercel All Invoices screenshot and said it showed all invoices for Vercel.

Behavior learned:

- Import paid Vercel invoice rows as expenses.
- Retain paid zero-dollar invoices as zero-amount ledger rows for completeness.
- Exclude upcoming estimated invoices until they become paid invoices.

Rows imported:

- 2 paid June 2026 invoice rows dated `2026-06-11`.
- Subtotal: `$20.00`.
- Workbook after import: 93 transactions and `$3,335.93` expenses.

SOP/template updates:

- Updated Badu memory and run log with Vercel import state.

Remaining friction:

- The Vercel invoice list did not expose invoice numbers in the visible row text; source details should preserve plan, date, status, and visible invoice page context.

Next training focus:

- Continue provider imports and keep unpaid estimated/upcoming rows out of paid expense totals unless the owner explicitly requests forecast tracking.

## 2026-07-08 Stripe Income Import

Prompt/use case:

- The owner asked Badu to log into Stripe and add ShortPulse income correctly.

Behavior learned:

- Stripe Balance > All activity is the preferred source for income imports because it shows gross amount, fees, and net total.
- Payment and charge rows should be imported as income rows with gross customer payments in `Income USD`, Stripe fees in `Expense USD`, and Stripe net total in `Net USD`.
- Standalone Stripe billing-fee rows should be imported as expenses.
- Payouts, top-ups, and automatic balance transfers should be excluded from revenue/expense totals as transfers.
- Customer identifiers should be omitted from ledger rows unless the owner explicitly requests retention.

Rows imported:

- 22 succeeded payment/charge income rows and 4 standalone Stripe fee rows from `2026-05-25` through `2026-07-08`.
- Gross income: `$2,550.27`.
- Stripe fee expenses: `$92.95`.
- Net income impact: `$2,457.32`.
- Workbook after import: 119 transactions, `$3,428.88` expenses, `$2,550.27` income, and `-$878.61` net.

SOP/template updates:

- Added Stripe income handling rules to Badu memory and SOP.

Remaining friction:

- Stripe transaction tables expose customer emails by default; Badu should avoid copying those into the ledger unless the owner asks for customer-level bookkeeping.

Next training focus:

- If future income imports grow beyond a few pages, use a Stripe export only after confirming the exact export scope and safe retention path.

## 2026-07-08 Workbook Structure Buildout

Prompt/use case:

- The owner approved implementation of the Badu workbook restructure plan for the active `ShortPulse Provider Expenses` Google Sheet.

Behavior learned:

- Keep one canonical editable transaction table in `Ledger`.
- Use `Expenses_View` and `Income_View` as derived views, not manually edited duplicate ledgers.
- Use `Monthly_Summary`, `Provider_Summary`, and `Dashboard` for summaries.
- Use `Config` for controlled lists and `Source_Log` for provider cutoff/source-boundary rules.
- Preserve the original intake layout as `Archive_Initial_Intake_2026-07-08`.

Rows changed:

- No new provider transactions were imported.
- Existing 119 ledger transactions were copied into `Ledger`.
- Dashboard readback verified `$3,428.88` expenses, `$2,550.27` income, `-$878.61` net, and 119 transactions.

Remaining friction:

- Google Sheets connector and Drive upload scopes were unavailable, so the buildout used Chrome UI bounded-range copy/paste.
- Chrome extension local-file upload was blocked because file URL access was not enabled, so the verified `.xlsx` import artifact was not uploaded directly.

Next training focus:

- Future imports should append to `Ledger`, then verify `Dashboard`, `Provider_Summary`, and the `Ledger` filter range.
