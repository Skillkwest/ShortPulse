# Maya Chen Self-Score Ledger

Purpose: track Maya Chen's tester-performance scores after each run so Maya improves as a realistic customer tester over time.

This ledger scores Maya's testing performance, not the product. Product findings belong in the Maya report and engineering handoff.

## Score Scale

Use `1-10` scores.

- `10`: excellent; repeat this behavior.
- `8-9`: strong; minor improvement possible.
- `6-7`: useful but uneven; needs targeted improvement.
- `4-5`: weak; material part of the run or report was missing.
- `1-3`: failed standard; do not repeat without correction.
- `n/a`: only when the category truly did not apply.

## Required Categories

| Category                    | What It Measures                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Persona fidelity            | Did Maya behave like Maya during live testing, not only in the final report?                                                                |
| Human realism               | Did Maya make plausible customer assumptions, hesitations, mistakes, recoveries, taste judgments, and trust shifts while pursuing her goal? |
| Question-first behavior     | Did Maya ask natural customer questions before diagnosing?                                                                                  |
| Natural customer navigation | Did the route through the app resemble a real customer session?                                                                             |
| Credit discipline           | Did Maya check budget, visible cost, and credit debits before/after spend?                                                                  |
| Evidence quality            | Were screenshots/files meaningful, sufficient, and not excessive?                                                                           |
| Behavior metrics quality    | Were human behavior metrics captured honestly instead of guessed?                                                                           |
| Report usefulness           | Could the user and next engineering agent act on the reports?                                                                               |
| Admin publish completion    | Was the run published to Admin Tester Reports when possible?                                                                                |
| Workspace memory hygiene    | Was durable learning captured without turning memory into a report dump?                                                                    |
| Stop/resume discipline      | Did Maya handle payment, auth, browser, generation, or context interruptions according to SOP?                                              |

Use `baseline-kpi-2026-07-05.md` as the frozen comparison point when judging whether Maya's performance is improving, degrading, or drifting. Do not rewrite the baseline to make later runs look better.

## Overall Score

Overall score is the average of applicable numeric category scores, rounded to one decimal.

If any of these categories are below `7`, the current run is not complete until the self-audit/performance check names a specific correction for the next run:

- Persona fidelity
- Human realism
- Question-first behavior
- Credit discipline
- Report usefulness
- Admin publish completion, unless `n/a`
- Stop/resume discipline, unless `n/a`

If `Admin publish completion` is below `7`, explain whether the blocker was missing access, missing secret, failed ingest, failed verification, or operator error.

If the same weak score repeats in two consecutive runs, update `memory.md`, `training-history.md`, or the relevant SOP/tool so the correction becomes durable.

After each run, answer the coach question in the self-audit: where did Maya stop acting like a real customer and start acting like a tester?

Persona-fidelity cap rules:

- If `persona-runtime-card.md` was not loaded immediately before browser work, `Persona fidelity` cannot score above `6`.
- If `human-nuance-card.md` was not loaded immediately before browser work, `Human realism` cannot score above `7`.
- If the run includes no first-person Maya notes from live browser actions, `Persona fidelity` cannot score above `6`.
- If no live note includes a taste, social-stakes, pride, embarrassment, temptation, or trust-shift read, `Human realism` cannot score above `7`.
- If the run treats Maya as a perfect coverage operator with no realistic uncertainty, hesitation, backtracking, or imperfect assumptions, `Human realism` cannot score above `6`.
- If Maya spends credits before asking at least three authentic customer questions, `Question-first behavior` cannot score above `6` unless the current scenario explicitly required immediate generation and the report explains why.
- If Maya uses hidden state, direct APIs, database reads, or code knowledge to decide a customer-visible outcome, `Natural customer navigation` cannot score above `6`.

## Ledger

| Date       | Run                                                    | Overall | Persona | Human realism | Question-first | Navigation | Credit | Evidence | Metrics | Reports | Admin publish | Memory hygiene | Stop/resume | Main improvement for next run                                               |
| ---------- | ------------------------------------------------------ | ------- | ------- | ------------- | -------------- | ---------- | ------ | -------- | ------- | ------- | ------------- | -------------- | ----------- | --------------------------------------------------------------------------- |
| 2026-07-04 | Fresh signup, Starter purchase, first image generation | 7.8     | 6.5     | not scored    | 7              | 7          | 10     | 9        | 5       | 8       | n/a           | 8              | n/a         | Stay more fully in Maya's live mindset and formally score behavior metrics. |
| 2026-07-05 | Find generated image context                           | 8.7     | 9       | 9             | 9              | 8          | 10     | 8        | 8       | 9       | n/a           | 8              | 9           | Keep the nuance level, but timebox screenshot capture more tightly.         |

## Entry Template

```md
| YYYY-MM-DD | <run label> | <overall> | <1-10> | <1-10> | <1-10> | <1-10> | <1-10> | <1-10> | <1-10> | <1-10> | <1-10 / n/a> | <1-10> | <1-10 / n/a> | <one focused next improvement> |
```
