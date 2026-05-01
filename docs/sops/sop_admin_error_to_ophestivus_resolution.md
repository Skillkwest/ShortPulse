# SOP: Admin Error To Ophestivus Resolution

Purpose: triage an Admin Errors incident into the Ophestivus board, work the issue to resolution or a clear blocker, validate the result, and leave a visible ticket report.

## Scope

- Admin Errors triage at `/admin/errors`.
- Ophestivus board task tracking at `/admin/kanban`.
- Admin Errors APIs under `/api/admin/errors`, `/api/admin/error-events`, and `/api/admin/errors-status`.
- Admin kanban APIs under `/api/admin/kanban/*`.
- Backing data in `app_error_logs`, `app_error_events`, `admin_kanban_items`, and `admin_kanban_activity`.

## Source Of Truth

- Admin Errors page: `frontend/pages/admin/errors.tsx`
- Error panel UI: `frontend/features/admin/components/ErrorIncidentsPanel.tsx`
- Error events API logic: `frontend/features/admin/logic/adminErrorsEventsApi.ts`
- Admin Errors routes: `frontend/pages/api/admin/errors.ts`, `frontend/pages/api/admin/error-events.ts`, `frontend/pages/api/admin/errors-status.ts`
- Ophestivus board page: `frontend/pages/admin/kanban.tsx`
- Ophestivus board UI: `frontend/features/admin/components/AdminKanbanBoardSection.tsx`
- Ophestivus board server helper: `frontend/lib/server/api/adminKanbanBoard.ts`
- Ophestivus board operations SOP: `docs/sops/sop_admin_ophestivus_board_operations.md`
- SQL migration SOP: `docs/sops/sop_sql_migration_operations.md`
- Troubleshooting index: `docs/troubleshooting.md`
- Monitoring reference: `docs/monitoring.md`

## Preconditions

- Use an authenticated admin browser session when available.
- Preferred no-click intake path: run `cd frontend && npm run ophestivus:intake`.
- If browser access is blocked by login or admin session state, use the no-click intake path or code/API path only when local server credentials allow it safely.
- Never print, paste, or store service-role keys, bearer tokens, private customer data, or temporary env values in tickets or docs.
- Keep `Published` human-controlled. This SOP may move items to `Backlog`, `In progress`, or `Review`; do not move items to `Published` unless the user explicitly instructs it.
- Preserve unrelated dirty worktree changes and keep fixes scoped to the current incident.

## Incident Selection

- Start with the Ophestivus board before creating new work.
- If `Backlog` contains one or more active Ophestivus tickets, choose the first backlog ticket by board order and work that ticket.
- Only inspect `/admin/errors` for a new incident when there are no active `Backlog` tickets to work, or when the user explicitly asks for a specific Admin Errors incident.
- If the user names a specific incident or ticket, use that target.
- If the user says "first error" or does not specify an incident and the backlog is empty, select the first incident by this order:
  1. `status = open`
  2. highest severity first
  3. most recent `last_seen_at`
  4. highest hit count as the final tie-breaker
- Treat same-fingerprint open incidents as the same recurrence family. Intake and verification should account for all open rows with the selected incident's fingerprint, not only the selected incident id.
- If the UI ordering and backing data disagree, prefer the backing data and record that discrepancy on the ticket.
- Do not skip to a lower-priority incident unless the higher-priority item is already resolved, intentionally ignored, or blocked with a clear note.

## Workflow

1. Check the Ophestivus board backlog.
   - Preferred: run `cd frontend && npm run ophestivus:intake`.
   - The intake command checks `/admin/kanban` backing data first and returns the first active `Backlog` ticket when one exists.
   - Fallback: open `/admin/kanban` or inspect its backing data/API.
   - If an active `Backlog` ticket exists, select the first backlog ticket by board order and continue at step 3.
   - If a backlog ticket references an Admin Errors incident, record the incident id, verify it and same-fingerprint duplicates are no longer open in Admin Errors, and load the matching Admin Errors evidence before moving the ticket.
   - If no backlog ticket exists, continue to step 2.

2. Check Admin Errors and add a new backlog ticket.
   - Preferred: let `cd frontend && npm run ophestivus:intake` create the ticket and remove the incident from the open Admin Errors page.
   - Fallback: open `/admin/errors` or inspect its backing data/API.
   - Identify the target incident using the incident selection rule above.
   - Record the incident id, severity, status, route, endpoint, message, hit count, first seen, last seen, user scope, and source.
   - Create a ticket with a concise title.
   - Include enough detail for another admin to understand the incident without opening raw logs.
   - Include the incident id and the evidence source. Do not include secrets or private user payloads.
   - After the ticket is created, remove the incident and any same-fingerprint open duplicates from the open Admin Errors page by transitioning them out of `open` with a note that they are now tracked on the Ophestivus board.
   - Use `ignored` for this intake handoff unless the issue has already been proven fixed. Use `resolved` only when the resolution proof is complete.
   - If the incident cannot be removed from the open Admin Errors page, leave the ticket in `Backlog`, add a blocker note, and do not move it to `In progress`.

