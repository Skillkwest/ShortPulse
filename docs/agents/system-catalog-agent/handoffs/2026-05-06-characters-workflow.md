# Next-Agent Handoff: Characters Workflow Hardening

Purpose: convert a low-confidence workflow into a bounded, better-understood surface before ship.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded execution lane.
- Do not expand into net-new character feature work unless the stop rules are hit and the evidence demands it.

## Why this task

- System: `Characters workflow`
- Current score: `5/10`
- Ship floor: `6/10`
- Confidence is low and the workflow still looks like a likely concentration point for mixed view state, persistence glue, and AI Studio integration assumptions.

## Recommended agent profile

Workflow modularization agent with good persistence and shell-state separation discipline.

## Scoped task

Find the highest-ROI bounded hardening or decomposition change in the Characters workflow that improves confidence without broadening the scope into a full feature rewrite.

## In scope

- Character Manager shell state
- preset/look persistence rules
- AI Studio Character Mode integration seams
- targeted characterization and regression tests

## Out of scope

- new character feature expansion
- broad AI Studio Create workflow work
- storage platform redesign

## Required context

Read first:

- `docs/systems/catalog.md`
- `docs/sops/sop_character_manager_operations.md`
- `docs/glossary.md`

Inspect first:

- Character workflow shell and related persistence/controller paths
- AI Studio Character Mode integration points
- existing character workflow tests

## Questions to answer

1. What character workflow boundary is still too implicit?
2. Which controller or shell is doing too much?
3. What single hardening change would move confidence fastest?

## Expected output

- one bounded hardening patch with tests, or
- one findings packet that names the best seam for the next pass

## Suggested validation

- targeted character workflow tests
- `npm -C frontend run docs:check` if docs change

## Done state

- one major character workflow ambiguity or overgrown seam is reduced

## Stop rules

- Stop before opening a broad character-system redesign with no sharply bounded fix.

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
