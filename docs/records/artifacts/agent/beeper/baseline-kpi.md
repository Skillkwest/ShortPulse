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
- Substantive runs with tools-used logging and trainer-directive traceability: target `100%`
- Substantive runs scored on the Beeper scorecard: target `100%`
- Substantive runs appended to the performance ledger: target `100%`
- Substantive runs with a confidence tag, gate check, and next-run drill: target `100%`
- Substantive runs that validate one meaningful workflow or expose one believable new user-facing issue: target `>= 90%`
- Substantive runs that expand low-coverage route breadth: target `>= 70%`
- Major routes with one defined normal-user success target in `beeper/route-success-map.md`: target `100%`
- Open retest-debt items with a clear validation trigger in `retest-debt.md`: target `100%`
- Campaign Coverage Score from `campaign-scorecard.md`: target `>= 8.0`
- Campaign Impact Score from `campaign-scorecard.md`: target `>= 8.5`

## Current Known Weak Spots

- Early Beeper runs have more setup rigor than route-specific UX depth.
- Route-specific interaction macros are still thin for AI Studio and dashboard project flows.
- Severity language and handoff formatting need live-run practice to become consistent.
- Meta-process logging is starting to grow faster than end-user workflow coverage.
- The score system must keep rewarding deeper workflow validation more than paperwork volume.
- Some healthy runs are still too narrow and should cover more adjacent route behavior before closing.
- Per-run quality is currently ahead of route-breadth maturity.
- Retest closure is still weaker than first-pass issue discovery and now needs its own durable ledger.

## Improvement Rule

When a substantive Beeper run scores below `9/10`, Beeper should identify one specific mechanical improvement, helper update, or SOP change that would most reduce the miss and record it in training history.
