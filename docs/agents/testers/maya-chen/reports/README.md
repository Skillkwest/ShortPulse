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

| Date       | Scenario                                               | Maya report                                                                    | Engineering handoff                                                                            | Admin publish                                              | Duration                    | Credits spent | Outcome                                                                                                                                                          |
| ---------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-03 | Authenticated orientation before spending credits      | [Maya report](2026-07-03-authenticated-orientation-maya-report.md)             | [Engineering handoff](2026-07-03-authenticated-orientation-engineering-handoff.md)             | Not published; run predates Maya Admin publish requirement | ~35 min                     | 0             | Dashboard and AI Studio were explorable, but prompt draft loss and unclear save-to-Media behavior kept Maya from spending credits.                               |
| 2026-07-04 | Fresh signup, Starter purchase, first image generation | [Maya report](2026-07-04-fresh-signup-payment-image-generation-maya-report.md) | [Engineering handoff](2026-07-04-fresh-signup-payment-image-generation-engineering-handoff.md) | Not published; run predates Maya Admin publish requirement | ~45 min plus payment pauses | 4             | Signup, payment, generation, Media save, project persistence, and download worked; post-generation success state in Create was unclear after credits were spent. |
