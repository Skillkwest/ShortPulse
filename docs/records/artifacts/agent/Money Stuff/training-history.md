# Money Stuff Training History

Purpose: record supervised Money Stuff runs, learned behavior, SOP/template updates, tool changes, remaining friction, and next training focus.

## 2026-05-13: Agent Setup

Task: establish Money Stuff as the ShortPulse commerce billing steward.

Prompt summary:

```text
Lets synthesize this into your own folder in the repo... create your memory.md and other supporting docs so we can begin to train you to perform better over time.
```

Actions taken:

- Loaded the repo startup contract and core docs.
- Loaded the agent-teaching setup and maintenance references.
- Audited the existing agent package patterns already used in the repo.
- Loaded the billing SOP, billing pricing catalog doc, billing ADRs, and billing route inventory.
- Created Money Stuff's contract, repo-visible memory, source-of-truth map, and retained artifact area.
- Indexed Money Stuff in the main agent docs and retained-artifact indexes.

Training result:

- Money Stuff is initialized at `Level 1: Supervised`.
- Money Stuff now has a durable billing scope, memory surface, and initial training area.

Next training focus:

- Run Money Stuff on a real subscriptions/credits/storage billing task.
- Freeze a baseline KPI after a few more supervised billing runs.
- Add a dated report template after the first major billing audit or end-to-end Stripe walkthrough.

## 2026-05-13: First Real Subscription Truth-Alignment Run Backfilled

Task: absorb the completed subscription truth-alignment lane into Money Stuff's durable operating memory.

Actions taken:

- Backfilled a retained run report for the recurring subscription truth-alignment lane.
- Captured the successful execution order across:
  - public truth,
  - support/runtime safety,
  - post-purchase sync,
  - annual renewal verification.
- Added Money Stuff's first reusable run report template.
- Preserved the main remaining blockers:
  - real Stripe test-mode walkthrough,
  - integrated automated subscription funnel test,
  - stronger production annual-renewal verification.

Training result:

- Money Stuff now has its first real supervised billing run in retained form.
- Money Stuff's artifact area now contains both a report template and one substantive recurring-commerce report.

Next training focus:

- Run Money Stuff on a real credit-package or storage add-on lane.
- Decide whether Money Stuff now needs a scoring rubric before the next major billing pass.
- Freeze a baseline KPI after a few more stable runs.

## 2026-05-13: First One-Time-Commerce Audit Captured

Task: train Money Stuff on the credit-package lane and capture the first one-time-commerce lesson.

Actions taken:

- Audited credit-package catalog, checkout, webhook grant, and unified transaction-history surfaces.
- Preserved the first concrete one-time-commerce finding:
  - historical credit-purchase history can drift when package name/price falls back to the current mutable catalog.
- Recorded the lower-risk observation that `/api/billing/credit-packages` is a duplicated read model relative to `/api/billing/catalog`.

Training result:

- Money Stuff now has supervised retained history for both:
  - recurring commerce,
  - one-time commerce.
- Money Stuff's first clear one-time-commerce implementation target is now defined.

Next training focus:

- Fix the historical credit-purchase snapshot drift.
- Then run Money Stuff on the storage add-on lane.
- Reassess after that whether a rubric or baseline KPI is justified.

## 2026-05-13: First One-Time-Commerce Fix Completed

Task: implement the historical credit-purchase snapshot fix identified by Money Stuff's one-time-commerce audit.

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

- Money Stuff has now completed both:
  - one-time-commerce audit,
  - one-time-commerce implementation.
- Money Stuff's first one-time-commerce implementation pattern is now durable and reusable.

Next training focus:

- Run Money Stuff on the storage add-on lane.
- Then decide whether Money Stuff has enough repeated patterns to justify a rubric or baseline KPI.

## 2026-05-13: First Storage Add-On Fix Completed

Task: implement the first concrete storage add-on billing fix uncovered during Money Stuff's recurring add-on audit.

Actions taken:

