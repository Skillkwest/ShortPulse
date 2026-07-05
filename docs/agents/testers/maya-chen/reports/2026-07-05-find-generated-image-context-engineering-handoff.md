# Engineering Handoff: Find Generated Image Context

Date: 2026-07-05
Tester: Maya Chen
Scenario: Find the prior paid generated image, recover prompt/project context, and verify reuse without spending credits.
UGC project goal: Tiny Apartment Reset Kit ladder step 4, find it again.
Production surface: `https://www.shortpulse.ai`, `/dashboard`, `/ai-studio`
Session duration: about 35 minutes
Credits spent: 0
Run status: completed

## Summary

Maya could recover the prior generated image, reopen the named project from Dashboard, and drag the image into Quick Slot Inventory for reuse. The main gap is prompt/context recovery: selecting the saved image did not expose the original prompt/details, and the Media `Prompts` filter showed `No prompts found for this folder`.

## Human Behavior Metrics

| Metric                                       | Value                                                                  | Notes                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Time to first confident next step            | `<1 min`                                                               | Homepage showed Launch App.                                                                               |
| Time to basic mental map                     | `~12 min`                                                              | Maya understood Media vs Projects after opening both.                                                     |
| Navigation confidence                        | `4/5`                                                                  | Recovery worked, but project modal was confusing.                                                         |
| Clarifying question count                    | `7`                                                                    | Main questions were sign-in state, save location, project relation, prompt recovery, and reference reuse. |
| Authentic Maya questions before credit spend | `not applicable`                                                       | No spend.                                                                                                 |
| Backtrack count                              | `3`                                                                    | Media first, Projects modal, Dashboard return path.                                                       |
| Human error/backtrack notes                  | `checked Media first; clicked project card before Open card was clear` | Plausible customer path.                                                                                  |
| Human nuance signal                          | `taste / trust shift`                                                  | Output looked usable; prompt gap reduced trust for repeat work.                                           |
| Dead-end count                               | `1`                                                                    | Prompts filter returned no prompt.                                                                        |
| Credit anxiety                               | `1/5`                                                                  | No generation; visible balance remained `346 / 350`.                                                      |
| Spend readiness                              | `2/5`                                                                  | Maya would wait to generate a variant until original prompt/context is recoverable.                       |
| Cost clarity                                 | `clear`                                                                | Generate button visibly showed `4`; no click.                                                             |
| Prompt confidence                            | `not applicable`                                                       | Prompt recovery scenario.                                                                                 |
| Generation wait trust                        | `not applicable`                                                       | No generation.                                                                                            |
| Output usefulness                            | `usable`                                                               | Recovered image fits Maya's renter-reset taste.                                                           |
| Save confidence                              | `4/5`                                                                  | Image persisted in Media/project/Reference Grid.                                                          |
| Find-it-again success                        | `partial`                                                              | Image and project recovered; prompt not recovered.                                                        |
| Review risk                                  | `mild`                                                                 | Trust gap is about repeatability, not asset loss.                                                         |

## Reproduction Steps

1. Open a fresh Chrome window and navigate to `https://www.shortpulse.ai`.
2. Click `Launch App`.
3. If routed to sign-up, switch to Sign in and authenticate as Maya.
4. Observe AI Studio with visible credits `346 / 350`.
5. Open `Media` and confirm one saved generated image appears.
6. Select the image and expand the media panel.
7. Open `Projects`, select `5-minute renter reset tests`, then click the visible `Open ->` card.
8. Observe AI Studio title `5-minute renter reset tests` and Reference Grid `Media: 1/500`.
9. Open `Media` inside the project and select the image.
10. Click `Prompts` in Media.
11. Observe `No prompts found for this folder`.
12. Return to Dashboard, use `Open Projects`, reopen `5-minute renter reset tests`, and observe Reference Grid still contains the image.
13. Drag the Reference Grid image to Quick Slot Inventory and observe it appears there.

## Expected Behavior

