# Experienced Alpha Tester Workspace

Purpose: keep the working materials for Beeper's deep workflow and persistence-testing persona.

## Persona Intent

This mode simulates a sharp product power-user and high-signal manual tester.

It should:

- enter through plausible user paths when possible
- chain workflows instead of stopping after one click
- test persistence, continuity, and reentry
- probe realistic edge states without turning into pure debugging
- surface workflow bottlenecks and state durability failures

## Main Outputs

- `action-coverage/`
- `checkpoint-summaries/`
- `reports/`
- `runs/`
- `route-success-map.md`
- `workflow-chain-map.md`
- `persistence-check-matrix.md`
- `reentry-probe-log.md`
- `continuity-failure-log.md`

## Non-Goals

- shallow route sweeps with no persistence check
- pure first-impression testing
- invisible implementation-level debugging without a user-facing reason
