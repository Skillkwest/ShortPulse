# Engineering Handoff: Second Image Variant

Date: 2026-07-05
Tester: Maya Chen
Scenario: Create one second image variant after confirming cost/context.
UGC project goal: Tiny Apartment Reset Kit ladder step 5, one alternate image.
Production surface: `https://www.shortpulse.ai`, `/ai-studio`
Session duration: about 30 minutes including a browser-control restart.
Credits spent: 4
Run status: completed with prompt-recovery issue

## Summary

Maya successfully generated one second image variant in production. The visible cost was `4` credits before generation, the account balance moved from `346 / 350` to `342 / 350`, and the asset count moved from `Media: 1/500` to `Media: 2/500`. Media Library then showed `2` saved items.

The main issue is that Media Detail showed a `PROMPT` section but no prompt body for both the older image and the new paid image during this run. This is more severe than the previous prompt-detail recovery result because Maya had just spent credits and could not visibly recover the prompt for reuse.

## Human Behavior Metrics

| Metric                           | Value                                                                         | Notes                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Time to restored project context | `~1 min after login/restore`                                                  | Project title, credits, Generate cost, and Reference Grid were visible.                            |
| Time to spend decision           | `~10 min`                                                                     | Maya checked project, prior image, old detail, visible cost, and credit balance before generating. |
| Clarifying question count        | `5`                                                                           | Project, old image, visible cost, findability, and future prompt recovery.                         |
| Backtrack/recovery count         | `2`                                                                           | Browser-control restart and Media Detail prompt check before generation.                           |
| Credit anxiety                   | `3/5`                                                                         | Cost matched debit, but prompt recovery uncertainty remained.                                      |
| Spend readiness                  | `3/5`                                                                         | Maya would not confidently continue spending until prompt recovery is fixed or explained.          |
| Save confidence                  | `4/5`                                                                         | Both assets are visible in Media and Reference Grid.                                               |
| Prompt recovery confidence       | `2/5`                                                                         | Prompt section existed but was blank for old and new generated images.                             |
| Human error/backtrack notes      | `used a hand-written variant prompt; uncertain whether reference was applied` | Plausible creator behavior with incomplete mental model.                                           |
| Review risk                      | `high if repeated`                                                            | Paid outputs without recoverable prompts undermine campaign/workflow trust.                        |

## Reproduction Steps

1. Open a fresh real Google Chrome window.
2. Navigate to `https://www.shortpulse.ai/ai-studio?projectId=0cc5e653-de94-42ad-b42b-d984ffc27d4e`.
3. Sign in as Maya if prompted.
4. Wait for AI Studio restore to finish.
5. Confirm starting state:
   - Project: `5-minute renter reset tests`
   - Credits: `346 / 350`
   - Generate button displays `4`
   - Reference Grid: `Media: 1/500`
6. Double-click the existing image/reference.
7. Observe `MEDIA DETAIL` with model/aspect/resolution details and `PROMPT` label.
8. Observe no visible prompt body under `PROMPT`.
9. Close or leave detail and enter a second image prompt in Create.
10. Confirm Generate is enabled and still displays `4`.
11. Click Generate once.
12. Observe credits change to `342 / 350`.
13. Observe Reference Grid change to `Media: 2/500`.
14. Wait for `Generating` to clear.
15. Open `Media`.
16. Observe `2` saved items and `Loaded 2 media items (all loaded).`
17. Double-click the new image.
18. Observe `MEDIA DETAIL` with `PROMPT` label but no visible prompt body.

## Expected Behavior

For a generated image, Media Detail should reliably expose the prompt used to create that output, especially after a paid generation. If prompt text is unavailable, the UI should explain why instead of showing an empty `PROMPT` section.

## Actual Behavior

The Prompt section was present but blank for both the previously generated image and the newly generated variant. The generation itself saved successfully and credit accounting matched the visible cost.

## Findings

### Finding 1: Media Detail prompt body is blank for generated images during this run

Severity: high workflow trust risk

Customer risk:

- Maya cannot reuse or iterate from a paid result.
- The product appears to have saved the media but lost or hidden the prompt.
- This directly affects content-package creation, where consistency across variants matters.

Suggested investigation:

- Inspect the Media Detail data path for generated image prompt text.
- Compare the source used by the modal to whatever persistence path records `media_prompts.prompt_text` or generation metadata.
- Check whether prompt fetch depends on route, cache hydration, selected collection, project workspace snapshot, or signed media object state.
- Confirm whether prior prompt visibility from the previous run was a transient state, stale cache, or inconsistent restore behavior.

### Finding 2: Variant generation and save path worked

Severity: positive proof

Observed behavior:

- Generate showed `4` credits before click.
- Balance changed exactly from `346 / 350` to `342 / 350`.
- Reference Grid changed to `Media: 2/500`.
- Media Library showed `2` saved items.

Suggested preservation:

- Do not change credit debit timing, Media save behavior, or Reference Grid global count while fixing prompt detail.

### Finding 3: Customer cannot tell whether Reference Grid media influenced generation

Severity: medium workflow confusion

Customer risk:

- Maya sees old media nearby and assumes it may guide the new image.
- The UI does not make the relationship clear enough for a cautious low-budget creator.

Suggested investigation:

- Verify intended Reference Grid semantics for image generation.
- If references are only available for some models/modes, make that explicit at generation time.
- If they are active, expose a clear applied-reference indication before spend.

### Finding 4: Media panel shows generic project label copy

Severity: low polish/trust

Observed copy:

- `PROJECT:`
- `Project name`

Customer risk:

- It looks unfinished and makes Maya briefly question whether she is filtering the correct project.

Suggested investigation:

- Inspect the Media panel project label/hydration path.
- Either show the active project name or remove the generic label if it is not actionable.

## Evidence

- `docs/agents/testers/maya-chen/reports/assets/2026-07-05-second-image-variant/01-starting-state-cost-context.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-05-second-image-variant/02-media-detail-prompt-empty-before-variant.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-05-second-image-variant/03-before-generation-cost-4.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-05-second-image-variant/06-media-library-both-assets.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-05-second-image-variant/07-new-image-detail.png`

## Non-Goals

- No second generation attempt.
- No deletion or cleanup.
- No billing/subscription changes.
- No direct database/API inspection during the live customer journey.
- No UI redesign request beyond fixing or explaining the prompt-detail source path.

## Admin Publish Status

- Status: pending at local report creation time
- External run id: `2026-07-05-second-image-variant`
- Required publish target: Agent Tester Reports at `/admin/tester-reports`

## Maya Self-Audit Summary

- Persona fidelity: 8
- Human realism: 8
- Question-first behavior: 8
- Natural customer navigation: 8
- Credit discipline: 10
- Evidence quality: 8
- Behavior metrics quality: 8
- Report usefulness: 9
- Admin publish completion: pending
- Workspace memory hygiene: 9
- Stop/resume discipline: 8
- Overall before Admin publish: 8.4 excluding pending Admin publish
- Coach question answer: I became more tester-like when the clipboard/browser-control attempt stalled and when I captured proof screenshots, but the actual spending decision stayed Maya-like: cautious, budget-aware, and focused on whether I could reuse the result.