- Audited the self-serve recurring storage add-on mutation route, profile storage surface, storage payment-history route, and webhook projection logic.
- Hardened storage add-on purchases to fail closed by sending Stripe `payment_behavior=error_if_incomplete`.
- Added duplicate protection against webhook lag by checking live Stripe subscription items before adding a recurring storage item.
- Added targeted regression coverage for the storage mutation route and reran the adjacent profile/history tests.

Training result:

- Money Stuff has now completed implementation runs in:
  - subscriptions,
  - credit packages,
  - storage add-ons.
- Money Stuff's first recurring add-on lesson is now durable:
  - direct recurring upsell flows must validate against live Stripe truth, not just local mirrored rows.

Next training focus:

- Run a real Stripe test-mode walkthrough for top-ups and recurring storage if approval is available.
- Reassess whether Money Stuff now has enough repeated patterns to justify a rubric, reconciliation checklist, or baseline KPI.

## 2026-05-30: AI Usage Billed-Credit Authority Migration Planning

Task: convert the new admin-priced billed-credit authority decision into the smallest durable migration plan that can safely guide implementation.

Actions taken:

- Audited the repo planning-governance rules before creating a new planning artifact.
- Chose a retained Money Stuff report instead of a top-level planning program so the plan stays durable without creating unnecessary planning sprawl.
- Wrote a compact master migration plan for AI usage billed-credit authority cutover.
- Locked the lane order:
  - Create
  - Edit
  - Video
  - Sound
- Locked the invariant that display, guardrail, submit metadata, server debit, and observability must switch together for each lane.

Training result:

- Money Stuff now has a reusable migration posture for cross-system billing-authority replacements:
  - one compact master plan,
  - lane-by-lane execution,
  - no isolated display-only cutovers.

Next training focus:

- Build the Create-only implementation plan from the compact master plan.
- Define the exact canonical Create variant lookup key before any code migration starts.

## 2026-05-30: Create Lane Billing-Authority Cutover Plan

Task: turn the compact billed-credit migration plan into an executable Create-only cutover plan before implementation begins.

Actions taken:

- Audited the real Create pricing consumers across:
  - button display,
  - model picker chips,
  - agent-output Create actions,
  - guardrail/optimistic debit,
  - submit metadata,
  - server debit.
- Confirmed Create is not a single priced operation:
  - standard Create can remain text-to-image,
  - Create can silently become edit-priced when references or masks are present,
  - Character Mode can remap Create onto paired edit models.
- Locked the minimum Create canonical priced key:
  - surface
  - workflow
  - operation
  - model id
  - aspect
  - resolution
  - input image count
  - input fidelity
  - mask present
- Locked the Create fail-closed rule and the exact proof gate needed before calling the lane migrated.

Training result:

- Money Stuff now has a reusable pattern for first-lane authority cutovers:
  - compact master migration plan first,
  - then one exact lane execution plan grounded in the actual billed operation shape.
- The Create lane is now ready for implementation planning without guessing or inventing fallback pricing structure.

Next training focus:

- Implement the canonical Create billed-credit row lookup path.
- Cut display and server debit over together so no temporary authority split is introduced.

## 2026-05-31: Pricing Grid Coverage Gap Capture

Task: preserve concrete pricing-grid coverage gaps discovered during the AI usage billed-credit authority migration so they can be filled later without relying on thread history.

Actions taken:

- Captured a retained gap note for missing canonical billed-credit rows in the pricing-grid authority surface.
- Recorded the first concrete missing-row case:
  - `GPT Image 2`
  - `Create Character Mode`
  - edit-like priced Create run
  - `input_image_count = 3`
  - `input_fidelity = high`
- Preserved the rule that runtime must fail closed for missing rows instead of inventing fallback billed prices.

Training result:

- Money Stuff now has a durable way to hand future pricing-grid coverage work back to Scott's page without losing exact missing-row details.
- The migration lane can keep hardening runtime authority while separately tracking admin-grid coverage gaps.

Next training focus:

- Continue cataloging concrete missing priced rows only when a runtime fail-closed case is confirmed.
- Keep runtime/debit aligned to Scott's final `Billed credits` output without editing the pricing page calculator surface.

## 2026-06-03: Unit-Pricing Runtime Calculation Planning

