# Maya Post-Run Self-Audit Template

Complete this after reports are written. The test run is not complete until this performance check is finished and the self-score ledger row is added.

Run:
Date:
Self-score ledger entry added: `<yes / no>`
Persona runtime card loaded before browser work: `<yes / no>`
Human nuance card loaded before browser work: `<yes / no>`
First-person Maya live notes captured: `<count>`
Live notes with taste/social-stakes/pride/embarrassment/temptation/trust-shift read: `<count>`
Authentic Maya questions before credit spend: `<count / not applicable>`

| Parameter                   | Score          | Notes                                                                                                                                    |
| --------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Persona fidelity            | `<1-10>`       | Did I behave like Maya while clicking, not only while reporting?                                                                         |
| Human realism               | `<1-10>`       | Did I make plausible customer assumptions, hesitations, mistakes, recoveries, taste judgments, and trust shifts without acting randomly? |
| Question-first behavior     | `<1-10>`       | Did I ask Maya's natural questions before diagnosis?                                                                                     |
| Natural customer navigation | `<1-10>`       | Did the path resemble a real customer session?                                                                                           |
| Credit discipline           | `<1-10>`       | Did I check budget/cost and spend conservatively?                                                                                        |
| Evidence quality            | `<1-10>`       | Were screenshots/files meaningful and not excessive?                                                                                     |
| Behavior metrics quality    | `<1-10>`       | Did I capture useful human behavior signals?                                                                                             |
| Report usefulness           | `<1-10>`       | Can the user and next engineering agent act on the reports?                                                                              |
| Admin publish completion    | `<1-10 / n/a>` | Was the run published to Admin Tester Reports when possible?                                                                             |
| Workspace memory hygiene    | `<1-10>`       | Did I add durable learning only when needed?                                                                                             |
| Stop/resume discipline      | `<1-10 / n/a>` | Did I handle payment, auth, browser, generation, or context interruptions according to SOP?                                              |

Overall score: `<average of applicable numeric scores, rounded to one decimal>`

## Score Rules

- Use `docs/agents/testers/maya-chen/workspace/self-score-ledger.md` as the score authority.
- Do not inflate scores to be polite.
- Use `n/a` only when the category truly did not apply.
- If persona fidelity, human realism, question-first behavior, credit discipline, report usefulness, or stop/resume discipline is below `7`, name the exact correction for the next run.
- If the human nuance card was not loaded or no live note included taste/social-stakes/pride/embarrassment/temptation/trust-shift, score human realism strictly and name the missing cue.
- If Admin publish completion is below `7` and not `n/a`, name whether the blocker was missing access, missing secret, failed ingest, failed verification, or operator error.
- If the same weak score appears in two consecutive runs, update `workspace/memory.md`, `training-history.md`, or the relevant SOP/tool so the correction becomes durable.
- Apply the persona-fidelity cap rules from `self-score-ledger.md` before choosing final scores.
- Add one row to `docs/agents/testers/maya-chen/workspace/self-score-ledger.md` after completing this audit.

## What I Did Well

-

## What I Need To Improve Next Time

-

## Persona Drift Moments

-

## Durable Learning To Add

- `<none / memory entry summary>`
