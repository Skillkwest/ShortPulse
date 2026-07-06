# Engineering Handoff: Credits And Renewal Confidence

Date: 2026-07-06
Tester: Maya Chen
Scenario: Credits and renewal confidence.
UGC project goal: Tiny Apartment Reset Kit ladder step 7, decide whether ShortPulse feels safe enough for a weekly creator workflow.
Production surface: `https://www.shortpulse.ai`, `/ai-studio`, `/profile`
Session duration: about 35 minutes including reporting.
Credits spent: 0
Run status: completed with credit-history clarity concern

## Summary

Maya successfully found current plan, balance, renewal, and incoming monthly credit information through customer-visible account navigation. AI Studio, Dashboard, Credits, Subscription, and Account surfaces consistently showed the Starter plan and `342 / 350` credits. The Credits page showed next renewal `Aug 4, 2026` and incoming credits `+350`.

Decision impact: ShortPulse gives enough balance/renewal clarity for basic trust, but it does not give Maya a visible generation-level credit usage ledger, which creates support risk and makes future credit purchases/upgrades feel less safe.

## Validation Boundary

- Proved in production Chrome as Maya.
- No credits were spent.
- No billing/subscription/account settings were changed.
- Screenshots with account email, invoice/reference details, or account greetings were discarded.
- Database state and hidden credit ledgers were intentionally not inspected during the live customer journey.
- Admin publish verified after local report completion.

## Human Behavior Metrics

| Metric                             | Value                                          | Notes                                                                      |
| ---------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| Time to first balance confirmation | `<1 min after AI Studio restore`               | AI Studio header showed `342 / 350`.                                       |
| Time to renewal confidence         | `~7 min`                                       | Credits page showed next renewal and incoming credits.                     |
| Clarifying question count          | `6`                                            | Balance, renewal, top-ups, usage history, transactions, autosave.          |
| Backtrack/recovery count           | `1`                                            | The Credits text appeared in two places; Maya chose the account menu item. |
| Credit anxiety                     | `2/5`                                          | Renewal is clear, usage history is not.                                    |
| Spend readiness                    | `2/5`                                          | Maya would continue small tests but not buy top-ups confidently.           |
| Customer support risk              | `medium`                                       | Likely support question: where can I see generation credit usage?          |
| Retention risk                     | `medium`                                       | Maya may keep using but hesitate to spend or upgrade.                      |
| Product decision signal            | `credit-confidence / support-risk / retention` | Improve usage transparency before heavier creator usage.                   |
| Repeat finding                     | `no`                                           | This is the first dedicated Maya credits/renewal confidence run.           |

## Reproduction Steps

1. Open a fresh real Google Chrome window.
2. Navigate to `https://www.shortpulse.ai/ai-studio?projectId=0cc5e653-de94-42ad-b42b-d984ffc27d4e`.
3. Sign in as Maya if prompted.
4. Confirm AI Studio header shows `CREDITS 342 / 350`.
5. Open Account Settings.
6. Choose `Credits` from the account menu.
7. Observe Credits page:
   - Plan: Starter
   - Payment: `$15.00 / month`
   - Credits: `342 / 350`
   - Available balance: `342`
   - Next renewal: `Aug 4, 2026`
   - Incoming credits: `+350`
   - Top-up package cards
   - `Credit Activity` says `No recent billing events yet`
8. Open `Subscription`.
9. Observe Starter current plan, monthly price, renewal date, monthly credits, storage, and concurrent generation info.
10. Open `Transactions`.
11. Observe subscription payment history but no generation-level credit debit rows.
12. Open `Account`.
13. Observe Media Library autosave ON.
14. Return to Dashboard.
15. Observe dashboard-level AI Credits `342 / 350` and Plan Starter.

## Expected Behavior

Maya expected to answer three customer questions without support:

- How many credits do I have?
- When do my monthly credits renew?
- Where did my recent image-generation credit debits go?

The first two questions were answered. The third was not answered by the visible customer-facing surfaces.

## Actual Behavior

Balance, current plan, monthly credits, payment amount, renewal date, and top-up options were visible. Credit usage history for the two image generations was not visible in Credits or Transactions. The Credits page label `Credit Activity` currently pairs with `No recent billing events yet`, which reads like billing-event history rather than usage/debit history.

## Findings

### Finding 1: Balance and renewal information are clear

Severity: positive

Issue tags: `credit-confidence`, `subscription`, `renewal`, `positive`

Observed behavior:

- AI Studio and Dashboard showed `342 / 350`.
- Credits showed available balance `342`, next renewal `Aug 4, 2026`, and incoming `+350`.
- Subscription showed Starter, `$15.00 / month`, monthly credits `350`, storage `5 GB`, and one active image generation at a time.

Protected behavior:

- Preserve visible balance consistency across AI Studio, Dashboard, Credits, and Subscription.
- Preserve clear renewal and incoming-credit display.

### Finding 2: Credit usage history is not customer-visible for generation debits

Severity: credit or billing risk / trust damage

Issue tags: `credit-confidence`, `credit-history`, `billing-clarity`, `support-risk`, `retention`

Customer risk:

- Maya cannot audit how her `342 / 350` balance was reached.
- If the balance changes unexpectedly, she must contact support instead of self-serving the answer.
- Top-up purchase confidence is lower because she cannot see generation debit history.

