# Engineering Handoff: Maya Chen Fresh Signup, Payment, First Image

Date: 2026-07-04
Tester persona: Maya Chen
Surface: Production Chrome session, `https://www.shortpulse.ai`
Scope: Browser-only customer simulation. No database reads, API shortcuts, service-role access, or code-level state inspection were used to determine user-visible outcomes.

## Scenario Summary

Maya completed a fresh customer path:

1. Public home to email/password signup.
2. Email confirmation gate.
3. AI Studio entry with no credits.
4. Pricing page from `View plans`.
5. Monthly Starter purchase through Stripe, completed by the user.
6. Return to AI Studio with `350 / 350` credits.
7. Project renamed to `5-minute renter reset tests`.
8. One image generation with Seedream 4.5, 9:16, 2K.
9. Media library confirmation, Reference Grid confirmation, download, and Projects persistence check.

Credits observed:

- Before generation: `350 / 350`.
- Generate button cost: `Generate 4`.
- After generation: `346 / 350`.
- Maya monthly test budget impact: 4 credits spent, 96 remaining for July 2026.

## Evidence

- Evidence manifest: `docs/agents/testers/maya-chen/reports/assets/2026-07-04-fresh-signup-payment-gate/evidence-manifest.md`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-04-fresh-signup-payment-gate/07-view-plans-pricing.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-04-fresh-signup-payment-gate/08-pricing-monthly.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-04-fresh-signup-payment-gate/10-post-payment-return.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-04-fresh-signup-payment-gate/16-prompt-ready-before-generate.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-04-fresh-signup-payment-gate/17-after-generate-click.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-04-fresh-signup-payment-gate/19-current-after-generation-wait.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-04-fresh-signup-payment-gate/20-media-after-generation.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-04-fresh-signup-payment-gate/21-selected-generated-media.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-04-fresh-signup-payment-gate/22-after-download-click.png`
- `docs/agents/testers/maya-chen/reports/assets/2026-07-04-fresh-signup-payment-gate/23-projects-after-test-project.png`
- Downloaded image artifact: `docs/agents/testers/maya-chen/reports/assets/2026-07-04-fresh-signup-payment-gate/downloaded-generated-image.png`

## Working Behaviors

- Email/password signup surfaced a clear confirmation-required state.
- AI Studio no-credit state exposed `View plans`.
- Pricing page allowed monthly billing selection.
- Starter checkout opened and returned to AI Studio after payment.
- AI Studio reflected the purchased credit balance.
- Project rename persisted in the header and Projects modal.
- Generate button exposed the 4-credit cost before spend.
- Credit balance reflected a 4-credit debit after generation.
- Generated image appeared in Media Library.
- Generated image appeared in Reference Grid.
- Download from Media worked; browser emitted a downloadable PNG.

## Findings

### P1: Post-generation success state is not obvious in Create after credits are spent

Maya clicked Generate, credits debited from `350 / 350` to `346 / 350`, then the Create surface returned to the prompt state with no obvious visible success/result/status in the main Create area.

Observed user impact:

- Maya had to infer that she should check Media.
- This is high-trust-risk because the uncertainty happens after credit spend.
- The generation did succeed, but the success state was discoverable only by hunting.

Suggested product direction:

- After successful generation, show an obvious result card, toast, or status message in Create.
- Include plain copy such as "Saved to Media" or "Added to Reference Grid."
- Preserve a path from the success state to Media and Download.

Evidence:

- `17-after-generate-click.png`: credits debited.
- `19-current-after-generation-wait.png`: Create visible with no obvious result.
- `20-media-after-generation.png`: generated output exists in Media.

### P2: Selected generated media does not expose the original prompt in the visible prompt preview

After Maya selected the generated media item, the visible prompt panel still read `Prompt preview will appear here.`

Observed user impact:

- Maya cannot easily learn which wording produced the useful result.
- This reduces confidence before re-rolling or creating variants.
- It also weakens the generated asset as a reusable content record.

Suggested product direction:

- When selecting generated media, populate prompt preview/details with the generation prompt when available.
- If prompt data is unavailable, avoid placeholder text that implies the app failed to load expected details.

Evidence:

- `21-selected-generated-media.png`
- `22-after-download-click.png`

### P2: Pricing defaults to annual for a first paid user coming from AI Studio

The pricing page initially presented annual billing. Maya switched to monthly before selecting Starter.

Observed user impact:

- Maya is cost cautious and almost abandoned annual by instinct.
- Annual default creates friction for first-run conversion even when monthly is available.

Suggested product direction:

- Consider preserving a monthly default for first-time users entering from a no-credit AI Studio state, or make the billing toggle more prominent before plan selection.

Evidence:

- `07-view-plans-pricing.png`
- `08-pricing-monthly.png`

### P3: Projects modal showed an additional Untitled Project after the run

The Projects modal showed the named current project plus `Untitled Project`.

Observed user impact:

- Maya wondered if she accidentally created clutter while exploring.
- This was not blocking because the named project was marked current.

Suggested product direction:

- Investigate whether signup/payment/AI Studio entry creates an extra untitled project, or whether this was residual account state from setup.
- If unavoidable, give new users a clearer current-project affordance and cleanup path.

Evidence:

- `23-projects-after-test-project.png`

## Customer Value Notes

The generated image was usable for Maya's intended content concept: calm, vertical, renter-friendly, no visible text, and practical enough for a short-form wellness post.

The download path worked. This matters because Maya's real workflow depends on exporting assets to use elsewhere.

## Suggested Next Engineering Pass

Start with the post-generation UI state. The core generation succeeded, so the highest ROI work is likely around visible completion, output placement, and details hydration rather than provider/runtime reliability.

Suggested inspection areas:

- AI Studio generation completion state and output card/render path.
- Media Library generated asset detail selection.
- Prompt metadata persistence and display for generated images.
- Project creation behavior around signup/payment return.
