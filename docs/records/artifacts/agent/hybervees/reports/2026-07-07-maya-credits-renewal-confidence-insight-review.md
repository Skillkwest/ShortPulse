# Hybervees Insight Review: Maya Credits Renewal Confidence

## Review Metadata

- Date: 2026-07-07
- Reviewer: Hybervees
- Report source: production `tester_report_runs` row plus local tester artifacts
- Source freshness: tester run created in production Admin Tester Reports on 2026-07-06; reviewed by Hybervees on 2026-07-07
- Reports reviewed:
  - `docs/agents/testers/maya-chen/reports/2026-07-06-credits-renewal-confidence-maya-report.md`
  - `docs/agents/testers/maya-chen/reports/2026-07-06-credits-renewal-confidence-engineering-handoff.md`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-06-credits-renewal-confidence/evidence-manifest.md`
  - `docs/agents/testers/maya-chen/workspace/notes/2026-07-06-credits-renewal-confidence-live-notes.md`
- Tester: Maya Chen
- Scenario: understand remaining credits, renewal timing, and recent credit usage
- Production surface: `https://www.shortpulse.ai/profile?section=credits` plus AI Studio header, Subscription, Transactions, Account, and Dashboard observations
- Evidence boundary: Hybervees used the production admin row identified by `hybervees:next-report`, local report bodies, live notes, screenshot inspection, and targeted source inspection of the Profile Credits surface. I did not run fresh production browser validation or inspect Maya's private database rows.

## Executive Read

Short answer: ShortPulse passes basic credit and renewal trust. Maya saw `342 / 350` in AI Studio, saw Starter plan details, saw next renewal `Aug 4, 2026`, and saw incoming `+350` monthly credits.

Highest-ROI product decision: add a customer-visible generation credit usage ledger or a clear link to one from `/profile?section=credits`. The current Credits surface shows credit balance and top-ups, but the "Recent credit activity" area is sourced like billing/purchase activity and says `No recent billing events yet`, so Maya cannot reconcile the two 4-credit image debits.

Main confidence limit: this is the first dedicated Maya credits/renewal report. The finding is still strong because it matches the screenshot and targeted source inspection: customer-visible credit history currently favors Stripe/top-up billing events, while generation debit visibility is not obvious.

## Reports Reviewed

| Run id or path                          | Tester    | Scenario                       | Status    | Surface                     | Notes                                                       |
| --------------------------------------- | --------- | ------------------------------ | --------- | --------------------------- | ----------------------------------------------------------- |
| `2026-07-06-credits-renewal-confidence` | Maya Chen | Credits and renewal confidence | completed | Profile Credits / AI Studio | Earliest unreviewed Admin Tester Reports row at review time |

## Top Insights

| Priority | Surface                                    | Theme                            | Insight                                                                                                                                                                                               | Evidence                                                                                                                                                                                                                              | Impact        | Confidence  |
| -------- | ------------------------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------- |
| Positive | AI Studio / Profile Credits / Subscription | Credit balance and renewal trust | The app clearly communicates current balance, plan, monthly price, next renewal, and incoming monthly credits.                                                                                        | AI Studio screenshot shows `342 / 350`; Credits screenshot shows Starter, `$15.00 / month`, balance `342`, next renewal `Aug 4, 2026`, and incoming `+350`.                                                                           | High positive | High        |
| P1       | `/profile?section=credits`                 | Credit usage transparency        | Maya cannot audit which generations consumed credits. The visible "Credit Activity" area reads as credit history but only reports billing events, so generation debits are invisible to the customer. | Credits page screenshot shows `Recent credit activity` and `No recent billing events yet`; source inspection shows `ProfileCreditsSection` renders billing activity and `CUSTOMER_CREDIT_ACTIVITY_SOURCES` is only `stripe_checkout`. | High          | High        |
| P2       | `/profile?section=transactions`            | Billing vs usage model           | Transactions are useful for subscription payments, but they do not answer generation credit usage. That is acceptable if Credits owns usage history, but confusing if neither surface does.           | Persona and engineering reports say Transactions showed subscription payment only.                                                                                                                                                    | Medium        | Medium-high |
| P3       | Account Settings nav                       | Overlapping billing labels       | Billing, Subscription, Credits, and Transactions are all plausible places to answer money questions. Maya navigated successfully but cautiously.                                                      | Persona report describes careful navigation and fear of clicking charge/change controls.                                                                                                                                              | Medium-low    | Medium      |

## Customer Feeling And Understanding

What Maya appeared to believe:

Maya believed ShortPulse is honest about the current balance and renewal, but not yet transparent enough about how credits were spent. She would keep using the app carefully, but would hesitate to buy top-ups or spend heavily.

What created trust:

