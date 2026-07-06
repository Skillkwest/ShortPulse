# Maya Report: I Understand My Renewal, But Not My Credit Usage History

Date: 2026-07-06
Scenario: Credits and renewal confidence.
UGC project goal: Tiny Apartment Reset Kit ladder step 7, decide whether ShortPulse feels safe enough for a weekly creator workflow.
Session duration: about 35 minutes including reporting.
Credits spent: 0
Run status: completed with a credit-history clarity concern

## My Quick Scores

| Metric                    | Value      | Notes                                                                                       |
| ------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| Navigation confidence     | `4/5`      | I found Credits, Subscription, Transactions, Account, and Dashboard from normal navigation. |
| Credit anxiety            | `2/5`      | The renewal information helped, but I still cannot audit what used credits.                 |
| Spend readiness           | `2/5`      | I would spend carefully, but not heavily, until credit usage history is clearer.            |
| Save confidence           | `4/5`      | Account showed autosave is ON, which helps explain why my images saved.                     |
| Renewal confidence        | `4/5`      | I can see the next renewal date and incoming monthly credits.                               |
| Credit-history confidence | `2/5`      | I do not see the two image-generation debits anywhere obvious.                              |
| Review risk               | `moderate` | This is not a blocker, but it would become a support question if I kept spending.           |

## Customer Journey Snapshot

| Journey moment        | My customer read                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting intent       | I wanted to understand my balance and whether anything would renew or charge me.                                                                    |
| First confidence lift | AI Studio showed `342 / 350`, which matched what I expected after two images.                                                                       |
| First doubt/friction  | Account Settings had several billing-adjacent choices, so I was careful not to click anything that could buy, cancel, or upgrade.                   |
| Trust win             | Credits showed Starter, `$15/month`, available balance `342`, next renewal `Aug 4, 2026`, and incoming `+350`.                                      |
| Trust break           | Credit Activity said `No recent billing events yet`, and Transactions only showed the subscription payment, not the image-generation credit debits. |
| End decision          | I would keep using the app cautiously, but I would not spend a lot of credits until I can audit where credits went.                                 |

## What I Tried

I started in AI Studio because that is where I had been working. The header still showed `342 / 350`, which made me feel like the app remembered my balance correctly.

Then I opened Account Settings. The menu had Billing, Subscription, Credits, Storage, Transactions, Report an issue, and Log out. I chose Credits first because it sounded like the safest place to answer my question.

The Credits page was mostly helpful. It showed:

- Plan: Starter
- Payment: `$15.00 / month`
- Credits: `342 / 350`
- Available balance: `342`
- Next renewal: `Aug 4, 2026`
- Incoming credits: `+350`
- top-up packages starting at 100 credits

That answered my biggest renewal question. I know I should get `+350` credits on `Aug 4, 2026`.

But the same page had `Credit Activity` and said `No recent billing events yet.` That confused me. I spent 4 credits on one image and 4 credits on another image, so I expected some kind of usage history. Maybe this area only means billing events, but then I would not call it Credit Activity.

I also checked Subscription. That page clearly showed Starter, `$15/month`, next renewal, monthly credits, storage, and one active image generation at a time. I did not click upgrade, cancel, or billing management.

Then I checked Transactions. It showed the initial subscription payment, but not my credit usage for image generation.

Account settings also showed Media Library autosave is ON. That was actually helpful because it explains why my generated images saved automatically.

## What Felt Clear

- My current balance is `342 / 350`.
- My current plan is Starter.
- Starter is `$15.00 / month`.
- I get `350` monthly credits.
- The next renewal is `Aug 4, 2026`.
- Incoming credits are shown as `+350`.
- Top-ups are one-time purchases.
- Media Library autosave is ON.

## What Felt Unclear

- I could not find a usage ledger for the two image generations.
- `Credit Activity` says no recent billing events, which sounds like maybe it is not actually credit activity.
- Transactions explain subscription billing but not credit spending.
- The account menu has Billing, Subscription, Credits, and Transactions, which are all useful but a little overlapping.
- I would not know how to prove to myself that the two image generations cost exactly 8 credits except by remembering the before/after balance.

## Product Decision Signal

- `Trust`: Renewal and balance clarity are strong; usage-history clarity is weak.
- `Retention`: I would come back, but I would spend cautiously because I cannot audit usage.
- `Support`: I would contact support if my balance changed unexpectedly because I cannot self-serve the answer.
- `Revenue/Credits`: Top-ups are visible, but I would hesitate to buy more credits without a usage ledger.
- `Launch readiness`: Acceptable for basic plan clarity, but credit-history visibility should improve before heavier creator workflows.

## Customer Service Simulation

Support email I might send:

```text
Hi, I can see that my account has 342/350 credits and renews on Aug 4, but I cannot find where my two image generations used credits. The Credits page says there are no recent billing events, and Transactions only shows my subscription payment. Is there a place where I can see credit usage by generation?
```

Bad review / public complaint risk:

```text
ShortPulse shows your balance, but not what used your credits. If I am supposed to build real creator workflows here, I need a clear credit history.
```

What would calm me down:

- A visible credit usage ledger with date, workflow/model, project or media item, and credit amount.
- Clear copy that separates subscription payments, top-up purchases, and generation credit debits.
- A support answer that says exactly where image-generation credit usage is logged.

## What I Would Do Next

I would continue cautiously. I would not cancel, and I would probably still use my remaining credits for small image tests, but I would not buy a top-up or move to a higher plan until I can see generation-level credit history.

## Issue Tags

- `credit-confidence`
- `credit-history`
- `billing-clarity`
- `support-risk`
- `retention`
- `creator-workflow`

## Evidence

- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-credits-renewal-confidence/01-ai-studio-credit-balance.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-credits-renewal-confidence/03-credits-surface.png`

## Admin Publish Status

Published to Agent Tester Reports at `/admin/tester-reports`.

- External run id: `2026-07-06-credits-renewal-confidence`
- Status: `completed`
- Publish method: internal tester-report ingest handler
- Verification: production `tester_report_runs` row exists with both report bodies
