# Hybervees Insight Review: Maya Find Generated Image Context

## Review Metadata

- Date: 2026-07-07
- Reviewer: Hybervees
- Report source: production `tester_report_runs` row plus local tester artifacts
- Source freshness: tester run created in production Admin Tester Reports on 2026-07-05; reviewed by Hybervees on 2026-07-07
- Reports reviewed:
  - `docs/agents/testers/maya-chen/reports/2026-07-05-find-generated-image-context-maya-report.md`
  - `docs/agents/testers/maya-chen/reports/2026-07-05-find-generated-image-context-engineering-handoff.md`
- Tester: Maya Chen
- Scenario: return to ShortPulse, find the image Maya paid credits to create, and see whether she can reuse it
- Production surfaces: `https://www.shortpulse.ai/dashboard`, `https://www.shortpulse.ai/ai-studio`
- Evidence boundary: authenticated production admin data confirmed the row was unreviewed; analysis used the retained local report bodies and evidence manifest. I did not run a new live browser validation.

## Executive Read

Short answer: ShortPulse passed the basic saved-asset test but failed the repeatable-work test. Maya found her paid image again, trusted that the image was saved, and could reuse it visually in Quick Slot Inventory. She still would not spend credits on a variant because the prompt/setup that created the image was not obvious from the path she naturally tried.

Highest-ROI product decision: make generated-media context recovery obvious from the selected saved asset path. A creator who opens a saved generated image should see the original prompt/setup or a clear reload/reuse action, and if that context is unavailable the UI should say so plainly.

Main confidence limit: current repo docs/code indicate workflow reload and generated prompt metadata now exist. This report proves Maya missed or lacked that recovery path in the production run; it does not prove the current implementation lacks prompt storage.

## Reports Reviewed

| Run id or path                            | Tester    | Scenario                                          | Status    | Surface                 | Notes                                                       |
| ----------------------------------------- | --------- | ------------------------------------------------- | --------- | ----------------------- | ----------------------------------------------------------- |
| `2026-07-05-find-generated-image-context` | Maya Chen | Find paid generated image and reuse context later | completed | Dashboard and AI Studio | Earliest unreviewed Admin Tester Reports row at review time |

## Top Insights

| Priority | Surface                                            | Theme                  | Insight                                                                                                                         | Evidence                                                                                               | Impact          | Confidence                                                     |
| -------- | -------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------- | -------------------------------------------------------------- |
| P1       | AI Studio / Media Library / generated media detail | Paid-use trust         | Saved image recovery is necessary but not sufficient; creators need the prompt/setup to feel safe spending again.               | Maya found the image and project, then stopped short of generating because the prompt was not visible. | High            | High for user feeling; medium for current implementation state |
| P1       | Media Library selected-image path                  | Workflow comprehension | Maya's natural path was "select saved image, look for details/prompt," not "know which hidden detail/reload affordance exists." | Report says selecting/expanding media did not expose prompt/details; Prompts filter showed empty.      | High            | Medium-high                                                    |
| P2       | Projects modal                                     | Continuity clarity     | The project picker briefly weakened the named project identity by showing `Open ->` near `Untitled Project`.                    | Maya saw the named project but was unsure after interacting with the card.                             | Medium          | Medium                                                         |
| Positive | Reference Grid / Quick Slot Inventory              | Reuse confidence       | Dragging the recovered image into Quick Slot Inventory worked and gave Maya a no-spend reuse path.                              | Report says the image appeared in Reference Grid and dragging into Quick Slot worked visually.         | Medium positive | High                                                           |

## Customer Feeling And Understanding

What Maya appeared to believe:

Maya believed ShortPulse did save the image. She did not believe ShortPulse had made the creative recipe recoverable enough for repeat work. That distinction matters: the app felt less like it lost her asset and more like it kept the artifact while hiding the reason it exists.

What created trust:

- The saved image appeared in Media.
- The named project reopened.
- The Reference Grid still contained the media.
- The image could be dragged into Quick Slot Inventory.
- Credit balance stayed visible and unchanged because she did not generate.

What reduced trust:

- Launch App sent her toward sign-up before she switched to sign-in.
- Project selection briefly looked like `Open ->` plus `Untitled Project`.
- Selecting/expanding the saved image did not expose prompt/details in her observed path.
- The `Prompts` filter returned `No prompts found for this folder`, which read like the prompt was gone.

