# Ledger Training History

Purpose: record supervised Ledger runs, learned behavior, SOP/template updates, tool changes, remaining friction, and next training focus.

## 2026-05-13: Agent Setup

Task: establish Ledger as the ShortPulse commerce billing steward.

Prompt summary:

```text
Lets synthesize this into your own folder in the repo... create your memory.md and other supporting docs so we can begin to train you to perform better over time.
```

Actions taken:

- Loaded the repo startup contract and core docs.
- Loaded the agent-teaching setup and maintenance references.
- Audited the existing agent package patterns already used in the repo.
- Loaded the billing SOP, billing pricing catalog doc, billing ADRs, and billing route inventory.
- Created Ledger's contract, repo-visible memory, source-of-truth map, and retained artifact area.
- Indexed Ledger in the main agent docs and retained-artifact indexes.

Training result:

- Ledger is initialized at `Level 1: Supervised`.
- Ledger now has a durable billing scope, memory surface, and initial training area.

Next training focus:

- Run Ledger on a real subscriptions/credits/storage billing task.
- Freeze a baseline KPI after a few more supervised billing runs.
- Add a dated report template after the first major billing audit or end-to-end Stripe walkthrough.

## 2026-05-13: First Real Subscription Truth-Alignment Run Backfilled

Task: absorb the completed subscription truth-alignment lane into Ledger's durable operating memory.

Actions taken:

- Backfilled a retained run report for the recurring subscription truth-alignment lane.
- Captured the successful execution order across:
  - public truth,
  - support/runtime safety,
  - post-purchase sync,
  - annual renewal verification.
- Added Ledger's first reusable run report template.
- Preserved the main remaining blockers:
  - real Stripe test-mode walkthrough,
  - integrated automated subscription funnel test,
  - stronger production annual-renewal verification.

Training result:

- Ledger now has its first real supervised billing run in retained form.
- Ledger's artifact area now contains both a report template and one substantive recurring-commerce report.

Next training focus:

- Run Ledger on a real credit-package or storage add-on lane.
- Decide whether Ledger now needs a scoring rubric before the next major billing pass.
- Freeze a baseline KPI after a few more stable runs.

## 2026-05-13: First One-Time-Commerce Audit Captured

Task: train Ledger on the credit-package lane and capture the first one-time-commerce lesson.

Actions taken:

- Audited credit-package catalog, checkout, webhook grant, and unified transaction-history surfaces.
- Preserved the first concrete one-time-commerce finding:
  - historical credit-purchase history can drift when package name/price falls back to the current mutable catalog.
- Recorded the lower-risk observation that `/api/billing/credit-packages` is a duplicated read model relative to `/api/billing/catalog`.

Training result:

- Ledger now has supervised retained history for both:
  - recurring commerce,
  - one-time commerce.
- Ledger's first clear one-time-commerce implementation target is now defined.

Next training focus:

- Fix the historical credit-purchase snapshot drift.
- Then run Ledger on the storage add-on lane.
- Reassess after that whether a rubric or baseline KPI is justified.

## 2026-05-13: First One-Time-Commerce Fix Completed

Task: implement the historical credit-purchase snapshot fix identified by Ledger's one-time-commerce audit.

Actions taken:

- Preserved historical package name and price snapshots in:
  - top-up checkout metadata,
  - webhook ledger grant metadata.
- Updated unified billing history fallback to prefer:
  - live Stripe session truth,
  - then historical ledger snapshot,
  - then current catalog row.
- Added targeted regression coverage for checkout, webhook, and historical transaction fallback.

Training result:

- Ledger has now completed both:
  - one-time-commerce audit,
  - one-time-commerce implementation.
- Ledger's first one-time-commerce implementation pattern is now durable and reusable.

Next training focus:

- Run Ledger on the storage add-on lane.
- Then decide whether Ledger has enough repeated patterns to justify a rubric or baseline KPI.

## 2026-05-13: First Storage Add-On Fix Completed

Task: implement the first concrete storage add-on billing fix uncovered during Ledger's recurring add-on audit.

Actions taken:

- Audited the self-serve recurring storage add-on mutation route, profile storage surface, storage payment-history route, and webhook projection logic.
- Hardened storage add-on purchases to fail closed by sending Stripe `payment_behavior=error_if_incomplete`.
- Added duplicate protection against webhook lag by checking live Stripe subscription items before adding a recurring storage item.
- Added targeted regression coverage for the storage mutation route and reran the adjacent profile/history tests.

Training result:

- Ledger has now completed implementation runs in:
  - subscriptions,
  - credit packages,
  - storage add-ons.
- Ledger's first recurring add-on lesson is now durable:
  - direct recurring upsell flows must validate against live Stripe truth, not just local mirrored rows.

Next training focus:

- Run a real Stripe test-mode walkthrough for top-ups and recurring storage if approval is available.
- Reassess whether Ledger now has enough repeated patterns to justify a rubric, reconciliation checklist, or baseline KPI.
