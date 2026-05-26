# Babineaux the Engineer Baseline KPI

Status: `Frozen`

Purpose: preserve the first durable KPI snapshot for Babineaux the Engineer after multiple supervised hardening lanes and repeated validation-backed closeouts.

## Baseline Snapshot

- Baseline date: `2026-05-26`
- Scope: supervised product-code hardening, canonicalization, contract repair, hook correctness hardening, and AI Studio seam reduction
- Overall score: `8.8/10`
- Comparison rule: compare future runs against this snapshot instead of rewriting it

## KPI Categories

- Scope control: `9.0/10`
  - Why this score: lane boundaries have stayed tight, with strong resistance to adjacency drift and no product-behavior creep.
  - What is working: bounded lane selection, explicit stop points, and hardening-only posture.
  - What is not fully working: structural work can still tempt nearby follow-on cleanup if the stopping rule is not kept active.

- Regression discipline: `8.5/10`
  - Why this score: validation has been strong and behavior-preserving, but there were a few first-pass misses when extracted seams collided with source-based tests.
  - What is working: targeted lint, type-check, architecture checks, and focused Vitest lanes are consistently being used.
  - What is not fully working: source-location assertions were not always anticipated before moving code.

- Codebase judgment / ROI targeting: `9.0/10`
  - Why this score: the chosen lanes have matched the audit’s strongest repo-backed risks.
  - What is working: canonicalization, contract repair, hook correctness hardening, and AI Studio seam reduction all improved meaningful risk areas.
  - What is not fully working: prioritization is strong, but structural work still needs continued discipline to avoid spending effort on lower-ROI cleanup.

- Architectural execution: `8.5/10`
  - Why this score: extractions have been clean and contract-preserving, but some boundary tests needed to be re-anchored after seam movement.
  - What is working: owned helper runtimes are being extracted into coherent feature hooks instead of adding indirection or fallback layers.
  - What is not fully working: some repo tests still encode implementation location assumptions that need earlier recognition during seam work.

- Durable operating discipline: `9.0/10`
  - Why this score: memory, SOP, artifacts, and repo-closeout behavior have stayed consistent and useful.
  - What is working: durable lessons are being moved out of chat and into the repo, and the operating identity is staying coherent.
  - What is not fully working: the training system is still early, so long-run drift resistance is not proven yet.

## Strength Profile

- Strongest current behaviors:
  - bounded lane execution
  - validation-backed closeout
  - high-ROI risk targeting
  - behavior-preserving canonical-path fixes
  - durable artifact hygiene

- Main score depressors:
  - first-pass misses on source-based boundary assertions during seam extractions
  - occasional underestimation of how tightly some tests are coupled to file placement

## Thresholds

- Healthy operating band: `8.5/10` or higher overall
- Warning threshold: below `8.0/10` overall or any individual category below `7.5/10`
- Escalation threshold: below `7.0/10` overall or repeated regression-discipline misses across two consecutive supervised reviews

## Critical Failure Conditions

- introduced a parallel implementation
- changed behavior/UI/UX on a hardening-only lane
- claimed success without validation evidence
- continued into adjacency work after the lane was complete

## Behavior Updates Derived From This Baseline

- Before seam extraction, inspect source-based boundary tests that may assert file placement or local symbol presence.
- Treat test-location coupling as part of the seam contract, not as post-hoc cleanup.
- Keep using the lightest credible validation stack, but include focused page/source-boundary tests whenever a composition root is being slimmed.

## Evidence Anchors

- Media ingest canonicalization lane completed with focused API validation.
- AI Studio contract repair restored `type-check` and targeted contract suites.
- AI Studio hook correctness hardening removed active correctness warnings without behavior changes.
- AI Studio shell runtime extraction completed cleanly.
- AI Studio create-panel runtime extraction completed with focused boundary-test updates and green validation.

## Future Comparison Template

- Date:
- Scope:
- Overall score:
- Category deltas:
  - scope control:
  - regression discipline:
  - codebase judgment / ROI targeting:
  - architectural execution:
  - durable operating discipline:
- New strengths:
- New score depressors:
- Required SOP or memory updates:
