# Maya Behavior Metrics Template

Use this metrics block in both Maya reports and engineering handoffs when practical.

| Metric                                       | Value                                                                                        | Notes                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Time to first confident next step            | `<duration / not measured>`                                                                  | How long before Maya knew what to do next.                                   |
| Time to basic mental map                     | `<duration / not measured>`                                                                  | How long before Maya could explain the main workflow in her own words.       |
| Navigation confidence                        | `<1-5>`                                                                                      | `1` = lost, `5` = clear.                                                     |
| Clarifying question count                    | `<number>`                                                                                   | Count "what is this / where does this go / does this cost credits" moments.  |
| Authentic Maya questions before credit spend | `<number / not applicable>`                                                                  | Count customer questions recorded before any credit-spending action.         |
| Backtrack count                              | `<number>`                                                                                   | Times Maya reversed, abandoned, or corrected a path.                         |
| Human error/backtrack notes                  | `<short notes / none observed>`                                                              | Plausible mistakes, wrong first guesses, or recoveries that shaped the run.  |
| Human nuance signal                          | `<taste / pride / embarrassment / temptation / social stakes / trust shift / none observed>` | The human cue that shaped Maya's next action or judgment.                    |
| Dead-end count                               | `<number>`                                                                                   | Places where Maya could not find a natural next step.                        |
| Credit anxiety                               | `<1-5>`                                                                                      | `1` = relaxed, `5` = afraid to click.                                        |
| Spend readiness                              | `<1-5>`                                                                                      | `1` = not ready, `5` = ready to spend.                                       |
| Cost clarity                                 | `<clear / unclear / hidden / not encountered>`                                               | Whether cost was visible before spend.                                       |
| Prompt confidence                            | `<1-5 / not applicable>`                                                                     | Maya's confidence in the prompt before generation.                           |
| Generation wait trust                        | `<reassured / uncertain / anxious / not applicable>`                                         | Whether progress feedback felt trustworthy.                                  |
| Output usefulness                            | `<unusable / maybe usable / usable / strong / not applicable>`                               | Maya's customer view of the output.                                          |
| Save confidence                              | `<1-5>`                                                                                      | `1` = no idea where work went, `5` = trusts she can find it.                 |
| Find-it-again success                        | `<yes / no / partial / not tested>`                                                          | Whether Maya could recover the project/output/prompt later.                  |
| Review risk                                  | `<none / mild / moderate / high>`                                                            | Risk Maya would complain or warn other creators.                             |
| Customer support risk                        | `<none / low / medium / high>`                                                               | Likelihood Maya would contact support, request credits, or need reassurance. |
| Retention risk                               | `<none / low / medium / high>`                                                               | Whether Maya would keep using the workflow after this run.                   |
| Product decision signal                      | `<trust / retention / support / credits / launch readiness / positive>`                      | Main product decision area affected by the run.                              |
| Repeat finding                               | `<yes / no>`                                                                                 | Whether the same friction appeared in prior Maya reports.                    |

## Metric Notes

- Use Maya's customer perception, not engineering certainty.
- If a value is not measured, say `not measured` instead of guessing.
- Include one short note for each low or high-risk score.
- When `Repeat finding` is `yes`, link the prior report in the engineering handoff.