- AI Studio and account surfaces agreed on `342 / 350`.
- The Credits page named Starter, `$15.00 / month`, available balance, renewal date, and incoming credits.
- Top-ups were clearly labeled as one-time purchases.
- Account settings showed Media Library autosave ON, which helped explain why generated images saved.

What reduced trust:

- `Recent credit activity` did not show the two image generation debits.
- The empty-state copy said `No recent billing events yet`, which sounds like billing history rather than credit usage history.
- Transactions showed payment history, not generation usage.
- Maya had to rely on memory of before/after balances to explain the missing 8 credits.

Where Maya hesitated:

She hesitated around billing-adjacent navigation and deliberately avoided upgrade, cancel, billing portal, top-up, and generation actions. The issue was not inability to navigate; it was lack of self-serve proof after she reached the right page.

Where Maya might abandon or ask for support:

If her balance changes unexpectedly, she would likely contact support because she cannot answer "what used my credits?" herself. That is support load and revenue friction: the top-up cards are visible, but purchase confidence drops when usage is not auditable.

What felt valuable:

The renewal display is doing real trust work. The monthly credit promise is concrete, dated, and easy to understand.

What felt like wasted time, effort, or credits:

No credits were wasted in this run. The risk is future-facing: without generation-level usage history, Maya treats every future credit spend as something she must remember manually.

## Engineering Follow-Up Candidates

| Candidate                                                                                       | Evidence                                                                                                                                         | Suspected owner lane       | Next proof                                                                                                                  | Confidence  |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Add customer-visible generation debit history to Profile Credits                                | Customer page says recent credit activity but no generation debits; `CUSTOMER_CREDIT_ACTIVITY_SOURCES` currently includes only `stripe_checkout` | Money Stuff / Nogo / D-Bug | Inspect safe customer-facing `ai_credit_ledger` read contract and display recent `generation_charge` rows with human labels | High        |
| Rename or split the current billing activity block if generation usage is not added immediately | Empty copy says billing events inside a credit activity area                                                                                     | Abismia / Money Stuff      | Credits page copy clearly separates "credit purchases" from "credit usage"                                                  | Medium-high |
| Keep Transactions focused on payments/invoices                                                  | Maya expected Transactions might show usage, but payment history is a valid separate surface                                                     | Money Stuff / Abismia      | Transactions page labels payment history clearly and links back to Credits usage if needed                                  | Medium      |

## Product Decision Candidates

| Decision                                                         | Why it matters                                                                        | Evidence strength                                                  | Owner lane                           | Recommendation                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------ | ----------------------------------------------- |
| Add a customer-visible credit usage ledger for generation debits | Credit spend transparency increases top-up confidence and reduces support questions   | Strong single dedicated report plus screenshot/source confirmation | Money Stuff / Nogo / D-Bug / Abismia | Recommended as a focused backlog item           |
| Preserve current balance and renewal clarity                     | These surfaces already reduce anxiety and should not regress during usage-ledger work | Strong positive proof                                              | Money Stuff / Nogo                   | Include as non-regression criteria              |
| Do not broaden this into a full billing navigation redesign yet  | Maya found the right surfaces; the sharper failure is missing usage evidence          | Medium                                                             | Abismia / Money Stuff                | Watch for repeat reports before expanding scope |

## Patterns Versus One-Offs

Repeated or likely recurring:

- Maya's spend confidence depends on both pre-spend cost clarity and post-spend auditability.
- Credit balance display is valuable when it stays consistent across AI Studio and Profile.
- Customer-visible money surfaces need clear separation between subscription payments, top-up purchases, and generation usage.

One-off or not enough evidence yet:

- Full account navigation restructuring is not justified from this report alone.
- The report does not prove backend ledger loss. It proves the customer cannot see generation debits from the current surface.

What not to overreact to:

- Do not change credit pricing, renewal policy, expiration policy, top-up packaging, subscription plan behavior, or payment semantics from this report.
- Do not expose raw service-role ledger data, provider metadata, internal reservation states, or sensitive references.
- Do not clutter Transactions with every generation event if Credits becomes the clear usage surface.

## Missing Proof

- Safe customer-facing contract for generation debit rows, including what metadata may be shown.
- Whether current `ai_credit_ledger` rows for Maya's two image generations contain enough human-readable workflow/model/project/media metadata.
- Current production validation after any implementation: balance, renewal, top-ups, usage history, and Transactions must remain understandable without spending credits.

## Next Actions

1. Add one focused Program 1 backlog item for customer-visible generation credit usage history.
2. Keep the broad credit-education notes deferred; this report supports a narrower ledger/auditability fix.
3. Preserve balance and renewal clarity as non-regression criteria for any billing/credits implementation lane.
