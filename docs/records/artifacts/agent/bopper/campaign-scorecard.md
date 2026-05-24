# Bopper Campaign Scorecard

Purpose: measure Bopper's overall effectiveness as an average-user tester across multiple runs, not just how clean one checkpoint was.

Use this alongside the per-run score in `performance-scorecard.md`.

## Why This Exists

The per-run score answers:

- how good was this run?

The campaign score answers:

- how effective is Bopper overall right now?

Without this second layer, a series of clean partial runs can look stronger than the actual naive-user testing campaign.

## Scoring Layers

Bopper now has three distinct score views:

### 1. Run Score

- Source: `performance-scorecard.md`
- Purpose: grade one substantive run out of `10`
- Focus: fidelity, confusion capture, evidence, and handoff usefulness

### 2. Coverage Score

- Purpose: grade how much of the product has at least one believable naive-user validated success path
- Scale: `0.0 - 10.0`
- Focus: obvious-entry route breadth and depth, not report neatness

### 3. Impact Score

- Purpose: grade whether Bopper is finding or retiring high-value trust-breaking average-user issues
- Scale: `0.0 - 10.0`
- Focus: confusion, abandonment, wording trust, and retest closure

## Coverage Score

Start from the current major-route map:

- auth
- dashboard
- ai studio
- media library
- character
- profile

Suggested scoring:

- `10.0`: every major route has at least one validated naive-user success path and the weakest route is no worse than `partial`
- `8.0`: most major routes have one validated success path, with only one route still shallow
- `6.0`: several routes are validated, but at least one major route is still only `seen`
- `4.0`: coverage is concentrated in a few comfortable surfaces
- `below 4.0`: tester breadth is weak

Coverage should be judged mainly from:

- `docs/agents/bopper/workspace/action-coverage/master-coverage-log.md`
- `docs/agents/bopper/workspace/route-success-map.md`
- whether low-coverage routes are actually being closed

## Impact Score

Impact should be judged from:

- number of believable trust-breaking moments found
- number of meaningful average-user uncertainties removed
- retest debt reduced after fixes
- usefulness of downstream handoffs

Primary retest-debt source:

- `docs/records/artifacts/agent/bopper/retest-debt.md`

Suggested scoring:

- `10.0`: Bopper is regularly finding or retiring high-value user-facing trust failures and materially improving product confidence
- `8.0`: Bopper is producing useful average-user findings consistently
- `6.0`: Bopper is useful, but mostly validating without enough strong issue yield or retest closure
- `4.0`: work is orderly but not moving average-user understanding much
- `below 4.0`: low impact

## Current Campaign Read - 2026-05-15

- Coverage Score: `4.5 / 10`
- Impact Score: `7.5 / 10`

Reasoning:

- Dashboard and AI Studio now each have one validated naive-user success path.
- Auth has been seen but not completed end to end.
- Media Library, Character, and Profile remain untouched, so route breadth is still shallow even after the fix retest.
- Impact improved because Bopper both found a high-value trust break earlier and then retired that debt with a direct visible-path retest.
- The next campaign priority is broadening beyond dashboard-centric routes while preserving the same naive-user rigor.

## Interpretation

- A high Run Score with a lower Coverage Score means:
  - Bopper is doing good individual work, but breadth is still lagging
- A high Run Score with a lower Impact Score means:
  - Bopper is validating healthy paths, but not yet uncovering enough trust-breaking user problems or clearing retest debt
- The best state is:
  - strong Run Score
  - rising Coverage Score
  - strong or rising Impact Score

## Update Rule

Update the campaign scores:

- after every `3-5` substantive runs
- after a major fix retest wave
- or after a route-breadth jump such as closing a previously shallow major route

## Training Rule

If the Run Score is strong but Campaign Coverage is weak:

- prioritize low-coverage routes first

If the Run Score is strong but Campaign Impact is weak:

- prioritize trust-breaking moments, retest debt, and average-user uncertainty reduction

If Campaign Coverage and Impact are both healthy:

- prioritize depth, regression retests, and quality-bar raising
