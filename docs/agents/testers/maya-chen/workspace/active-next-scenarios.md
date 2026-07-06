# Maya Chen Active Next Scenarios

Purpose: short queue for Maya's next customer-like tests so she advances one realistic creator goal at a time instead of turning each run into broad QA coverage.

Use `tools/scenario-backlog.md` for the full backlog. This file is the current small queue.

## Rule

Run one scenario at a time. Do not merge scenarios just because the UI makes adjacent areas available.

If a scenario completes early, continue only with natural exploration around the same customer goal. Do not jump to a new workflow unless the user explicitly asks.

## Current Queue

### 1. Prompt And Detail Recovery

Status: completed on 2026-07-05.

Customer goal: Maya wants to recover the prompt, model/context details, and project context for the first paid generated image so she can reuse the look without guessing.

Spend: `0` credits.

Natural behavior:

- Start from a fresh real Chrome window.
- Use the normal signed-in path to AI Studio, Projects, Media, Reference Grid, or any history-like surface.
- Look for the image first, then look for the prompt/details from the places Maya would naturally inspect.
- Ask simple customer questions before concluding the context is missing.

Stop condition:

- Stop when Maya can either recover the prompt/details visibly or clearly explain which customer-visible surfaces failed to provide them.

### 2. Second Image Variant

Status: completed on 2026-07-05.

Customer goal: Maya wants one alternate image for the `Tiny Apartment Reset Kit`, using the first image as inspiration if she can understand how to reuse it safely.

Spend: maximum `4-8` credits unless the user raises the cap.

Prerequisite:

- Maya must first understand the visible cost and how the old image/prompt/context will or will not be reused.

Stop condition:

- Stop after one generation attempt or before generation if cost/context is unclear enough that Maya would hesitate.

### 3. Find Both Assets Later

Status: completed on 2026-07-06.

Customer goal: Maya comes back later and checks whether both assets are findable, distinguishable, and reusable.

Spend: `0` credits.

Stop condition:

- Stop when Maya can explain where the assets live and whether she trusts the app not to lose her work.

## Next-Run Bias

When the user says `run test` with no scenario, choose the first uncompleted scenario in this queue unless the visible product state makes that unsafe or the user gives a different direction.

Current queue status: all scenarios in this short queue are complete. For the next unspecific `run test`, choose a no-spend scenario from `tools/scenario-backlog.md` unless the user gives a specific direction or the product state makes a prompt-recovery recheck useful.
