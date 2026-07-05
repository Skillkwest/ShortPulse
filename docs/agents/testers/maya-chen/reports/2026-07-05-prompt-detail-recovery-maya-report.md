# Maya Report: I Found The Prompt, But Only After Guessing The Right Click

Date: 2026-07-05
Scenario: Recover the prompt and details for the first image I paid credits to make.
UGC project goal: Tiny Apartment Reset Kit ladder step 4, recover context.
Session duration: about 33 minutes including one browser-control recovery.
Credits spent: 0
Run status: completed

## My Quick Scores

| Metric                  | Value                     | Notes                                                                                  |
| ----------------------- | ------------------------- | -------------------------------------------------------------------------------------- |
| Navigation confidence   | `4/5`                     | I can recover the project, image, prompt, and model details now.                       |
| Credit anxiety          | `1/5`                     | I did not generate anything, and the balance stayed `346 / 350`.                       |
| Spend readiness         | `4/5`                     | I would feel okay making one low-cost variant next, because I have the old prompt now. |
| Save confidence         | `4/5`                     | The image and project are still findable.                                              |
| Prompt recovery success | `yes, but hidden-feeling` | The prompt is in Media Detail, but I had to double-click the image to get there.       |
| Review risk             | `mild`                    | This is more discoverability friction than broken saved work.                          |

## What I Tried

I launched the app from the homepage. It sent me to sign-up first, so I switched to Sign in and logged in. AI Studio opened with `346 / 350` credits.

I opened Media first because I was looking for an image. The saved image was there, which made me feel relieved. When I clicked it once, it only selected the item and showed `Clear` plus `Delete from library`. That made me cautious because I wanted details, not bulk actions or deletion.

I tried expanding the Media panel, then I double-clicked the image. That opened `MEDIA DETAIL`. Inside the detail modal I could finally see:

- Generated image
- Image
- 9:16
- 2K
- Seedream 4.5
- the full prompt

The prompt was:

```text
Create a calm, realistic vertical social image for a small apartment wellness creator. The image should feel warm, practical, and useful for a short-form post about a five-minute reset routine for busy renters. Natural light, tidy small kitchen or living space, realistic details, not overly glossy, no text in the image.
```

I also opened the `5-minute renter reset tests` project. The project name came back at the top, and Reference Grid showed `Media: 1/500`. Double-clicking the project reference image also opened the same detail modal.

Then I checked the Media `Prompts` filter, because that still felt like the obvious place to find prompts. It said `No prompts found for this folder.`

## What Felt Clear

- The old image is still saved.
- The project can be reopened.
- The image is attached to the project Reference Grid.
- The Media Detail modal includes the original prompt and useful generation details.
- The `Copy prompt` button exists.

## What Felt Unclear

- Single-clicking the image selects it instead of opening details.
- The visible bulk actions include Delete, which made me nervous.
- I only found details after double-clicking, which I would not assume every creator knows to try.
- The `Prompts` filter says no prompts, even though the image detail has a prompt.
- I clicked `Copy prompt`, but I did not notice a clear confirmation.

## My Honest Take

This is much better than I thought after the last run. ShortPulse did save the prompt and model details. I would now feel comfortable making one careful variant.

But I still think the path is too hidden. As a normal creator, I would expect a clear `Details`, `View prompt`, or `Open` action on the media card. I should not have to double-click a thumbnail and hope that does something.

The harsher review version would be: "The prompt is saved, but ShortPulse makes you guess how to open it. If I had only checked Prompts, I would think my prompt was gone."

## Evidence

- `docs/agents/testers/maya-chen/reports/assets/2026-07-05-prompt-detail-recovery/01-prompts-filter-empty.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-05-prompt-detail-recovery/02-media-detail-recovered-prompt.png`

## Admin Publish Status

Published to Agent Tester Reports at `/admin/tester-reports`.

- External run id: `2026-07-05-prompt-detail-recovery`
- Status: `completed`
- Publish method: internal tester-report ingest handler
- Verification: production `tester_report_runs` row exists with both report bodies