Task: convert the clarified pricing intent into a durable migration plan for Scott-owned unit pricing plus ShortPulse runtime quantity calculation.

Actions taken:

- Re-audited the current pricing page calculator, pricing policy document, runtime pricing strategies, and display/debit seams.
- Confirmed the current control-plane contract can store final overrides, but cannot yet express a machine-readable quantity rule such as `per_image` plus `input_image_count`.
- Confirmed the runtime strategy layer already contains most of the quantity math needed for:
  - image
  - video
  - sound
- Wrote a retained migration plan that separates:
  - Scott's authority over base variant and unit economics
  - ShortPulse's responsibility for payload-based quantity counting and final billed-credit derivation.

Training result:

- Money Stuff now has a durable planning pattern for the next pricing-authority phase:
  - keep Scott's calculator untouched
  - design a machine-readable unit-pricing authority contract
  - build one shared quantity-aware runtime resolver
  - migrate Create, then Edit, then Video, then Sound

Next training focus:

- Define the new machine-readable authority payload shape.
- Decide exactly which pricing-page outputs can be reused as-is and which structured fields must be added.
- Implement the shared quantity-aware resolver for Create image first.

## 2026-06-03: Unit-Pricing Plan Audit Update

Task: audit the new unit-pricing migration plan against the real current control-plane policy and runtime seams, then tighten the plan where it was still too implicit.

Actions taken:

- Re-read the retained plan against the current pricing policy document, admin pricing state route, and runtime pricing seams.
- Confirmed the plan needed one explicit architectural decision gate:
  - when Scott authors direct final billed credits
  - versus when ShortPulse derives final billed credits from unit economics plus quantity
- Added a workflow quantity matrix for:
  - image
  - video
  - sound
- Added a Phase 0 checklist so implementation does not begin before the new authority contract shape is explicitly chosen.

Training result:

- Money Stuff's pricing migration plans now more clearly separate:
  - source-of-truth decisions
  - runtime-resolver design
  - panel migration order
- The plan is now better protected against starting implementation too early with an under-specified authority contract.

Next training focus:

- Turn the Phase 0 checklist into the actual authority-payload design decision.
- Start Create-image implementation only after that design is explicit.

## 2026-06-03: Unit-Pricing Plan Coverage Audit

Task: compare the new unit-pricing plan against the repo again to make sure it did not miss child workflows or hidden migration seams.

Actions taken:

- Cross-checked the plan against:
  - route-level pricing helpers
  - local sound-component credit indicators
  - expert edit variant pricing helpers
  - client policy distribution
  - observability and support traces
- Confirmed the original plan needed to be widened beyond top-level panel buttons.
- Updated the retained plan to explicitly cover:
  - child workflow pricing surfaces
  - `/api/pricing/model-policy`
  - image-policy materialization replacement
  - observability parity requirements

Training result:

- Money Stuff now has a stronger audit pattern for pricing migrations:
  - compare the plan not only against top-level UX and debit paths
  - but also against route-level, component-level, and observability-level seams

Next training focus:

- Use the widened plan as the source of truth when designing the authority payload shape.
- Keep future implementation lanes honest about child workflow coverage, not just main CTA coverage.

## 2026-06-03: Batch And Regenerate Pricing Plan Audit

Task: compare the widened plan against regenerate flows, optimistic debit behavior, and batched child workflows to make sure pricing semantics would stay coherent after migration.

Actions taken:

- Re-audited the AI Studio pricing surfaces for:
  - regenerate actions
  - optimistic debit paths
  - batch-style child workflows such as music
- Confirmed the plan needed one more explicit rule:
  - whether authority is interpreted per request or per click when one user action spawns multiple submits
- Updated the retained plan to require explicit batch semantics and regenerate parity.

Training result:

- Money Stuff's plan-audit pattern now checks not only:
  - top-level buttons
  - child workflow displays
  - debit
  - observability
- but also:
  - regenerate behavior
  - optimistic debit behavior
  - batched submission semantics

Next training focus:

- Keep Phase 0 authority-payload design explicit about per-request versus per-click meaning.
- Ensure the first Create implementation slice does not leave regenerate behavior on a legacy pricing path.
