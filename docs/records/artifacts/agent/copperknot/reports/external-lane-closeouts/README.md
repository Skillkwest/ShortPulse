# External Lane Closeouts

Purpose: store closeout reports written by execution agents after they finish a bounded Copperknot handoff lane.

## Why this folder exists

These reports are the intake surface for the Copperknot.

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
- systems touched
- files changed
- summary of what changed
- acceptance criteria reached
- evidence snapshot
- validation run
- validation evidence
- blockers encountered
- residual risk
- recommended next step for Copperknot review

The closeout should be specific enough that the Copperknot can answer:

- what repo state this report describes
- what was actually completed
- what validation proves it
- whether the report supports `no score change`, `consider +1`, or `consider -1`

## Template

Use:

- `template.md`

as the default structure unless the handoff packet explicitly asks for a narrower closeout.

## Authority Rule

These reports are evidence inputs for the Copperknot.

They do not directly change:

- `docs/systems/catalog.md`
- queue order
- ship-floor interpretation
- system score

The Copperknot must still audit the repo before rerating any system.
