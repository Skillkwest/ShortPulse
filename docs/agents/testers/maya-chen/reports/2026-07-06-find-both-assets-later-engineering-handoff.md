# Engineering Handoff: Find Both Assets Later

Date: 2026-07-06
Tester: Maya Chen
Scenario: Return later and verify both generated images are findable, distinguishable, and reusable.
UGC project goal: Tiny Apartment Reset Kit ladder step 5 to 7, saved-work trust check.
Production surface: `https://www.shortpulse.ai`, `/ai-studio`
Session duration: about 32 minutes.
Credits spent: 0
Run status: completed with repeated prompt-recovery issue

## Summary

Maya successfully returned to the existing AI Studio project and found both generated images. The visible credit balance stayed `342 / 350`, Reference Grid showed `Media: 2/500`, Media showed `2` saved items, and Projects showed `5-minute renter reset tests` as the current project.

The repeated issue is prompt reuse: both generated image detail modals showed a `PROMPT` header but no prompt body, and the Media `Prompts` filter showed `No prompts found for this folder.` This confirms the previous run's prompt-recovery issue persists across a return session and is not only a same-session generation state problem from Maya's perspective.

## Human Behavior Metrics

| Metric                             | Value                | Notes                                                                                 |
| ---------------------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| Time to restored project context   | `<1 min after login` | AI Studio restored into the project with credits and Reference Grid count visible.    |
| Time to find both image assets     | `~3 min`             | Media showed two large image cards and Reference Grid showed two thumbnails.          |
| Time to prompt-recovery conclusion | `~12 min`            | Maya checked both image detail modals and the Prompts filter.                         |
| Clarifying question count          | `5`                  | Asset location, project survival, image identity, prompt recovery, and credit safety. |
| Backtrack/recovery count           | `1`                  | Single-click selection before double-clicking detail.                                 |
| Credit anxiety                     | `1/5`                | No spend; visible balance stayed `342 / 350`.                                         |
| Save confidence                    | `4/5`                | Both assets are findable in Media and Reference Grid.                                 |
| Prompt recovery confidence         | `1/5`                | Prompt detail blank for both images and Prompts filter empty.                         |
| Reuse confidence                   | `2/5`                | Visual reuse is possible, but prompt/context reuse is not.                            |
| Review risk                        | `high repeat`        | Repeated prompt loss/hiding after paid outputs undermines workflow trust.             |

## Reproduction Steps

1. Open a fresh real Google Chrome window.
2. Navigate to `https://www.shortpulse.ai/ai-studio?projectId=0cc5e653-de94-42ad-b42b-d984ffc27d4e`.
3. Sign in as Maya if prompted.
4. Wait for AI Studio restore.
5. Confirm visible state:
   - Project: `5-minute renter reset tests`
   - Credits: `342 / 350`
   - Reference Grid: `Media: 2/500`
6. Open `Media`.
7. Observe `2` saved items and `Loaded 2 media items (all loaded).`
8. Observe two saved image cards in Media and two thumbnails in Reference Grid.
9. Single-click the first image.
10. Observe selected state with `Clear` and `Delete from library`; detail does not open.
11. Double-click the first image.
12. Observe Media Detail with generated-image metadata and a blank `PROMPT` section.
13. Close detail.
14. Double-click the second image.
15. Observe Media Detail with generated-image metadata and a blank `PROMPT` section.
16. Click the `Prompts` filter in Media.
17. Observe `No prompts found for this folder.`
18. Open `Projects`.
19. Observe `5-minute renter reset tests` marked `CURRENT`, plus an `Untitled Project`.

## Expected Behavior

Maya expected to find both generated assets and recover enough context to reuse them later. At minimum, generated image detail should either show the prompt used for that asset or explain why the prompt is unavailable. The Prompts filter should either surface generated prompts or clearly explain that generated-image prompts live inside image detail.

## Actual Behavior

Both generated images were findable and visible in Media and Reference Grid. Project recovery also worked. Prompt recovery did not: both detail modals showed a blank Prompt section, and the Prompts filter showed no prompts.

## Findings

### Finding 1: Saved image recovery works across return session

Severity: positive proof

Observed behavior:

- AI Studio restored the project.
- Credits stayed at `342 / 350`.
- Reference Grid showed `Media: 2/500`.
- Media showed `2` saved items and two visible image cards.
- Projects showed the renter-reset project as current.

