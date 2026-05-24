# Beeper Campaign Scorecard

Purpose: measure Beeper's overall effectiveness as a tester across multiple runs, not just how clean one checkpoint was.

Use this alongside the per-run score in `performance-scorecard.md`.

## Why This Exists

The per-run score answers:

- how good was this run?

The campaign score answers:

- how effective is Beeper overall right now?

Without this second layer, a series of clean partial runs can look stronger than the actual testing campaign.

## Scoring Layers

Beeper now has three distinct score views:

### 1. Run Score

- Source: `performance-scorecard.md`
- Purpose: grade one substantive run out of `10`
- Focus: workflow quality, evidence, triage, and handoff usefulness

### 2. Coverage Score

- Purpose: grade how much of the product has at least one believable validated success path
- Scale: `0.0 - 10.0`
- Focus: route breadth, depth, and continuity truth, not report neatness

### 3. Impact Score

- Purpose: grade whether Beeper is finding or retiring high-value user-facing issues
- Scale: `0.0 - 10.0`
- Focus: trust-breaking moments, real workflow uncertainty removed, and retest debt progress

## Coverage Score

Start from the current major-route map:

- auth
- dashboard
- ai studio
- media library
- character
- profile

Suggested scoring:

- `10.0`: every major route has at least one validated normal-user success path and the key saved-state routes also have continuity proof
- `8.0`: most major routes have one validated success path, with only one route still shallow
- `6.0`: several routes are validated, but at least one major route is still only `opened`
- `4.0`: coverage is concentrated in a few comfortable surfaces
- `below 4.0`: tester breadth is weak

Coverage should be judged mainly from:

- `docs/agents/beeper/workspace/action-coverage/master-coverage-log.md`
- `docs/agents/beeper/workspace/route-success-map.md`
- whether low-coverage routes are actually being closed

## Impact Score

Impact should be judged from:

- number of believable trust-breaking moments found
- number of meaningful workflow uncertainties removed
- number of meaningful continuity or persistence uncertainties removed
- retest debt reduced after fixes
- usefulness of downstream handoffs

Primary retest-debt source:

- `docs/records/artifacts/agent/beeper/retest-debt.md`

Suggested scoring:

- `10.0`: Beeper is regularly finding or retiring high-value user-facing issues and materially improving product confidence
- `8.0`: Beeper is producing useful real-user findings consistently
- `6.0`: Beeper is useful, but mostly validating without enough strong issue yield or retest closure
- `4.0`: work is orderly but not moving product understanding much
- `below 4.0`: low impact

## Current Campaign Read - 2026-05-15

- Coverage Score: `7.4 / 10`
- Impact Score: `8.8 / 10`

Reasoning:

- impact is strong because Beeper has already found multiple believable product issues and continues to turn partial route coverage into cleaner trust-break signatures
- coverage improved because AI Studio now has one validated persisted editing path
- coverage is still limited because `character`, `media library`, and broader `dashboard` behavior remain only partial

## Interpretation

- A high Run Score with a lower Coverage Score means:
  - Beeper is doing good individual work, but breadth is still lagging
- A high Run Score with a lower Impact Score means:
  - Beeper is validating healthy paths, but not yet uncovering enough meaningful user-facing problems or clearing retest debt
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

- prioritize trust-breaking moments, retest debt, and workflow uncertainty reduction

If Campaign Coverage and Impact are both healthy:

- prioritize depth, regression retests, and quality-bar raising
