# SOP: Admin Issue Reports Operations

## Scope

Operate the signed-in user issue-report lane built around `/report-issue`, `/admin/reports`, the `user_issue_reports` table, and attached screenshot evidence in `user_issue_report_screenshots`.

## Prerequisites

- Admin access to ShortPulse.
- A valid authenticated session in the app.
- Canonical persistence available in Supabase.

## Intake Contract

- Signed-in users submit through `/report-issue`.
- Optional screenshots are uploaded first through `/api/report-issue/screenshots/prepare`, which returns signed upload targets for the private `issue_report_screenshots` bucket.
- Preparing a screenshot upload also performs best-effort cleanup of old, unreferenced prepared screenshot objects in that user's private screenshot folder.
- The server writes reports through `POST /api/report-issue` after verifying any uploaded screenshot objects.
- Canonical report storage is `public.user_issue_reports`; canonical screenshot metadata storage is `public.user_issue_report_screenshots`.
- Reports are not user-visible after submission in this phase.

## Admin Review Workflow

1. Open `/admin/reports`.
2. Review newest reports first.
3. Filter by status or search by email, user id, message text, or source path when needed.
4. Open a report to inspect:
   - full user message
   - submitter email snapshot
   - user id when still present
   - source path
   - user agent
   - attached screenshots
   - prior admin notes
5. Move the report through the manual lifecycle:
   - `new`: untouched
   - `reviewing`: acknowledged and being worked
   - `resolved`: reviewed and handled; cleared from the default open queue but still preserved in History
6. Capture findings or next actions in `admin_notes`.
7. Use direct links to user diagnostics when needed:
   - `/admin/user-health?lookup=<userId>&lookupMode=user_id`
   - `/admin/generation-trace?userId=<userId>`

## Operating Rules

- Treat Supabase as the only source of truth for reports.
- Treat signed screenshot URLs in the admin UI as temporary display links only; do not copy them into durable notes or external docs.
- Do not use Ophestivus as the live intake or review authority in this phase.
- Do not hard-delete reports during normal review work. Use `resolved` to clear rows from the open queue while preserving them for history/search.
- Preserve concise, useful admin notes for future operator context.

## Error Handling

- If `/report-issue` submissions fail, inspect `POST /api/report-issue`, `/api/report-issue/screenshots/prepare`, storage object verification, and server incident logs first.
- If stale prepared screenshot cleanup logs failures, verify the `issue_report_screenshots` bucket, `user_issue_report_screenshots` table access, and service-role storage permissions; cleanup failures should not block new report intake.
- If `/admin/reports` fails to load, verify:
  - admin auth
  - `user_issue_reports` migration presence
  - `user_issue_report_screenshots` migration and private bucket presence when screenshots are involved
  - service-role Supabase configuration
- If reports appear detached from a user, confirm whether the user account was deleted; the table intentionally preserves report rows with `user_id = null` in that case.

## Maintenance

- Keep route docs, API docs, schema docs, and the security checklist aligned when this lane changes.
- If report review later gains automation, add/update the relevant ADR and extend this SOP before enabling agent or scheduler ownership.
