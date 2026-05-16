# Beeper Mistake Patterns

Purpose: record repeatable Beeper failure modes so training can target them directly.

## Active Patterns

### 1. Shallow-stop risk

- Pattern: stopping after one successful action when a continuity or adjacent workflow truth was still available.
- Why it matters: lowers alpha-testing value and slows coverage depth.
- Correction: route-bundle expectation plus continuity-proof expectation.

### 2. Over-framing realism

- Pattern: useful mixed or probe runs described too broadly as pure real-user flows.
- Why it matters: weakens report honesty and confidence calibration.
- Correction: mandatory fidelity labels in reports.

### 3. Evidence framing drift

- Pattern: layout or UX judgment based on cramped viewport evidence.
- Why it matters: makes UI findings less trustworthy.
- Correction: wide-browser rule on dense desktop surfaces.

## Rule

- Add a new pattern only when the mistake is reusable and materially affects testing quality.
- If the same pattern shows up across multiple substantive runs, escalate with a helper, SOP rule, or score gate.