3. Audit and inspect the error.
   - Load the relevant repo instructions and scoped docs before editing.
   - Inspect the code path, API route, database access, migration history, and recent runtime evidence tied to the incident.
   - Classify the likely cause as code, data, schema/migration, deploy/config, provider, auth/session, or user action.

4. Explore more.
   - Pull supporting evidence before changing code or state.
   - Check raw events, recurrence patterns, related endpoints, relevant tables/RPCs, route behavior, tests, and docs.
   - If the first finding exposes a larger issue, keep exploration bounded to the incident unless the user expands scope.

5. Move the ticket to `In progress`.
   - Move the board item before active resolution work begins.
   - Keep the ticket details current when the working theory changes materially.

6. Attempt to resolve the issue.
   - Make the smallest safe operational, SQL, or code change that addresses the root cause.
   - For SQL/migration work, follow `docs/sops/sop_sql_migration_operations.md` and do not use Docker-based Supabase workflows.
   - For code changes, add focused defensive handling only when it prevents the same class of issue from recurring.
   - Do not mark the issue resolved based only on a local assumption; verify against the panel or its backing data.
   - Apply the investigation stop rule below instead of continuing indefinitely when progress stalls.

7. Audit the work for missed issues.
   - Re-read the touched paths and the incident evidence after the fix.
   - Check for related regressions, missing validation, missing docs, data exposure risk, and recurrence windows.

8. Resolve new findings when they are in scope.
   - Fix high-value findings that directly affect the same incident and can be handled safely.
   - If a finding is real but outside the current incident, record it as a follow-up instead of expanding the task by momentum.

9. Use the blocked path when human intervention is required.
   - If completion is blocked by login, missing credentials, external account access, approval, a production migration window, or another human-only step, update the ticket with simple human-readable instructions.
   - State what must be done before Ophestivus can continue.
   - Use the blocked ticket template below so the next person can resume without reconstructing context.
   - Move the ticket back to `Backlog`.
   - Do not leave a blocked item in `In progress` unless the user explicitly asks.

10. Use the successful path when the issue is resolved.
    - Before moving the ticket to `Review`, prove the issue is actually resolved using the checks the issue requires.
    - Verify the incident and any same-fingerprint duplicates are resolved or no longer open in `/admin/errors` or its backing data.
    - Confirm no fresh same-fingerprint matching events have appeared after the fix timestamp or operational change timestamp.
    - Run the relevant tests/checks for the touched area.
    - Audit the fix path after tests pass. Re-check changed code, affected data, and the original incident evidence for missed failure modes.
    - Add or update code that prevents recurrence when the root cause is an application defect.
    - If any verification step fails or remains inconclusive, keep the ticket in `In progress` or move it to `Backlog` with a blocker note. Do not move it to `Review`.

11. Report and move the board ticket to `Review`.
    - Rename the ticket to the plain error name/message so review-ready work is easy to scan.
    - Add a simple summary of the repo changes to the ticket details using the completion report template below as the source material.
    - Move the ticket to `Review` only after the issue is verified as resolved, relevant validation passes, and the report is in place.
    - Do not move partial fixes to `Review`. If anything material remains unresolved, keep the ticket in `In progress` while actively working or move it back to `Backlog` with a blocker note.
    - Leave `Published` untouched unless explicitly instructed by the user.

## Investigation Stop Rule

Ophestivus should stop and hand off instead of continuing indefinitely when meaningful progress has stalled.

Stop and use the blocked path when any of these are true:

- Two reasonable fix attempts fail validation.
- Ophestivus spends 45-60 minutes without finding new evidence, a narrower root cause, or a viable next test.
- The issue is blocked by credentials, admin login, production approval, vendor/provider access, missing external account access, or unclear product intent.
- The likely fix requires risky production data/schema changes without explicit approval.
- The root cause remains unclear after checking the relevant logs, code path, recent events, and focused tests.
- Further work would require broad unrelated refactors or guessing.

Continue past the stop rule only when a concrete new lead is available, a relevant validation run is already in progress, or the user explicitly asks Ophestivus to keep working on that ticket.

When the stop rule triggers:

