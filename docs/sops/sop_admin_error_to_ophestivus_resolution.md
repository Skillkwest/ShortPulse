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
- Preferred recurrence/status check path: run `cd frontend && npm run ophestivus:error-status -- --incident <incident-id> --after <verification-timestamp>` or use `--fingerprint <fingerprint>`.
- Preferred event-detail path: run `cd frontend && npm run ophestivus:error-event-detail -- --incident <incident-id>` or `--ticket <ticket-id>` to inspect redacted latest stack/metadata evidence.
- Preferred report compaction path: run `cd frontend && npm run ophestivus:compact-ticket-report -- --incident <incident-id> --issue <text> --resolution-type <type> --repo-changes <text> --validation <text> --verification-class <class> --recurrence <text> --risk-class <class> --risk <text> --report-path <path>`.
- Preferred closeout path after validation: run `cd frontend && npm run ophestivus:complete-error-ticket -- --ticket <ticket-id> --incident <incident-id> --after <verification-timestamp> --resolution-type <type> --issue <text> --repo-changes <text> --validation <text> --verification-class <class> --risk-class <class> --risk <text>`.
- Preferred local report path: let `ophestivus:complete-error-ticket` write the full report under `docs/records/artifacts/agent/ophestivus/reports/`, or pass `--report-output <path>` when a specific report filename is needed.
- Preferred closeout helper includes a pre-Review evidence validator. It must confirm the compact ticket summary includes the full local report path, leaves approval-note room, and has non-empty local report content before moving a ticket to `Review`.
- Run mutating helper commands with `--dry-run` first when the helper supports it, unless the user explicitly says to execute immediately.
- If browser access is blocked by login or admin session state, use the no-click intake path or code/API path only when local server credentials allow it safely.
- Never print, paste, or store service-role keys, bearer tokens, private customer data, or temporary env values in tickets or docs.
- Keep `Published` human-controlled. This SOP may move items to `Backlog`, `In progress`, or `Review`; do not move items to `Published` unless the user explicitly instructs it.
- Preserve unrelated dirty worktree changes and keep fixes scoped to the current incident.

## Intake Rules

- Start with the Ophestivus board before creating new work.
- Preferred no-click intake: `cd frontend && npm run ophestivus:intake`.
- If `Backlog` contains one or more active Ophestivus tickets, choose the first backlog ticket by board order.
- Only inspect `/admin/errors` for a new incident when there are no active `Backlog` tickets, or when the user explicitly asks for a specific Admin Errors incident.
- If the user names a specific incident or ticket, use that target.
- If the backlog is empty and no specific incident is named, select the first open incident by this order:
  1. highest severity
  2. most recent `last_seen_at`
  3. highest hit count
- Treat same-fingerprint open incidents as the same recurrence family. Intake and verification must account for all open rows with the selected incident's fingerprint, not only the selected incident id.
- If the UI ordering and backing data disagree, prefer the backing data and record that discrepancy on the ticket.
- Do not skip to a lower-priority incident unless the higher-priority item is already resolved, intentionally ignored, or blocked with a clear note.

## Fast Path Workflow

1. Run intake.
   - Preferred: `cd frontend && npm run ophestivus:intake`.
   - Fallback: inspect `/admin/kanban` and `/admin/errors` through the browser or backing data/API.

2. Select work.
   - If intake returns a backlog ticket, work that ticket.
   - If intake creates a new ticket from Admin Errors, confirm it also removed the incident and same-fingerprint open duplicates from the open error page.
   - If intake cannot remove the error from the open page, keep the ticket in `Backlog` with a blocker note and stop.

3. Load evidence before moving the ticket.
   - Record the incident id, fingerprint, severity, status, route, endpoint, message, hit count, first seen, last seen, user scope, and source.
   - For runtime/UI/client incidents, run `ophestivus:error-event-detail` when possible to capture redacted stack frames, environment, visibility, build id, route, endpoint, and breadcrumb summary.
   - Load relevant repo instructions and scoped docs before editing.
   - Inspect the code path, API route, database access, migration history, recent runtime evidence, recurrence pattern, related endpoints, tests, and docs.

4. Move the ticket to `In progress`.
   - Move the board item only after the intake gate is clean.
   - Keep ticket details current when the working theory changes materially.

5. Attempt the smallest safe fix.
   - Classify the likely cause as code, data, schema/migration, deploy/config, provider, auth/session, or user action.
   - For SQL/migration work, follow `docs/sops/sop_sql_migration_operations.md` and do not use Docker-based Supabase workflows.
   - For code changes, add focused defensive handling only when it prevents the same class of issue from recurring.
   - Apply the investigation stop rule instead of continuing indefinitely when progress stalls.

6. Self-audit and resolve in-scope findings.
   - Re-read touched paths and incident evidence after the fix.
   - Check for related regressions, missing validation, missing docs, data exposure risk, and recurrence windows.
   - Fix high-value findings directly tied to the same incident when safe.
   - Record out-of-scope findings as follow-ups instead of expanding by momentum.

