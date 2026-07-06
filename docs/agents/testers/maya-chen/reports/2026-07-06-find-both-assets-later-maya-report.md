# Maya Report: I Found Both Images, But I Still Cannot Reuse The Prompts

Date: 2026-07-06
Scenario: Come back later and find both generated assets.
UGC project goal: Tiny Apartment Reset Kit ladder step 5 to 7, verify saved assets before trusting the workflow.
Session duration: about 32 minutes.
Credits spent: 0
Run status: completed with a repeated prompt-recovery issue

## My Quick Scores

| Metric                  | Value         | Notes                                                                   |
| ----------------------- | ------------- | ----------------------------------------------------------------------- |
| Navigation confidence   | `4/5`         | I found the project, Media, and both images.                            |
| Credit anxiety          | `1/5`         | I did not spend credits, and the balance stayed `342 / 350`.            |
| Spend readiness         | `1/5`         | I would not spend again until prompt recovery is fixed or explained.    |
| Save confidence         | `4/5`         | Both images are saved and visible in Media and Reference Grid.          |
| Prompt recovery success | `no`          | Both image details showed a blank Prompt section.                       |
| Review risk             | `high repeat` | The app saves my images, but I still cannot recover the prompt context. |

## What I Tried

I opened ShortPulse again like I was coming back to keep working on my renter reset project. AI Studio restored into `5-minute renter reset tests`.

The first things I saw were reassuring:

- Credits: `342 / 350`
- Project: `5-minute renter reset tests`
- Reference Grid: `Media: 2/500`

Then I opened Media. It showed `2` saved items and said `Loaded 2 media items (all loaded).` I could see both images. They looked like a matching little set: one entryway/corner image and one calmer plant/window image.

That part made me feel better. The images did not disappear.

But when I tried to inspect them, single-clicking selected the card and brought up `Delete from library`. I know that is probably normal, but as a customer it makes me nervous because I am trying to look, not delete.

I double-clicked each image to open Media Detail. Both details showed:

- Generated image
- Image
- 9:16
- 2K
- Seedream 4.5
- PROMPT

But the prompt text was blank for both images.

I also checked the `Prompts` filter because that still seems like the obvious place for prompts. It said `No prompts found for this folder.`

Finally, I opened Projects. It showed `5-minute renter reset tests` as the current project, which helped. It also showed an `Untitled Project`, which made the project area feel a little messy.

## What Felt Clear

- The project came back.
- My credit balance did not change.
- Both generated images are saved.
- Both images are visible in Media.
- Both images are also in Reference Grid.
- The two images are visually different enough that I can tell them apart by looking.

## What Felt Unclear

- There are no visible names, dates, or labels on the image cards.
- Single-clicking an image selects it instead of opening details.
- The selected state puts Delete very close to normal inspection.
- The Media project label area still says `PROJECT:` and `Project name`, which feels unfinished.
- The Prompt section is blank in detail for both generated images.
- The Prompts filter says there are no prompts.

## My Honest Take

This run is half reassuring and half frustrating.

The good part is important: ShortPulse did not lose my images. I can come back later, open the project, and see both assets. That is enough for me to believe the save system is basically working.

But I still would not trust this for a real weekly content workflow because I cannot recover the prompts. The images are not enough by themselves. I need the prompt context so I can make a third image, repeat the look, or learn what worked.

The harsher review version would be: "ShortPulse saves the pictures, but not the workflow. If the prompt disappears, I am stuck with pretty images I cannot reliably build from."

## Evidence

- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-find-both-assets-later/01-restored-project-two-assets.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-find-both-assets-later/02-media-library-two-assets.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-find-both-assets-later/03-first-image-detail-prompt-blank.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-find-both-assets-later/04-second-image-detail-prompt-blank.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-find-both-assets-later/05-prompts-filter-empty.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-06-find-both-assets-later/06-projects-list-visible.png`

## Admin Publish Status

Published to Agent Tester Reports at `/admin/tester-reports`.

- External run id: `2026-07-06-find-both-assets-later`
- Status: `completed`
- Publish method: internal tester-report ingest handler
- Verification: production `tester_report_runs` row exists with both report bodies
