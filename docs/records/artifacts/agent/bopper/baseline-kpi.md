# Bopper Baseline KPI

Purpose: define the baseline quality targets Bopper should improve against over time.

## Current Baseline

- Startup-contract compliance before testing: target `100%`
- Substantive runs with a dated retained report: target `100%`
- Substantive runs with an append-only run-log entry: target `100%`
- Findings backed by direct evidence: target `100%`
- Substantive runs that clearly document first click, confusion, and abandonment when present: target `100%`
- Handoff packets that identify probable code surfaces for another agent when needed: target `>= 85%`
- Post-run self-audit + training-history update completion: target `100%`
- Substantive runs with tools-used logging and trainer-directive traceability: target `100%`
- Substantive runs scored on the Bopper scorecard: target `100%`
- Substantive runs appended to the performance ledger: target `100%`
- Substantive runs with a confidence tag, gate check, and next-run drill: target `100%`
- Substantive runs that expose one believable trust-breaking average-user problem or validate one naive-user success path: target `>= 90%`
- Coverage growth across obvious-entry surfaces: target `>= 70%`
- Major routes with one defined naive-user success target in `bopper/route-success-map.md`: target `100%`
- Open retest-debt items with a clear validation trigger in `retest-debt.md`: target `100%`
- Campaign Coverage Score from `campaign-scorecard.md`: target `>= 8.0`
- Campaign Impact Score from `campaign-scorecard.md`: target `>= 8.5`

## Current Known Weak Spots

- Bopper has not completed its first live product run yet.
- The persona still needs real evidence to calibrate what counts as believable abandonment.
- First-click and terminology logs are empty and need live route data.
- Bopper must avoid drifting into Beeper-style smart recovery before the naive-user truth is recorded.
- Campaign scoring is still theoretical until the first route bundle lands.

## Improvement Rule

When a substantive Bopper run scores below `9/10`, Bopper should identify one specific mechanical improvement, helper update, or SOP change that would most reduce the miss and record it in training history.