7. Choose the closeout path.
   - If blocked or unresolved, move the ticket back to `Backlog` with the blocked ticket template.
   - If the work is too broad or unreliable for Ophestivus to handle as one working agent, escalate it for human review, keep or move it to `Backlog`, and use the human-review banner below.
   - If fully resolved and verified, use `npm run ophestivus:complete-error-ticket -- --dry-run` first, then run it without `--dry-run` to write the full local report, resolve the incident, write the compact ticket summary with report path, and move the ticket to `Review`.
   - Use a manual closeout only when the helper is unavailable or the ticket is not an Admin Errors incident; write the full local report first, then write a compact ticket summary with the report path before moving the ticket to `Review`.
   - Leave `Published` untouched unless explicitly instructed by the user.

## Required Gates

### Intake Gate

- A newly ticketed Admin Errors incident must be removed from the open error page before active work begins.
- Remove same-fingerprint open duplicates at intake when they are clearly the same recurrence family.
- Use `ignored` for intake handoff unless the issue has already been proven fixed. Use `resolved` only when resolution proof is complete.
- If intake removal fails, keep or move the ticket to `Backlog`, add a blocker note, and do not move it to `In progress`.

### In Progress Gate

- Move a ticket to `In progress` before active resolution work begins.
- Do not mark the issue resolved based only on a local assumption.
- Do not continue without the relevant incident evidence and scoped repo context.

### Resolution Gate

- Before moving a ticket to `Review`, prove the issue is actually resolved using the checks the issue requires.
- Verify the incident and any same-fingerprint duplicates are resolved or no longer open in `/admin/errors` or its backing data.
- Confirm no fresh same-fingerprint matching events appeared after the fix timestamp or operational change timestamp.
- Run the relevant tests/checks for the touched area.
- For route/UI/runtime incidents, perform live route verification when feasible. Open or refresh the affected route, exercise the failing path if known, and confirm the same console/runtime/API error does not recur.
- If live route verification is not feasible, record why and classify the verification as `blocked-live-verification`, `tests-and-data-verified`, or `telemetry-filter-verified` as appropriate.
- Audit the fix path after tests pass. Re-check changed code, affected data, and original incident evidence for missed failure modes.
- Add or update recurrence prevention when the root cause is an application defect.

### Review Gate

- Rename the ticket to the plain error name/message so review-ready work is easy to scan.
- Treat the local Ophestivus report under `docs/records/artifacts/agent/ophestivus/reports/` as the durable source of truth for investigation notes, full validation detail, and closeout evidence.
- Add only a compact board summary to ticket details: issue, resolution type, key repo change, validation result, recurrence check, residual risk classification, residual risk, and the repo-relative local report path.
- Classify the resolution as `new-code`, `verified-existing-fix`, `no-code`, `config`, or `data`.
- Classify the verification as `live-route-verified`, `tests-and-data-verified`, `telemetry-filter-verified`, or `blocked-live-verification`.
  - `live-route-verified`: the affected route or UI flow was opened/refreshed and the matching error did not recur.
  - `tests-and-data-verified`: targeted tests and backing incident data prove the issue is resolved, but no live browser route check was performed.
  - `telemetry-filter-verified`: the fix intentionally changes telemetry filtering, and tests/data prove the filtered class no longer reaches the operator queue.
  - `blocked-live-verification`: live route verification was appropriate but blocked; explain the blocker and keep residual risk explicit.
- Classify Review-ready residual risk as `Accepted`, `Monitor`, or `Follow-up`.
  - `Accepted`: no meaningful remaining risk beyond normal regression risk.
  - `Monitor`: no follow-up ticket is needed, but recurrence should be watched through Admin Errors or normal telemetry.
  - `Follow-up`: this ticket is resolved, but a separate tracked task is needed for remaining non-blocking work.
- Use `Human Review` only when Ophestivus cannot reliably complete or verify the work; keep or move that ticket to `Backlog`.
- When residual risk is `Follow-up`, create a separate `Backlog` ticket only when the follow-up is concrete, actionable, and not already tracked. Otherwise record the follow-up in the Review report only.
- Use `Human Review` only for blocked/escalated work; do not move that ticket to `Review`.
- Add the stale local bundle note for localhost/development chunk incidents: `Local dev note: refresh browser and restart dev server if the old chunk is still loaded.`
- Use `ophestivus:compact-ticket-report` when a manual ticket summary is needed so the details leave room for the later Review approval note.
- If using the helper path, `ophestivus:complete-error-ticket` must pass its pre-Review evidence validator before it can move the ticket to `Review`.
- Move the ticket to `Review` only after the resolution gate is clean and the report is in place.
- Do not move partial fixes, inconclusive fixes, risky fixes, or blocked work to `Review`.

## Investigation Stop Rule

Ophestivus should stop and hand off instead of continuing indefinitely when meaningful progress has stalled.

Stop and use the blocked path when any of these are true:

