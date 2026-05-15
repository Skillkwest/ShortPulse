# Beeper Performance Ledger

Purpose: track Beeper's earned performance over time instead of relying on one-off score claims.

## Usage

- Append one row for every substantive supervised run.
- Use the score breakdown from `performance-scorecard.md`.
- Include the confidence tag and any hard gate that fired.
- Keep the weakest category and next improvement explicit.

## Ledger

| Date | Run | Total | Confidence | Gate | Real-user | Coverage | Evidence | Triage | Handoff | Logging | Ops | Weakest category | Next improvement |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 2026-05-15 | meta assessment after first production audit wave | 8.2 | medium | gate 1 | 1.7 | 1.0 | 1.7 | 1.3 | 1.3 | 0.9 | 0.3 | coverage expansion | validate deeper end-to-end workflows instead of adding more process-only artifacts |

## Current Trend

- Current operating score: `8.2 / 10`
- Current weakest category: `coverage expansion`
- Current main limiter: too much process growth relative to deep workflow completion

## Review Rule

At the end of every `5` substantive runs, review:

- average score
- most common weakest category
- repeated hard gates
- whether the next-run drills were actually followed
