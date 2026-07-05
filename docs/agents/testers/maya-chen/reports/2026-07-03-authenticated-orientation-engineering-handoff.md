# Engineering Handoff: Authenticated Orientation

Date: 2026-07-03
Tester: Maya Chen
Scenario: Logged-in dashboard and AI Studio orientation before spending credits
Production surface: `https://www.shortpulse.ai/dashboard`, `https://www.shortpulse.ai/ai-studio`, `https://www.shortpulse.ai/profile?section=credits`
Session duration: about 35 minutes
Credits spent: none

## Summary

Authenticated orientation succeeded through dashboard, project opening, AI Studio entry, credit inspection, model-cost inspection, text-reference pinning, and a no-spend save attempt. The highest-risk customer issues were prompt draft loss after navigating to credits, unclear save/find-it-again behavior between Reference Grid and Media Library, and `My Generations` being visible but marked `COMING SOON`.

## Human Behavior Metrics

- Time to first confident next step: about 2 minutes
- Time to basic mental map: about 15 minutes
- Navigation confidence: 3/5
- Feature recognition count: 12 major areas
- Clarifying question count: 9
- Backtrack count: 4
- Dead-end count: 2
- Credit anxiety: 3/5
- Spend readiness: 2/5
- Save confidence: 2/5
- Review risk: moderate

## Reproduction Steps

1. Open a new Google Chrome window with an authenticated ShortPulse session.
2. Navigate to `https://www.shortpulse.ai/dashboard`.
3. Observe dashboard cards and account summary.
4. Click `Open Projects`.
5. Open project `Mayaa chen`.
6. In AI Studio, inspect `Create`, left navigation, right rail, Reference Grid, and Media Library.
7. Type an image prompt into the Create prompt textarea.
8. Open model selector by clicking `Seedream 4.5`; observe visible model credit costs.
9. Navigate to the credits page from the `CREDITS 100 / 0` link.
10. Return to AI Studio using browser history.
11. Observe the prompt textarea state.
12. Re-enter a prompt, click `Pin text reference to reference grid`, then click `Save to media library`.
13. Open `Media` and inspect All Media/Prompts-style saved-work area.

## Expected Behavior

A new creator should be able to inspect credit balance and model costs without losing a drafted prompt. After using `Save to media library`, the user should receive clear confirmation and should be able to find the saved prompt in Media Library or receive clear copy explaining that the item is only in Reference Grid.

## Actual Behavior

- Dashboard showed `AI CREDITS 100`, then AI Studio showed `CREDITS 100 / 0`.
- Project library opened and showed existing projects with adjacent delete controls.
- AI Studio opened project `Mayaa chen` successfully.
- Model selector showed costs: Seedream 4.5 `4`, Seedream 5 Lite `4`, Nano Banana 2 `5`, Nano Banana Pro `8`, GPT Image 2 `2`, FLUX.2 Lite `2`.
- A drafted prompt was lost after navigating from AI Studio to `profile?section=credits` and returning with browser history.
- `My Generations` page showed `COMING SOON` and described itself as the gallery for generated content.
- Pinned text reference appeared in Reference Grid and changed count to `Media: 1/500`.
- After clicking `Save to media library`, the visible save button disappeared, but Media Library still showed `No saved items found` and `Loaded 0 media items (all loaded)` while Reference Grid still showed the prompt.

## Maya's Interpretation

Maya could build a rough map of the product, but she did not trust saved work yet. She interpreted the prompt loss as a sign that drafts are fragile. She interpreted the save-to-media-library result as either a failed save, a hidden save, or an unclear distinction between Reference Grid and Media Library. She would not spend credits until that flow feels safer.

## Evidence

- Screenshots:
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-03-fresh-authenticated-orientation/01-dashboard-or-start.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-03-fresh-authenticated-orientation/02-open-projects.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-03-fresh-authenticated-orientation/03-ai-studio-project-open.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-03-fresh-authenticated-orientation/04-my-generations.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-03-fresh-authenticated-orientation/05-media-library.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-03-fresh-authenticated-orientation/06-create-prompt-prep.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-03-fresh-authenticated-orientation/07-model-menu.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-03-fresh-authenticated-orientation/08-profile-credits.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-03-fresh-authenticated-orientation/09-return-ai-studio.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-03-fresh-authenticated-orientation/12-pin-text-reference-result.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-03-fresh-authenticated-orientation/13-save-to-media-library.png`
  - `docs/agents/testers/maya-chen/reports/assets/2026-07-03-fresh-authenticated-orientation/14-media-after-save.png`
- Prompt used:

```text
Calm realistic vertical image for a five-minute apartment reset routine, warm natural light, tidy small kitchen, practical creator style, no text.
```

- Visible model/workflow: Create, Standard, Text-to-Image, Seedream 4.5 selected, 9:16 Vertical, 2K.
- Visible credit cue: dashboard `AI CREDITS 100`; AI Studio `CREDITS 100 / 0`; profile `AVAILABLE BALANCE 100`, `NEXT RENEWAL Not scheduled`, `INCOMING CREDITS +0`.
- Visible save/find copy: `Save to media library`, `No saved items found for this folder`, `Loaded 0 media items (all loaded)`, Reference Grid `Media: 1/500`.

## Impact

Severity: high friction

Customer risk:

- Maya is unlikely to spend credits if prompt drafts can disappear while checking credits.
- `My Generations COMING SOON` conflicts with the customer expectation that generated work will have a reliable gallery.
- Save-to-media ambiguity weakens the most important trust promise: "I can find my work again."

## Suggested Engineering Investigation

- Inspect AI Studio draft persistence across navigation away from `/ai-studio` and browser-history return.
- Verify whether `Pin text reference to reference grid` is intended to create session-only reference state or durable media.
- Verify what `Save to media library` does for text references and why Media Library still reports zero saved items afterward.
- Review copy/state alignment between Reference Grid count, Media Library saved count, and `My Generations`.
- Consider whether `CREDITS 100 / 0` needs a clearer label for available/reserved/used credits.
- Review project library delete-button proximity and affordance; Maya noticed delete controls beside project choices during orientation.

## Non-Goals

- No generation was run.
- No video, audio, voice, billing purchase, subscription change, account setting change, or destructive cleanup was tested.
- A Prompts-filter follow-up was not used as evidence because Chrome window ordering shifted during that final check and mixed sessions; the validated evidence stops at the active fresh window's Media state after save.