- Two reasonable fix attempts fail validation.
- Ophestivus spends 45-60 minutes without finding new evidence, a narrower root cause, or a viable next test.
- The task needs multiple broad investigation lanes, parallel implementation owners, or cross-domain authority that Ophestivus cannot reliably coordinate as one working agent.
- The issue is blocked by credentials, admin login, production approval, vendor/provider access, missing external account access, or unclear product intent.
- The likely fix requires risky production data/schema changes without explicit approval.
- The root cause remains unclear after checking the relevant logs, code path, recent events, and focused tests.
- Further work would require broad unrelated refactors or guessing.

Continue past the stop rule only when a concrete new lead is available, a relevant validation run is already in progress, or the user explicitly asks Ophestivus to keep working on that ticket.

When the stop rule triggers:

- Do not mark the incident resolved.
- Do not move the ticket to `Review`.
- Keep or move the ticket back to `Backlog`.
- Rename the ticket with the title prefix `[HUMAN REVIEW]`.
- Add the human-review banner and Human Review / Escalation Ticket template below with a plain-language handoff.
- Include what was checked, what was tried, what remains unresolved, why continuing is unsafe or low value, the escalation needed, and the resume condition.
- The current board renders details as plain text. Use the exact text banner below for clarity. If a future board surface supports styled notes, render the banner in the blue theme and bold, but do not depend on styling for meaning.

Use one of these escalation labels when possible:

- `Human admin`
- `Product decision`
- `Production deploy`
- `Supabase/DB access`
- `Vendor/provider access`
- `Code owner review`

Do not add specialized escalation templates until repeated board patterns justify them. Future candidates include provider escalation, SQL/migration approval, product decision, multi-agent investigation, production deploy/release gate, and security/privacy review.

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

### Human Review / Escalation Ticket

```text
*** HUMAN REVIEW REQUIRED ***
Escalation type:
Why Ophestivus stopped:
What Ophestivus checked:
What Ophestivus tried:
Current evidence:
What remains unresolved:
Risk if continued by agent:
Human action needed:
Resume condition:
Suggested owner:
```

### Human Review Title

```text
[HUMAN REVIEW] <plain issue title>
```

### Compact Ticket Summary

```text
Resolved Admin Errors incident:
Resolution type:
Key repo change:
Validation:
Verification class: live-route-verified | tests-and-data-verified | telemetry-filter-verified | blocked-live-verification
Recurrence check:
Residual risk classification: Accepted | Monitor | Follow-up
Residual risk:
Full report:
Local dev note:
```

### Full Local Report

Store full SOP run reports under:

```text
docs/records/artifacts/agent/ophestivus/reports/
```

The local report is the durable audit record. Include incident data, investigation notes, changed files, validation commands, recurrence checks, residual risk, and review notes there instead of trying to fit the full narrative into the board ticket.

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
- Before moving a ticket to `Review`, verify the linked incident status and same-fingerprint recurrence state through `/admin/errors` or the panel backing data.
- Preferred command-line recurrence verification: `cd frontend && npm run ophestivus:error-status -- --incident <incident-id> --after <fix-or-verification-timestamp>`.
- Preferred command-line closeout: `cd frontend && npm run ophestivus:complete-error-ticket -- --ticket <ticket-id> --incident <incident-id> --after <fix-or-verification-timestamp> --resolution-type <type> --issue <text> --repo-changes <text> --validation <text> --risk-class <class> --risk <text>`.
- The closeout helper may resolve the selected incident during closeout, but it must block if other same-fingerprint open incidents or fresh same-fingerprint events remain.
- Run the closeout helper with `--dry-run` before mutation unless the user explicitly says to execute immediately.
- Recurrence verification must compare same-fingerprint matching events against the fix timestamp or operational change timestamp. If the timestamp is unknown, record that limitation in the review report.

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
- If resolved, route/UI/runtime issues have either live route verification or an explicit verification class explaining why live verification was not performed.
- If resolved, recurrence prevention was added when code was the root cause.
- If resolved, Admin Errors panel or backing data confirms the incident and same-fingerprint duplicates are resolved or no longer open.
- If resolved, no fresh same-fingerprint matching events appeared after the fix or operational change timestamp.
- If resolved, Ophestivus audited the fix after validation and found no missed in-scope blocker.
- If only partially fixed, ticket did not move to `Review`.
- Ticket title is the plain error name/message.
- Ticket contains a simple visible summary of resolution type, repo changes, validation, recurrence, residual risk classification, and residual risk.
- Any `Follow-up` residual risk has either a concrete separate backlog ticket or a clear explanation that no separate ticket is needed.
- Ticket moved to `Review`.

## Maintenance

- Keep this SOP synchronized with `docs/sops/sop_admin_ophestivus_board_operations.md`.
- If the board gains a richer note/comment model, update the report step to use that model instead of only item details/activity.
- If Ophestivus automation becomes product-authoritative later, add or update an ADR before changing the human-control contract for `Published`.
