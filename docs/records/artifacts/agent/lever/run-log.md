# Lever Run Log

Purpose: keep an append-only ledger of substantive Lever runs so model maintenance work remains traceable and reusable as training data.

## Usage

- Append one row for every substantive add/reverify/retire/remove run.
- Link the corresponding full report when one exists.
- Keep entries concise and factual.

| Date | Run Type | Model(s) | Outcome | Validation | Report |
| --- | --- | --- | --- | --- | --- |
| 2026-05-11 | retirement | `kie-ai/seedance-1.5-pro` | Deprecated with replacement to `kie-ai/seedance-2`; visible app residue removed; compatibility route/docs retained | Focused AI Studio/runtime tests, `npm -C frontend run model:doctor` | Pending first Lever report backfill |
