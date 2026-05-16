# Next-Agent Handoff: Reference Grid Styles Drop Blocker

## Lane Id

`reference-grid-styles-drop-blocker`

Purpose: resolve the current P0 known-issue path that blocks final AI Studio closeout.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded execution lane.
- Do not broaden into general Reference Grid or Media Library redesign unless the stop rules are hit and the evidence demands it.

## Why this task

- System: `Reference Grid`
- Current score: `6/10`
- Target score: `7/10`
- Ship floor: `7/10`
- There is an active P0 known issue in `docs/known-issues.md`: `KI-AI-RG-STYLES-001`
- Final ship signoff should not proceed while this workflow remains broken without fresh waiver evidence.
- Why the score is currently low:
  - an active ship-path blocker still exists in a core user-facing workflow
  - internal drop authority and payload handling are not trusted enough yet

## Recommended agent profile

AI Studio runtime hardening agent with strong drag/drop, media-source, and characterization-test discipline.

## Scoped task

Run a characterization-first investigation and fix pass for the Reference Grid -> Styles image drop path.

The goal is to make one failing internal image drop path reliable or to reduce the issue to one sharply bounded remaining defect with captured payload evidence.

## Owned write surface

- `frontend/features/ai-studio/components/style-creator/`
- `frontend/features/ai-studio/utils/dragDrop.ts`
- directly related tests for style intake and internal reference drops

## Avoid surface

- generation runtime control-plane files
- billing or pricing files
- broad Media Library architecture
- unrelated AI Studio panels and workflows

## In scope

- Reference Grid internal drag payloads
- Styles creator intake
- internal drop resolution
- blocked-source fallback behavior
- characterization tests for failing and passing payloads

## Out of scope

- broad Reference Grid redesign
- unrelated Media Library refactors
- general adaptive media cleanup
- style-library feature expansion

## Required context

Read first:

- `docs/known-issues.md`
- `docs/troubleshooting.md`
- `docs/sops/sop_ai_studio_style_creator.md`
- `docs/systems/catalog.md`

Inspect first:

- `frontend/features/ai-studio/components/style-creator/intake.ts`
- `frontend/features/ai-studio/components/style-creator/internalDropResolver.ts`
- `frontend/features/ai-studio/utils/dragDrop.ts`
- related tests around style intake and internal reference drops

## Questions to answer

1. What is the real failing drag payload shape in the broken path?
2. Where does the resolver lose canonical internal source authority?
3. What is the smallest fix that restores reliable internal style creation?

## Expected output

- one bounded fix plus characterization tests, or
- one findings packet with captured payload evidence and a smaller follow-up scope

## Suggested validation

- targeted style-intake and drag/drop tests
- relevant AI Studio drop-routing tests
- `npm -C frontend run docs:check` if docs change

## Done state

- one previously failing internal image drop path is now reliable, or
- the unresolved path is narrowed to one evidence-backed remaining defect with tests and packetized proof

## Stop rules

- Stop if the next step requires broad media architecture changes without first locking passing/failing payloads as tests.

## Required closeout report

- Path:
  - `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/`
- Filename:
  - `YYYY-MM-DD-reference-grid-styles-drop-blocker-closeout.md`
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
  - blockers encountered
  - residual risk
  - recommended next step for Catalog Agent review

## Closeout And Archive

- Return one of:
  - bounded fix complete
  - findings packet complete
  - blocked with evidence
- End with:
  - what changed
  - what was verified
  - residual risk
  - exact next step if unresolved
- Create the closeout report in the required report path before considering the lane finished.
- After returning the result, this lane should be considered ready to archive unless the user explicitly reopens it.