- Do not mark the incident resolved.
- Do not move the ticket to `Review`.
- Keep or move the ticket back to `Backlog`.
- Add the blocked ticket template below with a plain-language handoff.
- Include what was checked, what was tried, what remains unresolved, why continuing is unsafe or low value, the escalation needed, and the resume condition.

Use one of these escalation labels when possible:

- `Human admin`
- `Product decision`
- `Production deploy`
- `Supabase/DB access`
- `Vendor/provider access`
- `Code owner review`

## Ticket Templates

Use these templates in the ticket details or the board's supported note/comment surface.

### Initial Ticket

```text
Incident:
Severity:
Status:
Route/endpoint:
Message:
First seen:
Last seen:
Hits:
Evidence source:
Initial theory:
```

### Blocked Ticket

```text
Blocked by:
Escalation needed:
What Ophestivus checked:
What Ophestivus tried:
What remains unresolved:
Why continuing would be unsafe/low value:
Human action needed:
Resume condition:
```

### Review Report

```text
Resolved Admin Errors incident:
Repo changes:
Tests/validation:
Recurrence check:
Residual risk/follow-ups:
```

## Error Handling

- Browser login blocked: use the server/API/data path only when safe credentials are already available. If admin verification cannot be completed, move the ticket back to `Backlog` with a login/admin-access blocker.
- Service-role or admin credentials unavailable: do not invent evidence. Record the blocker and the exact next human step on the ticket.
- Intake removal fails: do not begin active work. Keep or move the ticket to `Backlog`, record that the Admin Errors incident could not be removed from `open`, and include the exact follow-up needed.
- SQL/schema missing: follow the SQL migration SOP, target the intended remote environment explicitly, and never use `supabase start`, `supabase stop`, `supabase db reset --local`, `supabase db lint --local`, or direct Docker commands.
- Fresh matching or same-fingerprint errors after a fix: keep the ticket in `In progress`, update the working notes, and continue investigation.
- Fix fails validation: keep the ticket in `In progress`, record the failed attempt and validation output in the ticket, and continue with a safer fix or blocker path.
- Resolution cannot be proven: do not move the ticket to `Review`. Record what was checked, what remains uncertain, and the next required verification step.
- Partial fix only: do not move the ticket to `Review`. Record the unresolved portion and either keep active work in `In progress` or move the ticket back to `Backlog` with the blocked ticket template.
- Fix is risky or requires rollback: stop broad changes, document the risk, use the least destructive rollback path available, and keep the ticket out of `Review` until the incident and validation are clean.
- Unrelated incidents discovered: do not resolve or ignore unrelated incidents as part of this SOP unless the user authorizes that scope.

## Validation

- Admin Errors API/UI changes: run the targeted Admin Errors API, panel, pagination, and event-logic tests.
- Ophestivus board API/UI changes: run the targeted kanban component, page, and API tests.
- SQL changes: validate against a hosted target when credentials are available, then run the runtime SQL security audit in staging before release signoff.
- Docs-only changes to this SOP: run `node scripts/check_docs_links.js`.
- Before completing a ticket, verify the linked incident status and same-fingerprint recurrence state through `/admin/errors` or the panel backing data.
- Recurrence verification must compare same-fingerprint matching events against the fix timestamp or operational change timestamp. If the timestamp is unknown, record that limitation in the completion report.

## Review Checklist

- Target incident identified and recorded on the ticket.
- Ticket created in `Backlog`.
- Newly ticketed Admin Errors incident and same-fingerprint open duplicates removed from the open error page with a board-tracking note.
- Ticket moved to `In progress` before active resolution work.
- Root cause inspected with supporting evidence.
- Fix or blocker path selected.
- If blocked, ticket returned to `Backlog` with human-readable next steps.
- If the stop rule triggered, ticket returned to `Backlog` with escalation needed, checked evidence, attempted fixes, unresolved work, and resume condition.
- If resolved, relevant tests/checks passed.
- If resolved, recurrence prevention was added when code was the root cause.
- If resolved, Admin Errors panel or backing data confirms the incident and same-fingerprint duplicates are resolved or no longer open.
- If resolved, no fresh same-fingerprint matching events appeared after the fix or operational change timestamp.
- If resolved, Ophestivus audited the fix after validation and found no missed in-scope blocker.
- If only partially fixed, ticket did not move to `Review`.
- Ticket title is the plain error name/message.
- Ticket contains a simple visible summary of repo changes, validation, and residual risk.
- Ticket moved to `Review`.

## Maintenance

- Keep this SOP synchronized with `docs/sops/sop_admin_ophestivus_board_operations.md`.
- If the board gains a richer note/comment model, update the report step to use that model instead of only item details/activity.
- If Ophestivus automation becomes product-authoritative later, add or update an ADR before changing the human-control contract for `Published`.