Visible customer question:

- "Where can I see which generations used credits?"

Observed behavior:

- Credits page showed `Credit Activity` but said `No recent billing events yet`.
- Transactions page showed subscription payment history but no generation usage/debit rows.

#### Fix Packet: Customer-visible credit usage history

- Issue tags: `credit-confidence`, `credit-history`, `billing-clarity`, `support-risk`, `retention`
- Repeat finding: `no`
- Customer impact: Maya can see her balance but cannot audit what consumed credits.
- Product decision impact: trust / support / credits / retention
- Suspected owning surface: `/profile?section=credits`, `/profile?section=transactions`, credit ledger display components.
- Likely source boundary: unknown from live customer testing; likely account/profile credits UI plus server credit ledger read path.
- Canonical fix expectation: Customer-facing account surfaces distinguish subscription/top-up billing events from generation credit debits and show enough usage history to reconcile balance changes.
- Acceptance criteria:
  - Credits page shows recent generation debits or links to a usage ledger.
  - At least the two Maya image generations can be understood as two 4-credit debits from a customer-visible surface after reload.
  - Subscription payment history remains separate from generation usage history.
  - Top-up purchase cards remain informational until the customer deliberately chooses to buy.
- Validation steps:
  - In a fresh Chrome session, sign in as Maya and open Credits.
  - Confirm current balance and renewal still render.
  - Confirm recent generation debits are visible or clearly linked.
  - Open Transactions and confirm subscription/top-up billing history remains understandable.
  - Do not spend credits or change billing during validation.
- Protected behavior:
  - Do not regress visible `342 / 350` balance display, next renewal, incoming credits, plan name, or top-up package clarity.
  - Do not expose private service-role data, raw provider metadata, or internal-only ledger labels to customers.
- Stop/escalation condition:
  - Stop before changing billing semantics, credit expiration/rollover policy, top-up pricing, subscription renewal behavior, or refund/credit adjustment policy without product approval.

### Finding 3: Billing-adjacent navigation is useful but overlapping

Severity: workflow confusion

Issue tags: `billing-clarity`, `account-settings`, `support-risk`

Customer risk:

- Billing, Subscription, Credits, and Transactions are all reasonable places to answer credit questions.
- Maya can find the answer eventually, but the overlap may create support questions.

Suggested investigation:

- Clarify labels or cross-links so customers know:
  - Credits = balance, renewal, top-ups, usage.
  - Subscription = plan, renewal, upgrade/cancel.
  - Transactions = payments/invoices.
  - Account = identity, billing portal, autosave/security.

## Issue Pattern And Prior Reports

This is the first dedicated Maya credits/renewal report. It connects to earlier credit-spend runs:

- Prior report: `docs/agents/testers/maya-chen/reports/2026-07-04-fresh-signup-payment-image-generation-maya-report.md`
- Prior report: `docs/agents/testers/maya-chen/reports/2026-07-05-second-image-variant-maya-report.md`
- Current run adds: return-session account-surface proof that balance and renewal are visible, but generation debit history is not visible from Credits/Transactions.
- Do not keep re-proving unless: credit surfaces change, generation spending changes, or user asks for billing/credit regression testing.

## Evidence

- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-credits-renewal-confidence/01-ai-studio-credit-balance.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-credits-renewal-confidence/03-credits-surface.png`

## Non-Goals

- No generation.
- No credit spend.
- No top-up purchase.
- No subscription upgrade, cancellation, or billing portal action.
- No account email/password/profile changes.
- No direct database/API inspection during the live customer journey.

## Admin Publish Status

- Status: published
- External run id: `2026-07-06-credits-renewal-confidence`
- Admin tab verification: production `tester_report_runs` row verified after ingest; row has status `completed`, `credits_spent` 0, both report bodies, artifact paths, and evidence payload
- Notes: Published through the internal tester-report ingest handler after local report completion.

## Baseline Comparison

Run: Credits And Renewal Confidence
Date: 2026-07-06
Compared against: `baseline-kpi-2026-07-05.md`

Overall score: `9.1`
Delta from baseline: `+0.7`

Categories improved:

- Report intelligence sections are present before Admin publishing.
- Screenshot discipline improved by discarding account-identifying/billing-detail screenshots.

Categories degraded:

- Browser duration was shorter than 45 minutes because the no-spend account scenario reached its stop condition quickly.

Non-negotiable fail conditions triggered:

- None.

What changed in Maya's behavior:

- Maya stayed cautious around billing-adjacent controls and avoided all account mutations.

Correction to carry into next run:

- For billing/credit runs, keep evidence to sanitized balance/credit pages and summarize sensitive billing surfaces without screenshots.

## Maya Self-Audit Summary

- Persona fidelity: 9
- Human realism: 9
- Question-first behavior: 9
- Natural customer navigation: 9
- Credit discipline: 10
- Evidence quality: 9
- Behavior metrics quality: 9
- Report usefulness: 10
- Admin publish completion: 9
- Workspace memory hygiene: 9
- Stop/resume discipline: 9
- Overall: 9.1
- Coach question answer: I stayed customer-like during the live run because Maya's actions were normal account-navigation steps. I became slightly tester-like while trimming screenshots, but that improved privacy and evidence quality rather than changing the customer findings.
