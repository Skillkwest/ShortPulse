# SOP: Admin Ophestivus Complete Regression Audit

Purpose: lightly audit aged `Complete` Ophestivus board tickets for evidence that the original issue regressed after completion.

## Scope

- Ophestivus board tickets in `Complete`.
- Completed Admin Errors incident tickets with linked incident/report evidence.
- Regression checks through ticket activity, local reports, `ophestivus:error-status`, and `ophestivus:error-event-detail`.

This SOP is maintenance work. It is not part of `run your workflow` unless the user explicitly adds it later.

## Trigger Phrases

- `run check complete SOP`
- `run complete regression audit`
- `audit complete column`
- `check completed work`
- `check complete regressions`

## Rules

- Audit one ticket per run by default.
- Use the oldest eligible `Complete` ticket by `Complete` move timestamp.
- Default eligibility window is 7 days after the ticket moved to `Complete`.
- If a ticket/report declares `Regression audit window: 48h | 7d | 14d | 30d`, use that window instead.
- Do not move the original completed ticket backward. It is historical evidence.
- Create a new ticket for any confirmed or suspected regression.
- Do not move anything to `Published`.
- Keep the audit timeboxed to 10-15 minutes unless the user asks for deeper review.

## Workflow

1. Find the oldest eligible `Complete` ticket.
   - Read `admin_kanban_items` and `admin_kanban_activity`.
   - Use the activity row where the ticket moved to `complete` as the completion timestamp.
   - If no `Complete` ticket is old enough, stop and report the next eligible date when available.
   - If the ticket already has a regression-audit note within the last 7 days, skip it and inspect the next oldest eligible ticket.

2. Read evidence.
   - Read the ticket title, details, activity, linked incident id, linked local report, completion timestamp, verification class, and residual risk.
   - For Admin Errors tickets, run `cd frontend && npm run ophestivus:error-status -- --incident <incident-id> --after <complete-timestamp>`.
   - Use `ophestivus:error-event-detail` only when fresh events or ambiguous related incidents need stack/metadata context.

3. Check for regression evidence.
   - Same-fingerprint incident reopened or fresh same-fingerprint event after completion.
   - New related incident with matching route, endpoint, message, or stack family.
   - Targeted test now fails for the original fixed behavior.
   - Code drift clearly removed or bypassed the original fix.

4. Decide outcome.
   - `No regression found`: append a short audit note or write a local report, then leave the ticket in `Complete`.
   - `Regression suspected`: create a new `Backlog` ticket with evidence and link back to the completed ticket.
   - `Regression confirmed`: create a new `Backlog` ticket unless the user explicitly asks for immediate active work.
   - `Insufficient evidence`: leave the ticket in `Complete`, record what could not be verified, and do not create work unless there is a concrete next step.

5. Stop.
   - Do not continue to the next completed ticket unless the user explicitly asks.
   - Do not turn the audit into a broad investigation without fresh evidence.

## Audit Note Template

```text
Complete regression audit:
Audited by: Ophestivus
Completed at:
Audit window:
Evidence checked:
Result: No regression found | Regression suspected | Regression confirmed | Insufficient evidence
Follow-up ticket:
Notes:
```

## New Regression Ticket Template

```text
Regression from completed ticket:
Original ticket:
Original incident:
Completed at:
Regression evidence:
Fresh event/incident:
Why this is related:
Suggested next step:
```

## Retirement Path

- If three consecutive runs produce no actionable findings and no process friction, keep this SOP optional maintenance only.
- If repeated regressions are found, build an automated recurrence monitor or helper instead of continuing manual audits.
