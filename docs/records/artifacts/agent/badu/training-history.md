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