Where Maya hesitated:

She hesitated at the exact moment ShortPulse needed her to trust another credit spend. The image was useful, but without the original prompt or setup she felt she would have to reverse-engineer her own prior work.

Where Maya might abandon or ask for support:

She would likely keep using the app for the project, but she would delay or avoid variant generation. Support risk is mild but real: the complaint would be "I found my image, but where is the prompt I used?"

What felt valuable:

The saved image itself felt usable and taste-aligned. Quick Slot reuse also worked as a visible next step.

What felt like wasted time, effort, or credits:

No credits were wasted in this run. The perceived waste is future-facing: if the prompt is not recoverable, then paid generation feels harder to repeat and iterate.

## Engineering Follow-Up Candidates

| Candidate                                                                                             | Evidence                                                                                                             | Suspected owner lane       | Next proof                                                                                                                                     | Confidence  |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Validate current production generated-media detail and reload behavior from Maya's natural Media path | Current docs/code indicate prompt metadata and workflow reload exist; Maya still did not find them in production run | Holomony / Abismia / D-Bug | In production, open a generated image from Media Library and verify whether prompt/setup/reload are visible without knowing internal shortcuts | Medium-high |
| Make selected generated media expose context recovery clearly                                         | Selecting/expanding media did not show Maya the prompt/details she needed                                            | Abismia / Holomony         | UX inspection of selected media state, detail modal entry point, top-bar action labels, and empty `Prompts` tab wording                        | Medium      |
| Preserve project identity in project-picker selected/open state                                       | Maya saw the named project but got confused by `Open ->` and `Untitled Project`                                      | Abismia / D-Bug            | Inspect Projects modal selected-card/open-card state and test with named project                                                               | Medium      |

## Product Decision Candidates

| Decision                                                                                                            | Why it matters                                                                                      | Evidence strength                                                          | Owner lane                 | Recommendation                                                                                          |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Treat generated prompt/setup recovery as part of paid-output ownership                                              | Creators buy repeatable creative momentum, not only one saved image                                 | Strong single-run signal; reinforced by earlier saved-work trust pattern   | Abismia / Holomony / D-Bug | Recommended as a high-ROI backlog item scoped to validation plus discoverability                        |
| Do not make the `Prompts` tab responsible for generated image prompts if it is intentionally for saved prompt cards | Forcing generated prompt history into a prompt-card filter may blur current media-library semantics | Current SOP says `Prompts` is prompt-only; code has detail/reload concepts | Holomony / Abismia         | Keep the recovery path on generated-media detail/reload unless owner decides otherwise                  |
| Preserve project names next to open actions                                                                         | Project identity is a trust anchor when users return later                                          | Medium single-run signal                                                   | Abismia                    | Candidate; pair with existing project continuity copy backlog rather than opening a standalone lane yet |

## Patterns Versus One-Offs

Repeated or likely recurring:

- Saved-work trust is now a repeated Maya pattern. Earlier she hesitated before spending because draft/save continuity felt unclear; this run shows the same trust need after spending.
- The customer mental model is practical and simple: "I made this, I should be able to find the image and the recipe."

One-off or not enough evidence yet:

- The exact Project modal `Untitled Project` confusion should be checked in current production before it becomes a standalone implementation lane.
- The empty `Prompts` filter is not automatically a bug. It may be correct if generated media prompt metadata lives in detail/reload surfaces rather than saved prompt cards.

What not to overreact to:

- Do not rebuild prompt storage from this report alone. Current repo sources already describe generated prompt metadata and workflow reload.
- Do not reopen retired `My Generations` work.
- Do not treat "image was found" as full success; Maya's spend readiness stayed low.

## Missing Proof

- Current production proof of generated media detail/reload after the latest deploy.
- Whether Maya missed a double-click/detail-modal affordance, or whether the deployed UI at the time did not expose the prompt/setup.
- Whether the Project modal selected-card confusion still reproduces in current production.

## Next Actions

1. Add one backlog item for generated-media context recovery discoverability and production validation.
2. Run an Abismia/Holomony validation pass: from Media Library, open a saved generated image as a normal user and verify prompt/setup/reload visibility.
3. If current production already shows the prompt and reload action, improve labels/entry points rather than storage.
4. If current production cannot recover prompt/setup for generated media, route a D-Bug/Babineaux investigation into `generation_projection`, `project_output_display_items`, media detail data, and workflow reload hydration.
