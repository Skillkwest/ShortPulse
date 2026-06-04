# Systems Rating Rubric

Purpose: define the scoring contract for the ShortPulse systems catalog.

July 7 launch-control note: this rubric remains useful for the historical systems catalog and `/10` baseline. For the active `2026-07-07` launch decision, launch state, evidence level, human risk, operational risk, technical risk, next proof, and exact queue order are controlled by `docs/agents/copperknot/july-7-launch-authority.md` and `docs/agents/copperknot/july-7-launch-board.md`.

## Scoring model

Each rated system uses four `1..5` scores:

- `Criticality`
- `Health`
- `Risk`
- `Confidence`

Use the numbers consistently. The point is comparability, not false precision.

Required shorthand:

- `Current score (/10)`

Use that as the fast-scan maturity signal after the four core scores are justified.

## Criticality

How important the system is to product operation, user value, revenue, or safety.

- `1`: low-value helper or limited internal workflow
- `2`: useful but non-core; failure is inconvenient and localized
- `3`: meaningful product or operator workflow; failure is visible but tolerable
- `4`: important product/platform capability; failure blocks a major workflow
- `5`: core product, money, identity, security, or foundational runtime authority

## Health

How strong the system currently is based on correctness, maintainability, observability, and operational confidence.

- `1`: consistently fragile; weak controls or frequent regressions
- `2`: below standard; known debt or instability regularly creates operator pain
- `3`: acceptable but mixed; works, but notable weaknesses remain
- `4`: strong; issues happen but controls and recovery are generally good
- `5`: robust; clear ownership, strong signals, good tests, and low operational friction

## Risk

How likely the system is to create serious product, operational, billing, or security problems when changed or when it fails.

- `1`: low blast radius and easy recovery
- `2`: modest impact or isolated breakage
- `3`: moderate risk; meaningful failure or change coordination needed
- `4`: high risk; large user impact, fragile coupling, or hard recovery
- `5`: very high risk; money, identity, security, core runtime convergence, or broad user outage potential

## Confidence

How confident we are that the current rating reflects reality.

- `1`: mostly guesswork; poor visibility or stale understanding
- `2`: weak confidence; partial evidence only
- `3`: reasonable confidence; enough evidence to rate, but gaps remain
- `4`: strong confidence; code/docs/ops evidence mostly align
- `5`: very strong confidence; system boundary, behavior, and signals are well understood

## Rating guidance

- Prefer stable, evidence-backed numbers over reactive swings.
- Change ratings when the system meaningfully changes, not for every small patch.
- Use `Notes` in the catalog to explain unusual scores.
- If the score is uncertain, lower `Confidence` instead of forcing fake precision elsewhere.

## Source inputs

Good evidence for ratings includes:

- `docs/operator-map.md`
- `docs/routes.md`
- product and SOP source-of-truth docs
- architecture docs
- incident history
- current code structure and control paths

## `Current score (/10)` guidance

This is a compressed planning signal, not a replacement for the core rubric.

- Start with the `Health` band:
  - `Health = 1` -> `1..3`
  - `Health = 2` -> `4..5`
  - `Health = 3` -> `6..7`
  - `Health = 4` -> `8..9`
  - `Health = 5` -> `10`
- Then choose the lower or upper end of that band using:
  - unresolved blockers
  - `Risk`
  - `Confidence`
  - `Rating state`
  - known structural fragility relative to neighboring systems

Use these interpretations:

- `8..10`: strong and low-friction
- `6..7`: functional with meaningful complexity or debt
- `4..5`: important but fragile or in active need of hardening
- `1..3`: severe concern or unreliable core behavior

When in doubt:

- calibrate the `1..5` scores first
- keep the `/10` inside the `Health` band
- use `Criticality` to drive urgency, not to inflate maturity

## Rating state

Use one of:

- `seeded`: first-pass row with thin evidence
- `provisional`: enough evidence to rate, but the boundary or calibration is still weak
- `calibrated`: compared against nearby systems and strong enough to drive prioritization
