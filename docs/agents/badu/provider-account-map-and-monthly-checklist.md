# Badu Provider Account Map And Monthly Checklist

Purpose: give Badu a lean navigation map for monthly finance SOP runs without storing secrets, raw credentials, card data, or customer payment identities.

Use this on the first of each month after loading Badu's SOP and memory.

## Monthly Rule

- Run for the previous completed month.
- Import paid provider invoices/receipts and posted Stripe balance activity visible as of the run date.
- Provider charge timing and Stripe payment timing can differ; record timing gaps in `Source_Log`/`Audit_Status` instead of forcing alignment.
- If one provider login is blocked, record the blocker and continue the rest.
- Do not mutate provider subscriptions, payment settings, refunds, purchases, or account settings.

## Credential Rule

- Use the Badu-specific local credential source the owner created.
- Do not copy raw credentials, cookies, card details, or customer/payment identities into repo docs, reports, memory, logs, or spreadsheet notes.
- If MFA or a provider challenge appears, stop that provider, record the blocker, and continue the remaining providers.

## Provider Map

| Provider      | Billing surface                                                                    | Login/navigation notes                                                                                                                                                                                                                                                | Monthly import rule                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kie.ai        | `https://kie.ai/billing`                                                           | The visual login UI is misleading: the first option is Google login, even when it looks like an email entry/button. It will likely already show the owner's email; click that first option/entry field to continue with Google. The second option is Microsoft login. | Import paid credit purchases/invoices in the target month; keep credits/units when visible.                                                                              |
| fal.ai        | `https://fal.ai/dashboard/usage-billing/invoices`                                  | Use the logged-in billing invoices/receipts area. Receipt/payment rows are the money-movement source when invoice rows would double-count.                                                                                                                            | Import paid receipt/payment rows; do not double-count invoice rows for the same payment.                                                                                 |
| OpenAI        | `https://platform.openai.com/settings/organization/billing/history`                | Use platform billing history. Respect the retained OpenAI start-date rule unless the owner overrides it in the current run.                                                                                                                                           | Import paid invoices in the target month.                                                                                                                                |
| ElevenLabs    | `https://elevenlabs.io/app/subscription/invoices`                                  | Recent rows may hide the year. Preserve owner-confirmed year/cutoff assumptions in notes when needed.                                                                                                                                                                 | Import paid invoices in the target month, including zero-dollar paid invoices when they are part of the sequence.                                                        |
| Codex/ChatGPT | `https://chatgpt.com/#settings/Billing`                                            | Open Settings > Billing > invoice list if the direct hash does not land in the billing modal.                                                                                                                                                                         | Import paid ChatGPT/Codex invoice rows in the target month.                                                                                                              |
| Supabase      | `https://supabase.com/dashboard/org/aettteppbagwsszkrgde/billing`                  | Use the `Sleepy Sea Monster` org billing page and page through past invoices.                                                                                                                                                                                         | Import paid invoices in the target month, including zero-dollar paid invoices when they are part of the sequence.                                                        |
| Vercel        | `https://vercel.com/kirk-artmans-projects/~/settings/invoices`                     | Use team/project invoices. Usage estimates are not actuals until invoiced/paid.                                                                                                                                                                                       | Import paid invoices only; exclude upcoming estimated invoices.                                                                                                          |
| Stripe        | `https://dashboard.stripe.com/acct_1Sz02nHutZQpiTlZ/balance/payments/transactions` | Prefer Balance activity because it shows gross, fee, and net. Use the owner-supplied testing email list from the local credential/source file for classification, but do not retain those emails in repo docs.                                                        | Payments from the known testing emails are testing expenses. Payments from any other email are real customer revenue. Exclude payouts, top-ups, and automatic transfers. |

## Monthly Checklist

1. Load Badu SOP, memory, and this map.
2. Open the active `ShortPulse Finances` workbook and identify the current final `Ledger` row.
3. For each expense provider, collect the previous completed month's paid invoices/receipts.
4. For Stripe, collect the previous completed month's posted Balance activity:
   - real customer payments as income,
   - Stripe fees as expense,
   - known testing-email payments as testing expense,
   - tied test refunds as negative testing expense,
   - payouts/top-ups/transfers excluded.
5. Build rows in the 19-column ledger shape.
6. Check for duplicates by provider, date, amount, and invoice/payment id.
7. Update `Ledger`, `Source_Log`, and `Audit_Status` only where concrete gaps exist.
8. Verify dashboard totals, provider summary, monthly summary, row count, blank-source count, fee gaps, and ledger math.
9. Close out with rows changed, provider totals, workbook total impact, blockers, and timing gaps.
