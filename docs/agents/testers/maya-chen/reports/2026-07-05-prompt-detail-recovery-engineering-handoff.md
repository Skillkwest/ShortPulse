# Engineering Handoff: Prompt Detail Recovery

Date: 2026-07-05
Tester: Maya Chen
Scenario: Recover prompt/model/details for the first paid generated image without spending credits.
UGC project goal: Tiny Apartment Reset Kit ladder step 4, recover context.
Production surface: `https://www.shortpulse.ai`, `/ai-studio`
Session duration: about 33 minutes including one browser-control recovery.
Credits spent: 0
Run status: completed

## Summary

The previous prompt/context gap is partially resolved from the customer perspective: generated media detail does expose the original prompt plus model/aspect/quality details. However, discoverability is weak. Single-clicking the media thumbnail selects it and surfaces bulk actions, while double-clicking opens the detail modal. The Media `Prompts` filter still says `No prompts found for this folder`, which conflicts with Maya's expectation that generated prompts should be findable there.

## Human Behavior Metrics

| Metric                            | Value                                                               | Notes                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Time to first confident next step | `<1 min`                                                            | Homepage `Launch App` was obvious.                                                                                       |
| Time to prompt recovery           | `~15 min`                                                           | Login, Media open, single-click selection, expand attempt, then double-click detail.                                     |
| Navigation confidence             | `4/5`                                                               | Maya can now recover prompt details, but the path is not obvious.                                                        |
| Clarifying question count         | `8`                                                                 | Main questions covered returning login, save location, detail path, project relation, Prompts filter, and copy feedback. |
| Backtrack count                   | `3`                                                                 | Signup to sign-in, Media before project, resume after browser-control interruption.                                      |
| Dead-end count                    | `1`                                                                 | Prompts filter remained empty.                                                                                           |
| Human error/backtrack notes       | `single-click selected item; Prompts checked after detail recovery` | Plausible customer behavior.                                                                                             |
| Credit anxiety                    | `1/5`                                                               | No generation; visible balance stayed `346 / 350`.                                                                       |
| Spend readiness                   | `4/5`                                                               | Maya would make one low-cost variant next because prompt/context are recoverable.                                        |
| Prompt recovery success           | `yes`                                                               | Full prompt visible in Media Detail.                                                                                     |
| Save confidence                   | `4/5`                                                               | Project and image context are recoverable.                                                                               |
| Review risk                       | `mild`                                                              | Discoverability/copy feedback risk, not data-loss risk.                                                                  |

## Reproduction Steps

1. Open a fresh Google Chrome window to `https://www.shortpulse.ai`.
2. Click `Launch App`.
3. If routed to signup, switch to `Sign in` and authenticate as Maya.
4. In AI Studio, confirm visible credits `346 / 350`.
5. Open `Media`.
6. Observe one saved image.
7. Single-click the image.
8. Observe `1 item selected`, `Clear`, and `Delete from library`; no detail text is visible.
9. Double-click the image.
10. Observe `MEDIA DETAIL` modal with generated image details:
    - `Image`
    - `9:16`
    - `2K`
    - `Seedream 4.5`
    - full prompt body
11. Open `Projects`, then open `5-minute renter reset tests`.
12. Observe project title and Reference Grid `Media: 1/500`.
13. Double-click the Reference Grid image.
14. Observe the same Media Detail modal and prompt.
15. Open `Media`, then click `Prompts`.
16. Observe `No prompts found for this folder.`

## Expected Behavior

Maya expected an obvious customer path from a saved generated image to its prompt/details, preferably through visible language such as `Details`, `View prompt`, or `Open`. She also expected the `Prompts` filter to help recover prompts or explain why generated-image prompts do not live there.

## Actual Behavior

Prompt recovery works through Media Detail, but opening that detail depends on double-clicking the thumbnail or reference image. Single-clicking looks like a selection/bulk-action state. The `Prompts` filter remains empty even though generated media detail contains a prompt.

## Findings

### Finding 1: Prompt/details are recoverable, but the detail entry point is not obvious

Severity: workflow confusion

Customer risk:

- A normal creator may single-click the media item, see bulk actions, and conclude details are unavailable.
- Delete being prominent in the selected state makes exploration feel riskier.

Suggested investigation:

- Inspect Media Library card interactions and visible affordances.
- Consider whether generated media cards should expose a clear `Details`, `View prompt`, or `Open` action.
- Preserve existing double-click behavior if intentional, but do not make it the only discoverable path.

### Finding 2: `Prompts` filter conflicts with generated-image prompt recovery expectations

Severity: data or saved-work risk

Customer risk:

- Maya sees `No prompts found for this folder` and may incorrectly believe the prompt is lost.
- This creates a trust gap even though the prompt exists in Media Detail.

Suggested investigation:

- Clarify whether generated-image prompts should appear in the Prompts filter.
- If not, add empty-state copy explaining where generated-image prompts live.
- If yes, inspect why generated media prompt records are not included there.

### Finding 3: Copy prompt action has weak visible feedback

Severity: visual/copy friction

Customer risk:

- Maya clicked `Copy prompt` but did not observe an obvious confirmation.
- This is minor, but it matters because prompt reuse is the purpose of the flow.

Suggested investigation:

- Verify whether a toast appears and whether it is visible long enough.
- If no toast exists, add a small confirmation such as `Prompt copied`.

## Positive Notes

- The prompt itself is preserved and readable.
- Model/aspect/quality details are visible.
- The project restores cleanly and Reference Grid shows the saved image.
- No credits were spent.

## Evidence

- `docs/agents/testers/maya-chen/reports/assets/2026-07-05-prompt-detail-recovery/01-prompts-filter-empty.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-05-prompt-detail-recovery/02-media-detail-recovered-prompt.png`
- Prompt recovered:

```text
Create a calm, realistic vertical social image for a small apartment wellness creator. The image should feel warm, practical, and useful for a short-form post about a five-minute reset routine for busy renters. Natural light, tidy small kitchen or living space, realistic details, not overly glossy, no text in the image.
```

## Non-Goals

- No new generation.
- No billing or subscription changes.
- No deletion or cleanup.
- No direct database/API inspection during the live customer journey.

## Admin Publish Status

- Status: published
- External run id: `2026-07-05-prompt-detail-recovery`
- Admin tab verification: production `tester_report_runs` row verified after ingest; the Agent Tester Reports page reads this table through `/api/admin/tester-reports`
- Notes: Published through the internal tester-report ingest handler after local report completion.

## Maya Self-Audit Summary

- Persona fidelity: 9
- Human realism: 9
- Question-first behavior: 9
- Natural customer navigation: 8
- Credit discipline: 10
- Evidence quality: 9
- Behavior metrics quality: 9
- Report usefulness: 9
- Admin publish completion: 9
- Stop/resume discipline: 8
- Overall: 8.9
- Coach question answer: I briefly became more operator-like during browser-control recovery, but resumed from a visible app state and re-entered Maya's customer question before continuing.
