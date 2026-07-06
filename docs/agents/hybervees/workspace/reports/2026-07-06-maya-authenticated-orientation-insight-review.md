# Hybervees Insight Review: Maya Authenticated Orientation

## Review Metadata

- Date: 2026-07-06
- Reviewer: Hybervees
- Report source: local tester artifacts
- Source freshness: reports dated 2026-07-03; reviewed from repo on 2026-07-06
- Reports reviewed:
  - `docs/agents/testers/maya-chen/reports/2026-07-03-authenticated-orientation-maya-report.md`
  - `docs/agents/testers/maya-chen/reports/2026-07-03-authenticated-orientation-engineering-handoff.md`
- Tester: Maya Chen
- Scenario: Logged-in dashboard and AI Studio orientation before spending credits
- Production surfaces: `https://www.shortpulse.ai/dashboard`, `https://www.shortpulse.ai/ai-studio`, `https://www.shortpulse.ai/profile?section=credits`
- Evidence boundary: local tester artifact source. This run did not use the browser as the report source; deployed admin review-state marking still requires an authenticated admin API/data path or manual admin-page action.

## Executive Read

Short answer: Maya understood that ShortPulse could become a serious creator workspace, but she did not trust it enough to spend credits because she could not prove that drafted prompts and saved work would be recoverable.

Highest-ROI product decision: make saved-work continuity obvious before generation spend. The product should preserve draft prompts across credit-check navigation and give one unambiguous "where this went" confirmation after a user pins or saves a prompt/reference.

Main confidence limit: this is one early orientation run, not a repeated pattern across many testers yet. The signal is still high-value because it occurred before any spend, in the exact trust-building window where creators decide whether a credit-based tool is safe to try.

## Reports Reviewed

| Run id or path                         | Tester    | Scenario                                                              | Status                                            | Surface                                                           | Notes                                                                                                  |
| -------------------------------------- | --------- | --------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `2026-07-03-authenticated-orientation` | Maya Chen | Logged-in dashboard and AI Studio orientation before spending credits | No-spend orientation completed with high friction | Dashboard, AI Studio, credits page, Media Library, Reference Grid | Maya built a rough product map but stopped before generation because save/recovery trust was too weak. |

## Top Insights

| Priority | Surface                        | Theme                               | Insight                                                                                                 | Evidence                                                                                                                          | Impact                                                                                           | Confidence        |
| -------- | ------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------- |
| P1       | AI Studio draft state          | Trust / workflow friction           | Prompt draft loss during a credits-page detour is a pre-spend trust breaker.                            | Maya typed a realistic prompt, checked credits, returned with browser history, and the prompt was gone.                           | High: this can stop a creator before first generation.                                           | High for this run |
| P1       | Reference Grid / Media Library | Comprehension / saved-work trust    | `Save to media library` did not create a findable outcome in Maya's mental model.                       | The save button disappeared, but Media still showed no saved items while the prompt remained visible in Reference Grid.           | High: undermines the core promise that work can be found later.                                  | High for this run |
| P2       | AI Studio navigation           | Information architecture            | `My Generations COMING SOON` conflicts with the expectation that generated work has a reliable gallery. | Maya interpreted My Generations as the obvious place to find future work, then hit a dead-end.                                    | Medium-high: creates concern before generation and may increase support burden after generation. | Medium            |
| P2       | Credits display                | Pricing / credit anxiety            | `CREDITS 100 / 0` was technically visible but semantically unclear.                                     | Maya understood 100 but paused on `/ 0`; profile later showed available balance, next renewal, and incoming credits more clearly. | Medium: not a blocker by itself, but it compounds spend hesitation.                              | Medium-high       |
| P3       | Project library                | Safety / destructive-action anxiety | Delete controls near project choices may raise avoidable caution during first orientation.              | Maya noticed adjacent delete controls while browsing existing projects.                                                           | Low-medium: not the main blocker, but it adds early caution.                                     | Low-medium        |

## Customer Feeling And Understanding

What Maya appeared to believe:

- Dashboard starts the work.
- Projects organize the work.
- AI Studio is where creation happens.
- Reference Grid holds active working references.
- Media Library should be where saved prompts/media can be found again.
- My Generations sounds like the future gallery for generated outputs.

What created trust:

- The dashboard gave clear first choices.
- Credit balance was visible across dashboard, studio, and profile.
- The model menu showed concrete per-model credit costs.
- Pinning a text reference gave immediate visible feedback in Reference Grid.

What reduced trust:

- Her prompt disappeared after she left AI Studio to inspect credits.
- The save action removed the button without making the saved destination obvious.
- Media Library still looked empty after the save attempt.
- My Generations looked like the right destination but was unavailable.

Where she hesitated:

- Before spending credits.
- While interpreting `CREDITS 100 / 0`.
- After seeing My Generations unavailable.
- After save-to-media-library failed to produce a findable item.

