# Maya Chen Test Reports

This folder stores Maya Chen's durable browser-testing reports.

Each completed run should produce two files:

- A Maya-voice report for the user.
- An engineering handoff for another agent to investigate code, architecture, and implementation details.

Each completed run should also be published to the product Admin Tester Reports tab (`/admin/tester-reports`) through `POST /api/internal/tester-reports/ingest` when `SHORTPULSE_TESTER_REPORT_INGEST_SECRET` is available. Local Markdown files remain durable artifact paths and fallback evidence.

## Report Naming

- `YYYY-MM-DD-short-slug-maya-report.md`
- `YYYY-MM-DD-short-slug-engineering-handoff.md`

## Report Index

| Date       | Scenario                                               | Maya report                                                                    | Engineering handoff                                                                            | Admin publish                                                                                | Duration                    | Credits spent | Outcome                                                                                                                                                          |
| ---------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-03 | Authenticated orientation before spending credits      | [Maya report](2026-07-03-authenticated-orientation-maya-report.md)             | [Engineering handoff](2026-07-03-authenticated-orientation-engineering-handoff.md)             | Not published; run predates Maya Admin publish requirement                                   | ~35 min                     | 0             | Dashboard and AI Studio were explorable, but prompt draft loss and unclear save-to-Media behavior kept Maya from spending credits.                               |
| 2026-07-04 | Fresh signup, Starter purchase, first image generation | [Maya report](2026-07-04-fresh-signup-payment-image-generation-maya-report.md) | [Engineering handoff](2026-07-04-fresh-signup-payment-image-generation-engineering-handoff.md) | Not published; run predates Maya Admin publish requirement                                   | ~45 min plus payment pauses | 4             | Signup, payment, generation, Media save, project persistence, and download worked; post-generation success state in Create was unclear after credits were spent. |
| 2026-07-05 | Find generated image and reuse context                 | [Maya report](2026-07-05-find-generated-image-context-maya-report.md)          | [Engineering handoff](2026-07-05-find-generated-image-context-engineering-handoff.md)          | Published to Agent Tester Reports; external run id `2026-07-05-find-generated-image-context` | ~35 min                     | 0             | Image and project were recoverable and reusable as a reference, but the original prompt was not visible and Prompts showed none.                                 |
| 2026-07-05 | Prompt and detail recovery                             | [Maya report](2026-07-05-prompt-detail-recovery-maya-report.md)                | [Engineering handoff](2026-07-05-prompt-detail-recovery-engineering-handoff.md)                | Published to Agent Tester Reports; external run id `2026-07-05-prompt-detail-recovery`       | ~33 min                     | 0             | Prompt/model/details were recoverable through Media Detail, but the entry point depends on double-clicking and Prompts still says none.                          |
| 2026-07-05 | Second image variant                                   | [Maya report](2026-07-05-second-image-variant-maya-report.md)                  | [Engineering handoff](2026-07-05-second-image-variant-engineering-handoff.md)                  | Pending; external run id `2026-07-05-second-image-variant`                                   | ~30 min                     | 4             | A second image saved and the credit debit matched the visible cost, but Media Detail prompt text was blank for both old and new generated images.                |
| 2026-07-05 | Second image variant                                   | [Maya report](2026-07-05-second-image-variant-maya-report.md)                  | [Engineering handoff](2026-07-05-second-image-variant-engineering-handoff.md)                  | Pending publish at report creation; external run id `2026-07-05-second-image-variant`        | ~30 min                     | 4             | One 4-credit variant generated and saved; both assets were findable, but Media Detail prompt text was blank for old and new generated images.                    |
