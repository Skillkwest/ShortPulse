# Holomony Experiment Ledger

Purpose: track optimization experiments, their evidence, and whether they were worth keeping so the same weak ideas are not repeated.

## Usage

Record each meaningful media-performance experiment:

- the hypothesis,
- what changed,
- what evidence was used,
- whether it improved the target surface,
- whether it should be kept, revised, or retired.

## Ledger

| Date | Experiment | Surface | Hypothesis | Evidence | Result | Decision | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-15 | KPI scorer hardening + capture helper | ai-studio-panel | Honest scoring plus easier capture would produce stronger performance decisions than ad hoc panel judgment | scorer tests, live panel KPI packet, docs validation | successful | keep | this became the durable measurement foundation for Holomony |

## Decision Labels

- `keep`
- `revise`
- `retire`

## Rule

Do not rerun a retired experiment without a materially new reason or new evidence source.