Preserve:

- Do not regress project restore, Media Library item count, Reference Grid saved media count, or no-spend inspection behavior while fixing prompt detail.

### Finding 2: Prompt recovery remains blank for both generated images

Severity: high workflow trust risk

Customer risk:

- Maya cannot reuse paid generation prompts later.
- The issue persists after returning in a new Chrome session.
- This blocks campaign iteration even though media persistence works.

Suggested investigation:

- Inspect the generated media detail prompt data source used by the modal.
- Compare detail modal prompt hydration against the generation persistence path for both first and second generated images.
- Confirm whether the prompt is stored in `media_prompts`, generation metadata, project output display items, or another source.
- Check whether current uncommitted frontend changes around `DetailModal`, `SharedMediaDetailPreviewModal`, and related session snapshot/detail-modal files are intended to address this issue and whether production has them deployed.

### Finding 3: Media card single-click still selects instead of opening details

Severity: workflow confusion / destructive-action anxiety

Customer risk:

- Maya expects inspection and instead gets a selected state.
- `Delete from library` appears while she is trying to inspect, which makes the saved-work surface feel risky.

Suggested investigation:

- Keep selection behavior if needed, but expose a clear visible `Open`, `Details`, or `View prompt` affordance on media cards.
- Consider reducing destructive-action salience during ordinary inspection.

### Finding 4: Image distinguishability depends on visual memory, not metadata

Severity: medium organization friction

Customer risk:

- Maya can visually tell the two images apart today, but there are no visible names, dates, prompt snippets, or generation labels on the cards.
- As the library grows, this will become harder.

Suggested investigation:

- Expose stable, customer-friendly media card metadata such as title, created date, source prompt snippet, or project association.
- Preserve compact scanning; do not add heavy card chrome if the existing visual gallery is intentional.

### Finding 5: Media project label still looks generic

Severity: low polish/trust

Observed copy:

- `PROJECT:`
- `Project name`

Customer risk:

- The center header correctly shows `5-minute renter reset tests`, but the generic Media project label still makes the filter/context feel unfinished.

Suggested investigation:

- Show the active project name in the Media panel label or remove the generic label.

## Evidence

- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-find-both-assets-later/01-restored-project-two-assets.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-find-both-assets-later/02-media-library-two-assets.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-find-both-assets-later/03-first-image-detail-prompt-blank.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-find-both-assets-later/04-second-image-detail-prompt-blank.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-find-both-assets-later/05-prompts-filter-empty.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-find-both-assets-later/06-projects-list-visible.png`

## Non-Goals

- No generation.
- No credit spend.
- No deletion or cleanup.
- No account, billing, or subscription changes.
- No direct database/API inspection during the live customer journey.

## Admin Publish Status

- Status: published
- External run id: `2026-07-06-find-both-assets-later`
- Admin tab verification: production `tester_report_runs` row verified after ingest; row has status `completed`, `credits_spent` 0, both report bodies, artifact paths, and evidence payload
- Notes: Published through the internal tester-report ingest handler after local report completion.

## Baseline Comparison

Run: Find Both Assets Later
Date: 2026-07-06
Compared against: `baseline-kpi-2026-07-05.md`

Overall score: `9.0`
Delta from baseline: `+0.6`

Categories improved:

- Credit discipline remained strong.
- Saved-work observation was more customer-like and less generation-focused.

Categories degraded:

- Evidence count stayed slightly high because the repeated prompt issue needed proof.

Non-negotiable fail conditions triggered:

- None.

What changed in Maya's behavior:

- Maya stayed focused on a no-spend return workflow and did not drift into creation or code diagnosis.

Correction to carry into next run:

- If prompt recovery remains the main issue, future Maya runs should stop after proving the customer-visible state and avoid repeating the same screenshots unless the product behavior changes.

## Maya Self-Audit Summary

- Persona fidelity: 9
- Human realism: 9
- Question-first behavior: 9
- Natural customer navigation: 9
- Credit discipline: 10
- Evidence quality: 8
- Behavior metrics quality: 9
- Report usefulness: 9
- Admin publish completion: 9
- Workspace memory hygiene: 9
- Stop/resume discipline: 9
- Overall: 9.0
- Coach question answer: I became slightly tester-like in the amount of screenshot proof I kept, but the browser path stayed customer-like: return, check Media, inspect details, check Prompts, confirm Projects, and stop without drifting into generation.
