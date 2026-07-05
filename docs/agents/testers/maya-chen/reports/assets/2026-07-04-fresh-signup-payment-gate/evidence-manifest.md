# Evidence Manifest: 2026-07-04 Fresh Signup Payment Image Generation

Run: Fresh signup, Starter purchase, first image generation
Date: 2026-07-04
Scenario: Maya created a fresh account, purchased Starter, generated one image, checked saved media, and downloaded the result.
Asset folder: `docs/testers/maya-chen/reports/assets/2026-07-04-fresh-signup-payment-gate/`

Only evidence-bearing screenshots/files are retained. Routine signup/navigation screenshots and account-identifying screenshots were removed.

| Artifact                               | Moment Captured                                                         | Maya Meaning                                                                   | Used In             |
| -------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------- |
| `07-view-plans-pricing.png`            | Pricing opened from AI Studio with annual billing visible.              | Shows the annual-default friction Maya noticed before selecting Starter.       | Engineering handoff |
| `08-pricing-monthly.png`               | Monthly pricing after Maya switched billing cadence.                    | Shows that monthly was available but required a deliberate switch.             | Engineering handoff |
| `10-post-payment-return.png`           | Return to AI Studio after payment with `350 / 350` credits.             | Proves payment/entitlement return and starting credit balance.                 | Engineering handoff |
| `16-prompt-ready-before-generate.png`  | Prompt, Seedream 4.5, 9:16, 2K, and Generate cost visible.              | Proves pre-spend state and visible 4-credit cost.                              | Both                |
| `17-after-generate-click.png`          | Generate clicked and credits debited.                                   | Proves credit spend occurred.                                                  | Both                |
| `19-current-after-generation-wait.png` | Create surface after waiting, with no obvious result visible.           | Supports the main trust gap: no clear post-generation success state in Create. | Both                |
| `20-media-after-generation.png`        | Media library showing the generated image.                              | Proves output existed and was saved/findable through Media.                    | Both                |
| `21-selected-generated-media.png`      | Generated media selected with prompt preview still empty.               | Supports prompt/detail recovery finding.                                       | Engineering handoff |
| `22-after-download-click.png`          | Download action after selecting generated media.                        | Supports download-path verification and prompt-detail finding.                 | Engineering handoff |
| `23-projects-after-test-project.png`   | Projects modal showing the named project and an extra Untitled Project. | Supports project persistence and extra-project ambiguity finding.              | Both                |
| `downloaded-generated-image.png`       | The generated image downloaded from ShortPulse.                         | Proves the asset could be exported for Maya's creator workflow.                | Both                |

## Removed Screenshots

The run originally captured additional routine signup/navigation/progress screenshots. They were removed because they did not support a product issue or contained account-identifying information.
