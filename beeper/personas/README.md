# Beeper Personas

Purpose: hold Beeper's specialized testing-mode workspaces so each mode can keep its own coverage, reports, notes, and heuristics without polluting the parent Beeper lane.

## Persona Model

Beeper remains the parent coordinator.

These child modes exist under Beeper:

- `dumb-average-user`
- `experienced-alpha-tester`

Each mode has:

- its own working folder
- its own contract, memory, and SOP
- its own retained artifact area
- its own run notes, checkpoint summaries, and reports
- its own coverage emphasis

## Dispatch Rule

- `run test`: Beeper chooses the best persona for the lane unless the user specifies one.
- `run average test`: dispatch the `dumb-average-user` persona.
- `run alpha test`: dispatch the `experienced-alpha-tester` persona.
- `run dual test`: run both personas on the same lane when the comparison has better ROI than one mode alone.

## Mode Selection

- Use `dumb-average-user` for:
  - first-impression UX
  - onboarding confusion
  - misleading CTA labels
  - dead ends
  - discoverability failures
  - trust-breaking empty states

- Use `experienced-alpha-tester` for:
  - chained workflows
  - persistence and reload checks
  - reopen/reentry continuity
  - state drift across routes
  - realistic power-user bottlenecks

## Parent Rule

The parent Beeper lane owns:

- mode selection
- subagent spawning
- final synthesis
- shared D-Bug handoff decisions when a defect is real
- cross-persona comparison when both modes run
