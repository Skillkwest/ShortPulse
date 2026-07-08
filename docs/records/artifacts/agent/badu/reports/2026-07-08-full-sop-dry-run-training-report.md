# 2026-07-08 Badu Full SOP Dry-Run Training Report

Purpose: retain the training value from Badu's first full dry-run SOP audit across provider expenses and Stripe income.

## Run Frame

- Agent: Badu.
- Workbook: `ShortPulse Finances`.
- Workbook URL: `https://docs.google.com/spreadsheets/d/1QchjaYKjY-hzUXKnenHgPI1Zx-LTDk6CkXt58vaFcXo/edit`.
- User intent: practice the full monthly SOP by reviewing all providers from `2026-01-01` through `2026-07-08`, comparing live provider evidence to the workbook, and updating concrete gaps.
- Monthly SOP target: on the first of each month, review the previous completed month's provider invoices and Stripe income, then log the month accurately.
- Privacy boundary: no raw credentials, card data, customer emails, or private payment identities retained here.

## Result

- Final workbook totals verified:
  - Income: `$3,602.00`
  - Expenses: `$3,638.37`
  - Net: `-$36.37`
  - Transactions: `126`
  - Stripe fees: `$121.32`
- Workbook integrity checks verified:
  - Screenshot-only rows: `0`
  - Payment-page fee gaps: `0`
  - Audit warnings: `0`
  - Rows with blank source URL: `0`
  - Ledger math check: `0`

## Provider Coverage

| Provider      | Live review result                                                                                                           | Workbook decision                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kie.ai        | Live recheck blocked because sign-in presented Microsoft while Badu expected Google SSO.                                     | Prior captured baseline retained; blocker recorded in audit/status surfaces.                                                                           |
| fal.ai        | Live receipt/payment rows matched imported total.                                                                            | No transaction change.                                                                                                                                 |
| OpenAI        | Live billing history matched two paid 2026 rows.                                                                             | Source evidence repaired from screenshot-only to live billing history.                                                                                 |
| ElevenLabs    | Live invoice list matched imported paid/zero rows from the owner-approved window.                                            | No transaction change.                                                                                                                                 |
| Codex/ChatGPT | Live billing modal matched January-June 2026 rows.                                                                           | No transaction change.                                                                                                                                 |
| Supabase      | Live paginated billing table matched January-June 2026 rows.                                                                 | No transaction change.                                                                                                                                 |
| Vercel        | Live invoices matched one paid `$20.00` Pro invoice plus one paid `$0.00` Observability invoice; upcoming estimate excluded. | No transaction change.                                                                                                                                 |
| Stripe        | Live Balance activity showed new rows and fee gaps.                                                                          | Two existing test rows fee-completed; two test refunds added as negative testing expenses; three new unproven-test payments added as customer revenue. |

## Teachable Moments

1. **Current instruction can override retained cutoff rules for a dry run.**
   The standing Badu memory contains provider-specific start rows. The user explicitly asked for a Jan 1, 2026 dry run, so the run reviewed from that boundary where source pages exposed data. This must be recorded as a supervised dry-run override, not silently converted into a new monthly SOP rule.

2. **Kie.ai needs an auth-path correction before Badu can be fully autonomous.**
   The expected Google SSO path did not match the visible Microsoft sign-in path. Future Badu runs should treat this as an access blocker and continue other providers instead of stopping.

3. **Stripe testing-expense classification requires proof.**
   Known owner/test payments can be reclassified only when source evidence proves a match to the owner-supplied testing accounts. If Stripe detail pages load only a shell and do not expose identity, import the payment as customer revenue with a note rather than guessing.

4. **Refunds tied to test purchases reduce testing expense.**
   For this workbook, test-purchase refunds should be logged as negative `Testing expense` rows. The original Stripe fee remains a real fee unless Stripe source activity proves it was reversed.

5. **Balance activity is the Stripe source of truth for fees and net.**
   Payment-page-only entries create fee gaps. Balance activity rows should be preferred because they show gross, fee, and net in one place.

6. **Google Sheets write fallback must be deliberate.**
   Connector write failed because the account lacked sufficient scope. Chrome UI paste is acceptable only with exact target ranges and readback verification.

## Tooling Created From This Run

- `docs/agents/badu/tools/ledger-tsv-helper.mjs`
  - `build <rows.json>` converts reviewed sanitized rows into the 19-column ledger TSV shape.
  - `audit <rows.tsv>` checks column count and totals before/after manual paste.

## Next Training Focus

- Correct the Kie.ai auth route or document the exact Microsoft-login flow.
- Add a provider-by-provider monthly checklist that targets only the previous completed month.
- Improve Stripe proof gathering for owner/test-account classification without retaining private customer identifiers.
