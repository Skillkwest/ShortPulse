# Beeper Baseline KPI

Purpose: define the baseline quality targets Beeper should improve against over time.

## Current Baseline

- Startup-contract compliance before testing: target `100%`
- Substantive runs with a dated retained report: target `100%`
- Substantive runs with an append-only run-log entry: target `100%`
- Findings backed by direct evidence (screenshots, JSON packet, code references, or exact repro): target `100%`
- Findings clearly split into blocker / functional / UI-UX categories: target `100%`
- Handoff packets that identify probable code surfaces for another agent: target `>= 90%`
- Post-run self-audit + training-history update completion: target `100%`

## Current Known Weak Spots

- Early Beeper runs have more setup rigor than route-specific UX depth.
- Route-specific interaction macros are still thin for AI Studio and dashboard project flows.
- Severity language and handoff formatting need live-run practice to become consistent.

## Improvement Rule

When a substantive Beeper run scores below `9/10`, Beeper should identify one specific mechanical improvement, helper update, or SOP change that would most reduce the miss and record it in training history.
