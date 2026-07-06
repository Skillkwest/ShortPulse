# Maya Report: I Made A Second Image, But The Prompt Disappeared Again

Date: 2026-07-05
Scenario: Create one second image variant for my Tiny Apartment Reset Kit.
UGC project goal: Tiny Apartment Reset Kit ladder step 5, make one alternate image.
Session duration: about 30 minutes including a browser-control restart.
Credits spent: 4
Run status: completed with one serious trust concern

## My Quick Scores

| Metric                  | Value              | Notes                                                                 |
| ----------------------- | ------------------ | --------------------------------------------------------------------- |
| Navigation confidence   | `4/5`              | I could get back into my project and find both images.                |
| Credit anxiety          | `3/5`              | The cost was clear and correct, but I still watched the balance hard. |
| Spend readiness         | `3/5`              | I would spend again only if I knew my prompts were recoverable.       |
| Save confidence         | `4/5`              | Both images appeared in Media and Reference Grid.                     |
| Prompt recovery success | `no`               | Media Detail showed the Prompt section, but the prompt was blank.     |
| Review risk             | `high if repeated` | Spending credits and losing the prompt feels like a real problem.     |

## What I Tried

I opened a fresh Chrome window, signed in, and went back into my project. The app restored `5-minute renter reset tests`, which was reassuring.

Before I spent anything, I checked the visible state:

- Credits showed `346 / 350`.
- The Generate button showed `4` credits.
- Reference Grid showed `Media: 1/500`.
- My first image was still there.

I opened the old image detail because I wanted to reuse the same general look. This time the Media Detail modal showed the generated image details, but under `PROMPT` it was blank. That made me nervous, because the whole reason I felt safe making a variant was that I thought I could recover the prompt.

I still made one careful variant because the old image was visible, the cost was clear, and this was exactly the small test I wanted to run. My prompt was:

```text
Create a second calm, realistic vertical social image for a small apartment wellness creator. Same warm practical renter-friendly mood as my first image, but show a slightly different five-minute reset scene: a small entryway or compact living room corner with a tote bag, simple shoes, folded throw blanket, water bottle, and natural evening light. It should feel doable for busy renters, tidy but lived-in, not luxury, not overly glossy, no text in the image.
```

The Generate button was enabled and still showed `4`, so I clicked it once.

The credit balance changed from `346 / 350` to `342 / 350`, which matched the cost. Reference Grid changed to `Media: 2/500`, and after a short wait I could see two image thumbnails.

Then I checked Media. It showed `2` saved items and said `Loaded 2 media items (all loaded).` So the second image did save.

I opened the new image detail. The Prompt section was blank again.

## What Felt Clear

- I was in the right project.
- The credit cost was visible before I generated.
- The debit matched the visible cost.
- The second image saved.
- Both images were findable in Media.
- Reference Grid updated to `Media: 2/500`.

## What Felt Unclear

- I could not tell whether the old image was actually used as a reference or was just sitting nearby.
- Media showed `PROJECT: Project name`, which looked unfinished or generic.
- The Prompt section existed in Media Detail, but it did not show the prompt for either image during this run.
- If I liked the second image, I would not know how to repeat it exactly later.

## My Honest Take

ShortPulse did the important generation/save part correctly. I paid 4 credits, got a second image, and could find both images afterward. That part made me trust the app more.

But I am pretty upset about the prompt being blank after I spent credits. I am trying to make a small content package, not one random image. If I cannot recover the prompt, I cannot learn from what worked or make a consistent set.

The harsher review version would be: "ShortPulse will save your images, but it may not show you the prompt you paid to generate with. That makes the tool feel unreliable for building a campaign."

## Evidence

- `docs/agents/testers/maya-chen/reports/assets/2026-07-05-second-image-variant/01-starting-state-cost-context.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-05-second-image-variant/02-media-detail-prompt-empty-before-variant.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-05-second-image-variant/03-before-generation-cost-4.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-05-second-image-variant/06-media-library-both-assets.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-05-second-image-variant/07-new-image-detail.png`

## Admin Publish Status

Published to Agent Tester Reports at `/admin/tester-reports`.

- External run id: `2026-07-05-second-image-variant`
- Status: `completed`
- Publish method: internal tester-report ingest handler
- Verification: production `tester_report_runs` row exists with both report bodies
