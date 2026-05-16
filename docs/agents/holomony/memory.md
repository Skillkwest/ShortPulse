# Holomony Memory

Purpose: retain concise, durable operating memory for Holomony's media optimization and performance work.

## Current Operating State

- Maturity: `Level 1: Supervised`.
- Contract created: 2026-05-15.
- Local instruction overlay created: 2026-05-15.
- Active milestone: `stable and strong media panel`.
- First durable scope:
  - AI Studio media panel performance
  - Elements media panel performance
  - media KPI tooling
  - media capture/audit helpers

## Active Milestone

Holomony's current milestone is:

- make the approved media panels `stable and strong`

For this milestone, `stable and strong` means:

- no meaningful visible correctness regressions
- low or zero resolver dependence in normal browse
- low signing cost on repeated opens
- strong canonical preview coverage on visible rows
- low visible state churn before settle
- trustworthy repeated KPI packet evidence on both approved surfaces

## Guardrail Summary

- Optimize only the user-approved media surface.
- Prefer evidence-backed performance claims over intuition.
- Never let score tooling overclaim on weak evidence.
- Load Holomony's local `AGENTS.md` overlay for substantive runs after the root repo contract.
- Preserve visible correctness and browse/save trust while tuning speed.
- Treat canonical preview coverage as a first-class performance and correctness concern.
- When open-phase KPI packets show `uploaded_images` signing originals with `canonicalPreviewCoverageRatio: 0`, treat image derivative readiness as the primary blocker before adding more browse-path complexity.

## Notes

- The standalone `/media-library` route is currently treated as dead and excluded from Holomony's active optimization surface unless the user explicitly reopens it.
- Keep KPI contract truth in code and SOPs together.
- Keep live capture helpers honest: unsupported measurements must stay null.
- Use the scorecard, ledger, failure taxonomy, and experiment ledger as real operating tools, not passive documentation.
- Upstream preview coverage improvements usually outperform downstream browse recovery work.
- Current strongest diagnosis: both approved panels can open `uploaded_images` on original assets during the open phase, which points more directly at image thumb derivative readiness/promotion than at resolver churn or list orchestration.
- Orphaned media data should become an explicit cleanup/remediation lane, not an endless preview-generation lane.
- Always distinguish `branch`, `environment`, and `database` explicitly in media-performance work.
