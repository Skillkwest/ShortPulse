# Beeper Modes

Purpose: define Beeper's child testing personas and how the parent Beeper coordinator should dispatch them.

## Model

Beeper remains the parent testing steward.

These child modes are narrower execution personas:

- `dumb-average-user`
- `experienced-alpha-tester`

Preferred long-term mapping:

- standalone `Bopper` agent for the average-user lane
- parent `Beeper` plus `experienced-alpha-tester` mode for alpha-test depth

## Dispatch Logic

- Use `dumb-average-user` for discoverability, wording, first-click, and abandonment testing.
- Use `experienced-alpha-tester` for persistence, continuity, route bundles, and realistic power-user stress.
- Use both when the contrast itself is valuable.

## Trigger Suggestions

- `run average test`
- `run alpha test`
- `run dual test`

## Mode Contracts

- `docs/agents/beeper-modes/dumb-average-user/README.md`
- `docs/agents/beeper-modes/experienced-alpha-tester/README.md`

## Transition Note

The `dumb-average-user` mode remains as a Beeper-compatible scaffold, but the preferred standalone implementation of that lane is now `docs/agents/bopper/README.md`.
