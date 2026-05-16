# Next-Agent Handoff: Billing / Credits Runtime Hardening

## Lane Id

`billing-credits-runtime-hardening`

Purpose: tighten the hot-path billing runtime enough to make rerating possible without broadening into pricing-control-plane work.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded execution lane.
- Do not expand into pricing catalog redesign or broad Stripe-product work unless the stop rules are hit and the evidence demands it.

## Why this task

- System: `Billing / credits`
- Current score: `6/10`
- Target score: `7/10`
- Ship floor: `7/10`
- This system still sits below ship floor inside the generation hot path.
- Why the score is currently low:
  - credit reservation, capture/release, spendable snapshot reads, Stripe grant ingestion, and admin adjustments still share a failure-prone runtime seam
  - recovery hardening improved adjacent runtime behavior, but did not fully prove billing invariants end to end
  - the lane was still queue-only before this audit, which meant the queue could identify the risk faster than execution could act on it

## Recommended agent profile

Runtime billing agent with strong reconciliation, invariant, and test-discipline habits.

## Scoped task

Find the highest-ROI bounded hardening change in the billing runtime that improves reservation/settlement confidence without reopening the whole pricing or subscription architecture.

## Owned write surface

- `frontend/lib/server/api/generationBilling.ts`
- `frontend/lib/server/api/generationBilling/`
- `frontend/pages/api/credits/snapshot.ts`
- `frontend/pages/api/admin/credits/adjust.ts`
- `frontend/pages/api/billing/subscription/change.ts`
- `frontend/pages/api/billing/stripe/checkout.ts`
- `frontend/pages/api/billing/stripe/webhook.ts`
- directly related billing-runtime tests

## Avoid surface

- pricing catalog authoring or pricing-policy control-plane files
- unrelated AI Studio panel UI work
- auth or proxy boundary redesign outside billing-call-site proof
- broad Stripe product expansion work

## In scope

- reservation/capture/release runtime invariants
- spendable-balance and reserved-hold snapshot correctness
- Stripe grant and subscription-change convergence into runtime credit state
- targeted regression tests or characterization tests that prove the chosen seam

## Out of scope

- checkout UX redesign
- pricing-page copy or merchandising work
- billing control-plane catalog administration
- broad ledger schema redesign

## Required context

Read first:

- `docs/systems/catalog.md`
- `docs/sops/sop_billing_credits_operations.md`
- `docs/product/ai-studio-pricing.md`
- `docs/routes.md`

Inspect first:

- billing runtime entrypoints and settlement helpers
- snapshot and admin-adjust surfaces
- existing billing-runtime tests

## Questions to answer

1. Which billing invariant is still too implicit or weakly tested?
2. Which path can drift first: reservation, settlement, snapshot, or Stripe grant reconciliation?
3. What single bounded hardening change would move confidence fastest?

## Expected output

- one bounded hardening patch with tests, or
- one findings packet that identifies the best next bounded seam

## Suggested validation

- targeted billing-runtime tests
- targeted generation-billing or settlement tests if touched
- `npm -C frontend run docs:check` if docs change

## Mandatory endgame

- After the main patch or findings work, audit the touched billing-runtime repo area before stopping.
- Fix any high-value issue found during that self-audit if it stays inside the owned write surface.
- Do not stop at first success. Stop only after:
  - the main implementation or findings work is complete
  - validation is complete
  - self-audit is complete
  - high-value in-scope follow-on fixes are handled
  - closeout is written

## Done state

- one major billing-runtime ambiguity or weak invariant is reduced
- the closeout makes it clearer whether `Billing / credits` can be rerated toward floor

## Stop rules

- Stop before opening a broad pricing, subscription, or Stripe-architecture rewrite with no sharply bounded fix.
- Stop if the work requires changing multiple unrelated control-plane systems to claim a win.

## Required closeout report

- Path:
  - `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/`
- Filename:
  - `YYYY-MM-DD-billing-credits-runtime-hardening-closeout.md`
- Required contents:
  - lane id
  - source handoff path
  - execution status
  - systems touched
  - files changed
  - summary of what changed
  - acceptance criteria reached
  - evidence snapshot
  - validation run
  - validation evidence
  - self-audit findings
  - issues fixed during self-audit
  - issues intentionally left out of scope
  - blockers encountered
  - residual risk
  - recommended score effect
  - recommended next step for Catalog Agent review

## Send To Catalog

When the user says `send this to the catalog`, do not stop at a chat summary.

Do all of these:

1. Write the closeout report in:
   - `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/`
2. Use the filename:
   - `YYYY-MM-DD-billing-credits-runtime-hardening-closeout.md`
3. Follow the required closeout contents exactly.
4. Then tell the user:
   - the closeout filename
   - the files changed
   - whether the lane is:
     - `bounded patch complete`
     - `findings packet complete`
     - `blocked with evidence`

## Closeout And Archive

- Return one of:
  - bounded hardening patch complete
  - findings packet complete
  - blocked with evidence
- End with:
  - what changed
  - what was verified
  - what self-audit found
  - what was fixed during self-audit
  - residual risk
  - exact next step if unresolved
- Create the closeout report in the required report path before considering the lane finished.
- After returning the result, this lane should be considered ready to archive unless the user explicitly reopens it.
