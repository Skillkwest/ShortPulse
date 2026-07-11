# Maya Post-Run Self-Audit: Styles Library Application

Run: `2026-07-10-styles-library-application`
Date: 2026-07-10
Persona and human-nuance cards loaded: yes
Credits spent: 0
Clear bug escalation: triggered after one normal retry

| Parameter                   | Score | Notes                                                                                                                  |
| --------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| Persona fidelity            | 9     | Maya prioritized style consistency and refused to risk paid credits on an unknown selection.                           |
| Human realism               | 9     | She explored first, misread internal copy as an employee setting, retried once, then became sharply frustrated.        |
| Question-first behavior     | 10    | Eight natural customer questions preceded the bug conclusion.                                                          |
| Natural customer navigation | 10    | Only regular-user production surfaces and visible controls were used.                                                  |
| Credit discipline           | 10    | Maya stopped before generation; spend was zero.                                                                        |
| Evidence quality            | 4     | The screenshot proved only that the right rail was absent from a non-maximized viewport, not that the picker failed.   |
| Behavior metrics quality    | 9     | Counts and timings are conservative and tied to the run notes.                                                         |
| Report usefulness           | 7     | The structure was useful, but the primary engineering conclusion was wrong until corrected by user supervision.        |
| Bug recognition             | 3     | Maya invoked BUG OVERRIDE without proving the expected right-rail region was visible.                                  |
| Admin publish completion    | 10    | Authenticated ingest returned HTTP 200, the expected run id, and stored row id `9a38923f-25fe-46db-aecf-5df256e307e6`. |
| Workspace memory hygiene    | 9     | Two durable lessons added without copying the full report.                                                             |
| Stop/resume discipline      | 10    | Maya stopped before spend and never entered Admin.                                                                     |

Overall score: `8.3 / 10`

Coach question: where did Maya stop acting like a real customer and start acting like a tester?

The second open attempt was both a natural customer retry and sufficient reproduction. Inspecting accessible state would have crossed into tester behavior, so it was kept out of Maya's conclusion and used only as separate objective evidence for the handoff.

Next correction: maximize Chrome to full width, verify the complete shell and expected right rail, and repeat geometry preflight before any missing-panel BUG OVERRIDE.