Maya expected the prior paid generation to be recoverable with enough context to reuse it: saved image, project relation, and original prompt or prompt details.

## Actual Behavior

The saved image and project were recoverable. The image appeared in Media, in Reference Grid for `5-minute renter reset tests`, and could be dragged into Quick Slot Inventory. However, selecting the image did not show a visible prompt/detail drawer, and the Media `Prompts` filter showed `No prompts found for this folder`.

## Maya's Interpretation

Maya trusts that the image saved, but she does not trust that ShortPulse preserved the generation context she needs to make a second version later.

## Human Realism Notes

Maya checked Media before Projects because she was looking for an image. She felt relieved when the image appeared, then became less confident when prompt recovery failed.

## Maya Nuance Notes

- Taste judgment: the recovered image was calm, realistic, and usable for a renter-reset post.
- Social-stakes worry: without the prompt, Maya would have to reconstruct a repeatable style manually.
- Moment of trust shift: image recovery raised trust; empty Prompts filter lowered trust for reuse.
- How this changed Maya's next visible action: she stopped short of generating a variant and tested reuse by dragging to Quick Slot Inventory instead.

## Evidence

- Screenshots:
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-05-find-generated-image-context/01-media-one-saved-item.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-05-find-generated-image-context/03-expanded-media-panel.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-05-find-generated-image-context/05-opened-renter-reset-project.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-05-find-generated-image-context/06-after-clicking-open-project-card.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-05-find-generated-image-context/10-prompts-filter-after-generation.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-05-find-generated-image-context/14-after-drag-reference-to-quick-slot.png`
- Prompt used: not recoverable through visible UI in this run.
- Visible model/workflow: Create, Standard mode, Seedream 4.5, 9:16 Vertical, 2K.
- Visible credit cue: `346 / 350`; Generate showed `4`; no generation clicked.
- Errors/messages: `No prompts found for this folder.`

## Findings

### Finding 1: Generated image is recoverable, but original prompt/context is not visible

Severity: data or saved-work risk

Customer risk:

- Maya can find the asset but cannot confidently reuse or iterate the generation setup.
- This weakens ShortPulse as a repeatable creator workflow, especially for content series work.

Suggested engineering investigation:

- Inspect generated-media metadata persistence and Media Library detail surfaces.
- Verify whether generated prompts are stored as prompt media, media metadata, generation records, or project state.
- Verify whether the Media `Prompts` filter is expected to include generated prompts or only manually saved prompt items.
- If generated prompts are intentionally stored elsewhere, make the visible recovery path clear from selected media.

### Finding 2: Project picker briefly hides or weakens the named project identity

Severity: workflow confusion

Customer risk:

- Maya could see `5-minute renter reset tests`, but after interacting with the project card, the visible modal state emphasized `Open ->` and `Untitled Project`.
- This made Maya unsure whether she was opening the right project.

Suggested engineering investigation:

- Inspect the Projects modal selected/open-card state.
- Ensure selected project cards preserve the project name visibly next to the Open action.

### Finding 3: Reference Grid to Quick Slot Inventory reuse works visually

Severity: positive

Customer value:

- After reopening the project, Maya could drag the recovered image into Quick Slot Inventory.
- This gives Maya a viable non-spend reuse step even when prompt recovery is weak.

## Non-Goals

- No new image generation.
- No video/audio generation.
- No billing changes.
- No destructive cleanup or delete actions.
- No direct database/API inspection of saved media state.

## Admin Publish Status

- Status: not published
- External run id: `2026-07-05-find-generated-image-context`
- Admin tab verification: not applicable
- Notes: `SHORTPULSE_TESTER_REPORT_INGEST_SECRET` was not available in the local environment.

## Maya Self-Audit Summary

- Persona fidelity: 9
- Human realism: 9
- Question-first behavior: 9
- Evidence quality: 8
- Admin publish completion: n/a
- Stop/resume discipline: 9
- Next improvement: Keep the same nuance level, but timebox screenshot capture even more tightly.
