# Next-Agent Handoff: Elements Workflow Hardening

Purpose: raise a low-confidence AI Studio workflow to a more explicit and supportable state.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded execution lane.
- Do not expand into a broad library redesign unless the stop rules are hit and the evidence demands it.

## Why this task

- System: `Elements workflow`
- Current score: `5/10`
- Ship floor: `6/10`
- The boundary still appears transitional and should not stay vague near production launch.

## Recommended agent profile

Workflow modularization agent with strong contract-cleanup and persistence-boundary discipline.

## Scoped task

Investigate the Elements workflow and make one bounded hardening change that clarifies workflow authority, persistence rules, or downstream reuse semantics.

## In scope

- element workflow shell/state
- element persistence shape
- image/video-backed element reuse semantics
- targeted characterization and regression tests

## Out of scope

- broad asset-management redesign
- character workflow changes except where a direct element boundary comparison is required
- unrelated AI Studio panels

## Required context

Read first:

- `docs/systems/catalog.md`
- `docs/product/shortpulse_ai_studio.md`
- `docs/data-dictionary.md` sections for elements tables

Inspect first:

- `frontend/features/ai-studio/components/ElementsPanel.tsx`
- related elements-manager workflow files
- element persistence paths and tests

## Questions to answer

1. What part of the Elements workflow still lacks a clean authority boundary?
2. Which persistence or reuse contract is still too soft?
3. What one change would raise confidence most efficiently?

## Expected output

- one bounded hardening patch with tests, or
- one findings packet that sharply reduces the next scope

## Suggested validation

- targeted elements workflow tests
- `npm -C frontend run docs:check` if docs change

## Done state

- one key element workflow ambiguity is removed or isolated

## Stop rules

- Stop before broadening into a larger library redesign unless the bounded issue cannot be solved in place.

## Closeout And Archive

- Return one of:
  - bounded hardening patch complete
  - findings packet complete
  - blocked with evidence
- End with:
  - what changed
  - what was verified
  - residual risk
  - exact next step if unresolved
- After returning the result, this lane should be considered ready to archive unless the user explicitly reopens it.
