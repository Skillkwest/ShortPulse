# Maya Chen Baseline KPI - 2026-07-05

Purpose: frozen baseline for comparing future Maya tester runs after the first useful supervised production runs.

Do not rewrite this file to improve the historical score. If Maya's workflow changes materially, create a new dated baseline and compare against both.

## Scope

This baseline measures Maya Chen as a simulated customer tester for authenticated production Chrome runs of ShortPulse, especially AI Studio image-generation, saved-work, project, Media Library, Reference Grid, credit, and report-publishing workflows.

It scores Maya's tester performance, not ShortPulse product quality.

## Baseline Source

- `2026-07-04` fresh signup, Starter purchase, and first image generation run.
- `2026-07-05` find generated image context run.
- Supervised post-run scoring and improvement discussion from July 5, 2026.
- Current Maya SOP/tool stack as of July 5, 2026.

## Baseline Score

Overall baseline: `8.4 / 10`.

This reflects a useful Maya tester who is already producing actionable findings, but still needs tighter operational flow, stricter screenshot discipline, and more consistent Admin publish completion when credentials are available.

## Weighted Categories

| Category                    | Weight | Baseline | Target              | Warning        |
| --------------------------- | ------ | -------- | ------------------- | -------------- |
| Persona fidelity            | 15%    | 8.5      | >= 8.5              | < 7.5          |
| Human realism               | 15%    | 8.5      | >= 8.5              | < 7.5          |
| SOP order fidelity          | 10%    | 9.0      | >= 9.0              | < 8.0          |
| Question-first behavior     | 10%    | 9.0      | >= 8.5              | < 7.5          |
| Credit discipline           | 10%    | 10.0     | 10.0                | < 9.0          |
| Evidence discipline         | 10%    | 8.0      | >= 8.5              | < 7.0          |
| Report usefulness           | 15%    | 9.0      | >= 9.0              | < 8.0          |
| Admin publish completion    | 5%     | n/a      | done when available | missing status |
| Stop/resume discipline      | 5%     | 9.0      | >= 9.0              | < 8.0          |
| Efficiency/operational drag | 5%     | 7.5      | >= 8.5              | < 7.0          |

## Pass Thresholds

- Strong run: `8.5+` overall with no non-negotiable fail condition.
- Acceptable run: `7.5-8.4` overall with clear correction notes.
- Needs correction: below `7.5`, or any warning category that repeats twice.
- Failed run: any non-negotiable fail condition, even if the average score looks acceptable.

## Non-Negotiable Fail Conditions

- Uses the Codex in-app browser for the customer-visible run instead of a fresh real Google Chrome window.
- Uses hidden state, direct API calls, database reads, or code knowledge to decide whether a customer-visible workflow succeeded.
- Spends credits without checking the monthly ledger and visible cost/balance cues when available.
- Keeps routine screenshots that do not aid diagnosis, show confusion, or prove important credit/output/save/payment/Admin state.
- Fails to write both the Maya-voice report and the engineering handoff.
- Does not update the credit ledger when credits are checked, estimated, or spent.
- Does not complete the post-run self-audit and self-score ledger row.
- Omits Admin Tester Reports publish status.
- Leaks credentials, tokens, cookies, signed URLs, billing details, or other private account-identifying information.

## Evidence Anchors

- The July 5 run proved Maya can find saved media and project state through the visible product path.
- The same run exposed a useful product trust gap: prompt/context recovery was not visible where Maya expected it.
- The score discussion showed Maya was strongest when she stayed in first-person customer reasoning and weakest when operational overhead slowed the run.

## Comparison Template

Use this after future Maya runs:

```md
## Baseline Comparison

Run:
Date:
Compared against: `baseline-kpi-2026-07-05.md`

Overall score:
Delta from baseline:

## Categories improved:

## Categories degraded:

Non-negotiable fail conditions triggered:

- `<none / list>`

## What changed in Maya's behavior:

## Correction to carry into next run:
```
