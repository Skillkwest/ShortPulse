# Next-Agent Handoff: Characters Workflow Hardening

## Lane Id

`characters-workflow-hardening`

Purpose: convert a low-confidence workflow into a bounded, better-understood surface before ship.

## Copy/Paste Use

- This packet is ready to paste into another agent.
- Treat it as a bounded execution lane.
- Do not expand into net-new character feature work unless the stop rules are hit and the evidence demands it.

## Why this task

- System: `Characters workflow`
- Current score: `5/10`
- Target score: `6/10`
- Ship floor: `6/10`
- Confidence is low and the workflow still looks like a likely concentration point for mixed view state, persistence glue, and AI Studio integration assumptions.
- Fresh production evidence now exists:
  - Beeper captured a real edit -> reload -> auth bounce on `/character` plus weak save confidence on `2026-05-15`
- Why the score is currently low:
  - workflow authority is still too implicit across shell state, persistence, and mode integration
  - current confidence is limited by unclear boundaries and sparse targeted evidence

## Recommended agent profile

Workflow modularization agent with good persistence and shell-state separation discipline.

## Scoped task

Find the highest-ROI bounded hardening or decomposition change in the Characters workflow that improves confidence without broadening the scope into a full feature rewrite.

## Owned write surface

- Character workflow shell and controller files
- Character Mode integration seams owned by the Characters workflow
- directly related character workflow tests

## Avoid surface

- net-new character feature expansion
- broad Create workflow files outside Character Mode boundaries
- storage platform or media-delivery infrastructure
- unrelated Elements or Reference Grid workflow files

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

## Required closeout report

- Path:
  - `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/`
- Filename:
  - `YYYY-MM-DD-characters-workflow-hardening-closeout.md`
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
  - recommended next step for Catalog Agent review

## Send To Catalog

When the user says `send this to the catalog`, do not stop at a chat summary.

Do all of these:

1. Write the closeout report in:
   - `docs/records/artifacts/agent/system-catalog-agent/reports/external-lane-closeouts/`
2. Use the filename:
   - `YYYY-MM-DD-characters-workflow-hardening-closeout.md`
3. Follow the required closeout contents exactly.
4. Then tell the user:
   - the closeout filename
   - the files changed
   - whether the lane is:
     - `bounded hardening patch complete`
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
