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
Baseline comparison completed: `<yes / no / not needed>`
Supervised feedback intake needed: `<yes / no>`
If yes, `post-run-learning-intake.md` completed: `<yes / no>`
Clear bug escalation triggered: `<yes / no>`
If yes, `clear-bug-escalation-checklist.md` completed: `<yes / no>`

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
| Bug recognition             | `<1-10 / n/a>` | Did I correctly distinguish objective product breakage from ordinary customer confusion and produce a bug packet when needed?            |
| Admin publish completion    | `<1-10>`       | Did authenticated ingest accept both report bodies and return the expected row and run identifiers?                                      |
| Workspace memory hygiene    | `<1-10>`       | Did I add durable learning only when needed?                                                                                             |
| Stop/resume discipline      | `<1-10 / n/a>` | Did I handle payment, auth, browser, generation, or context interruptions according to SOP?                                              |

Overall score: `<average of applicable numeric scores, rounded to one decimal>`

## Baseline Comparison

Compare against `docs/agents/testers/maya-chen/workspace/baseline-kpi-2026-07-05.md` when a run is scored, when the user asks for performance rating, or when repeated friction appears.

Delta from baseline:

## Improved since baseline:

## Degraded since baseline:

Non-negotiable fail conditions triggered:

- `<none / list>`

## Score Rules

- Use `docs/agents/testers/maya-chen/workspace/self-score-ledger.md` as the score authority.
- Do not inflate scores to be polite.
- Use `n/a` only when the category truly did not apply.
- If persona fidelity, human realism, question-first behavior, credit discipline, report usefulness, or stop/resume discipline is below `7`, name the exact correction for the next run.
- If clear product breakage occurred and no `BUG OVERRIDE` packet was created, Bug recognition cannot score above `4` and Report usefulness cannot score above `6`.
- If the human nuance card was not loaded or no live note included taste/social-stakes/pride/embarrassment/temptation/trust-shift, score human realism strictly and name the missing cue.
- Admin publish completion is never `n/a` for a normal `run test`. If below `7`, name whether the blocker was missing access, missing secret, failed ingest, failed verification, or operator error, and classify the run `partial` or `blocked`.
- If the same weak score appears in two consecutive runs, update `workspace/memory.md`, `training-history.md`, or the relevant SOP/tool so the correction becomes durable.
- Apply the persona-fidelity cap rules from `self-score-ledger.md` before choosing final scores.
- Add one row to `docs/agents/testers/maya-chen/workspace/self-score-ledger.md` after completing this audit.

## Report Intelligence Check

Persona report:

- Customer journey snapshot included: `<yes / no>`
- Product decision signal included: `<yes / no>`
- Customer service simulation included: `<yes / no>`
- What Maya would do next included: `<yes / no>`
- Issue tags included when useful: `<yes / no / not needed>`

Engineering handoff:

- BUG OVERRIDE packet included when clear breakage occurred: `<yes / no / not needed>`
- Decision impact included: `<yes / no>`
- Agent fix packet included for primary issue: `<yes / no / not needed>`
- Acceptance criteria included: `<yes / no / not needed>`
- Validation steps included: `<yes / no / not needed>`
- Protected behavior included: `<yes / no / not needed>`
- Repeat findings linked to prior reports: `<yes / no / not repeated>`
- Validation boundary stated: `<yes / no>`

If any required item is `no`, Report usefulness cannot score above `7` unless the report explains why the section did not apply.

## What I Did Well

-

## What I Need To Improve Next Time

-

## Persona Drift Moments

-

## Post-Run Coach Question

Where did I stop acting like a real customer and start acting like a tester?

Answer:

Correction:

## Durable Learning To Add

- `<none / memory entry summary>`

## Supervised Feedback Intake

Complete this when the user asks for a performance rating, asks whether Maya is adding value, asks what tools Maya needs, or corrects Maya's behavior.

- Explicit user signal:
- Inferred operator intent:
- Risk if ignored:
- Durable artifact updated:
- Next-run proof:

Use `docs/agents/testers/maya-chen/workspace/tools/post-run-learning-intake.md` for the full checklist.
