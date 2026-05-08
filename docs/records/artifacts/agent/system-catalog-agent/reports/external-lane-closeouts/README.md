# External Lane Closeouts

Purpose: store closeout reports written by execution agents after they finish a bounded System Catalog Agent handoff lane.

## Why this folder exists

These reports are the intake surface for the Catalog Agent.

They make it possible to:

- audit external lane results without reconstructing everything from scratch,
- compare claimed results against actual repo changes,
- decide whether a system score should move,
- and keep parallel agent work organized by lane.

## File Naming Rule

Use:

- `YYYY-MM-DD-<lane-id>-closeout.md`

Example:

- `2026-05-07-generation-recovery-settlement-closeout.md`

## Required Report Contents

Each closeout report should contain:

- lane id
- source handoff path
- execution status
- files changed
- summary of what changed
- validation run
- blockers encountered
- residual risk
- recommended next step for Catalog Agent review

## Template

Use:

- `template.md`

as the default structure unless the handoff packet explicitly asks for a narrower closeout.

## Authority Rule

These reports are evidence inputs for the Catalog Agent.

They do not directly change:

- `docs/systems/catalog.md`
- queue order
- ship-floor interpretation
- system score

The Catalog Agent must still audit the repo before rerating any system.