Where she might abandon or ask for support:

- "Where did my prompt go after checking credits?"
- "Did Save to media library actually save anything?"
- "Where do generated images live if My Generations is coming soon?"

What felt valuable:

- The product looked powerful enough for real creator workflow.
- Model cost visibility made spending feel more understandable once discovered.
- Reference Grid became more understandable after a prompt was pinned.

What felt like wasted time, effort, or credits:

- Re-entering a prompt after navigation.
- Hunting Media Library after a save action that did not surface a findable result.
- Trying to reason through Reference Grid vs Media vs My Generations without clear workflow copy.

## Engineering Follow-Up Candidates

| Candidate                                                                                         | Evidence                                                                       | Suspected owner lane                                            | Next proof                                                                                                            | Confidence  |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------- |
| Preserve Create prompt draft across navigation away from `/ai-studio` and browser-history return. | Draft prompt was lost after visiting `/profile?section=credits` and returning. | D-Bug / Babineaux, with Abismia for UX confirmation             | Code inspection plus production browser validation with an authenticated account.                                     | High        |
| Clarify or fix text-reference `Save to media library` behavior.                                   | Button disappeared, but Media Library showed zero saved items.                 | D-Bug / Babineaux for persistence; Abismia for destination copy | Determine whether text references are meant to become media rows, prompt-library entries, or session-only references. | High        |
| Reconcile Reference Grid count, Media Library count, and saved prompt destination.                | Reference Grid showed media count growth while Media Library stayed empty.     | Abismia / D-Bug                                                 | Inspect current UI copy and data contracts for text references.                                                       | Medium-high |
| Replace or contextualize `My Generations COMING SOON` in pre-launch customer navigation.          | Maya treated it as the natural find-work-later destination.                    | Abismia / Copperknot                                            | Decide whether to hide, relabel, or point users to the real saved-output path during launch window.                   | Medium      |
| Clarify `CREDITS 100 / 0`.                                                                        | Maya understood available credits but not the second number.                   | Money Stuff / Abismia                                           | Confirm intended meaning and add compact label or tooltip.                                                            | Medium      |

## Product Decision Candidates

| Decision                                                                                                | Why it matters                                                                               | Evidence strength                                  | Owner lane           | Recommendation                                                                           |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| Make "find my work later" the first trust checkpoint for new creators.                                  | Maya would not spend credits until save/recovery felt reliable.                              | Strong single-run evidence, aligned with Maya ICP. | Abismia / Copperknot | Recommended for launch-readiness prioritization.                                         |
| Treat draft persistence as a core paid-conversion feature, not polish.                                  | Credit-check navigation is a natural pre-spend behavior; losing draft text punishes caution. | Strong for this run.                               | D-Bug / Babineaux    | Recommended for technical inspection.                                                    |
| Avoid exposing unfinished generated-history surfaces without a redirect to the current saved-work path. | My Generations sets an expectation the product cannot currently satisfy.                     | Medium single-run evidence.                        | Abismia / Copperknot | Candidate: hide, relabel, or explain.                                                    |
| Use explicit destination copy after save actions.                                                       | A disappearing button is not enough confirmation for a new user.                             | Strong for this run.                               | Abismia              | Recommended: confirmation should name the destination and offer a direct way to open it. |

## Patterns Versus One-Offs

Repeated or likely recurring:

- New creators will check credits before generating.
- New creators will expect saved prompts and generated media to be findable in one obvious place.
- "Reference Grid vs Media Library vs My Generations" is likely a recurring mental-model problem unless the UI teaches the relationship through action outcomes.

One-off or not enough evidence yet:

- The specific project name `Mayaa chen` and delete-control proximity are lower-confidence until another first-run tester reacts similarly.
- The exact `CREDITS 100 / 0` interpretation needs current UI confirmation because the report is three days old and related billing/admin work has moved since then.

What not to overreact to:

- Do not remove advanced areas just because Maya saw many features. The issue was not power; it was uncertainty about where work goes.
- Do not assume text references must become Media Library rows without checking the product intent. The product decision is that the destination must be clear, not necessarily that every text reference belongs in Media.

## Missing Proof

- Current deployed behavior after the 2026-07-06 deploy has not been rechecked from an authenticated browser.
- The matching deployed admin row was not marked reviewed in this run because Hybervees used local artifacts as the report source and did not have a separate authenticated admin API/data path available.
- No engineering source inspection was performed in this Hybervees analysis lane.
- No second tester has confirmed whether the same save/draft concern repeats.

## Next Actions

1. Run a focused owner-lane inspection on AI Studio draft persistence across `/profile?section=credits` navigation and browser-history return.
2. Decide the product destination for saved text references, then align button copy, confirmation state, Reference Grid count, and Media Library visibility.
3. Re-test with Maya or Bopper after the save/draft path is clarified, then mark the deployed admin row Hybervees reviewed through an authenticated admin API/data path or the admin page.
