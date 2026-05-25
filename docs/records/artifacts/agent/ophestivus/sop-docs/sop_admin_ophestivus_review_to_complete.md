# SOP: Admin Ophestivus Review To Complete

Purpose: audit tickets in the Ophestivus board `Review` column, decide whether they are ready for approval, and move verified work to `Complete` with a clear approval note.

## Scope

- Ophestivus board review queue at `/admin/kanban`.
- Board items whose current status is `review`.
- Admin kanban APIs under `/api/admin/kanban/*`.
- Board persistence in `admin_kanban_items` and `admin_kanban_activity`.
- Evidence linked from ticket details, repo changes, tests, and related runtime/admin panels.

## Source Of Truth

- Ophestivus board page: `frontend/pages/admin/kanban.tsx`
- Ophestivus board UI: `frontend/features/admin/components/AdminKanbanBoardSection.tsx`
- Ophestivus board server helper: `frontend/lib/server/api/adminKanbanBoard.ts`
- Ophestivus board operations SOP: `docs/records/artifacts/agent/ophestivus/sop-docs/sop_admin_ophestivus_board_operations.md`
- Admin error resolution SOP: `docs/records/artifacts/agent/ophestivus/sop-docs/sop_admin_error_to_ophestivus_resolution.md`
- Ticket activity route: `frontend/pages/api/admin/kanban/items/[itemId]/activity.ts`

## Preconditions

- Use an authenticated admin browser session when available.
- Preferred review helper path: run `cd frontend && npm run ophestivus:review -- --dry-run`.
- Preferred approval helper path after human/agent review: run `cd frontend && npm run ophestivus:review -- --ticket <item-id> --approve --dry-run`, then rerun without `--dry-run` after confirming the planned approval note fits.
- Preferred compact-summary path before approval when details are long: run `cd frontend && npm run ophestivus:compact-ticket-report` with the ticket summary fields, include `--report-path <path>`, and leave enough approval-note reserve.
- Run mutating helper commands with `--dry-run` first when the helper supports it, unless the user explicitly says to execute immediately.
- Use the server/API/data path only when safe credentials are already available.
- Never print, paste, or store service-role keys, bearer tokens, private customer data, or temporary env values in tickets or docs.
- Preserve unrelated dirty worktree changes.
- Keep `Published` human-controlled. This SOP may move items from `Review` to `Complete`; do not move items to `Published` unless the user explicitly instructs it.

## Trigger Phrase

Use this SOP when the user says one of:

- `review board`
- `audit review tickets`
- `approve review tickets`
- `run review SOP`
- `Ophestivus, review complete candidates`

## Workflow

1. Load the review queue.
   - Inspect the Ophestivus board for active tickets in `Review`.
   - Preferred command-line path: `cd frontend && npm run ophestivus:review -- --dry-run`.
   - Prefer the first review ticket by board order unless the user names a specific ticket.
   - If there are no `Review` tickets, report that there is nothing to approve and stop.

2. Read the ticket fully.
   - Record ticket id, title, status, details, latest activity, and any linked incident/task ids.
   - Confirm the ticket title is human-scannable and the details include a compact summary plus a repo-relative path to the full local report when one exists.

3. Audit the claimed work.
   - Re-read the compact ticket summary and the linked local report or equivalent evidence.
   - Inspect relevant changed files or durable records.
   - Re-run or verify the relevant tests/checks when the ticket depends on code or data correctness.
   - For Admin Errors tickets, verify linked incidents and same-fingerprint duplicates are resolved or no longer open, and confirm no fresh matching events appeared after the recorded fix/verification timestamp.

4. Decide approval.
   - Approve only when the ticket evidence is coherent, validation is passing or already freshly proven, and no unresolved blocker remains.
   - If the evidence is incomplete but the issue appears fixable without broad new work, keep the ticket in `Review`, add a concise review note explaining what is missing, and stop.
   - If the ticket is not actually resolved or needs more implementation work, move it back to `In progress` with a plain-language note.
   - If the ticket is blocked by human action, credentials, product intent, production approval, provider access, risky data/schema changes, or work that Ophestivus cannot reliably handle as one working agent, move it back to `Backlog` with the `[HUMAN REVIEW]` title prefix and Human Review / Escalation Ticket template from `docs/records/artifacts/agent/ophestivus/sop-docs/sop_admin_error_to_ophestivus_resolution.md`.

5. Re-read the ticket before promotion.
   - After validation and before writing approval, re-read the current board item and latest activity.
   - Confirm the item is still the same ticket, still in `Review`, still active, and its title/details have not changed since the audit began.
   - If the item moved, was archived, or its evidence changed, stop and restart the review from the current state instead of promoting stale work.

6. Move approved work to `Complete`.
   - Append the approval note template below to the ticket details through the item update path before moving the ticket. The current move API does not accept a note payload, so do not rely on the move activity alone for approval context.
   - Preserve the existing compact summary and local report path when appending the approval note.
   - Re-read the updated ticket and confirm the approval note is present and the item is still in `Review`.
   - Finalize the linked local Ophestivus report so it reflects the post-approval outcome, including final board status `complete`.
   - Preferred command-line approval path: `cd frontend && npm run ophestivus:review -- --ticket <item-id> --approve --dry-run`, then rerun without `--dry-run` after confirming the planned approval note fits.
   - Move the ticket from `Review` to `Complete`.
   - Do not move it to `Published`.

## Required Gates

### Review Evidence Gate

- Ticket has a clear title, current status `review`, and a readable compact summary plus local report path or equivalent evidence.
- Ticket details identify what was changed or why no code change was required.
- Ticket details include validation results or a reason validation was not applicable.
- Ticket details list residual risk classification and residual risk or state that none is known.
- For Ophestivus-run work, the full investigation narrative is stored in `docs/records/artifacts/agent/ophestivus/reports/`; the board ticket should not be treated as the full audit log.
- Review-ready residual risk classification is `Accepted`, `Monitor`, or `Follow-up`. `Human Review` belongs only to the backlog escalation path.
- When residual risk is `Follow-up`, a separate backlog ticket exists only if the follow-up is concrete, actionable, and not already tracked.
- Ticket details fit the board limit with enough room for the approval note; use `ophestivus:compact-ticket-report` and the local report path instead of manual shorten/dry-run loops.

### Resolution Verification Gate

- The original issue is resolved by evidence, not assumption.
- Relevant tests/checks are passing or were freshly validated during this SOP.
- For incident-driven work, linked incidents and same-fingerprint duplicates are not open.
- For incident-driven work, no fresh matching events appeared after the fix or verification timestamp.
- No unresolved in-scope blocker remains.

### Complete Gate

- Only move the ticket to `Complete` after the review evidence and resolution verification gates are clean.
- Re-read the ticket after validation and before promotion to prevent stale shared-board state from being approved.
- Append a visible approval note to ticket details before moving the item to `Complete`.
- Confirm the approval note is present and the ticket is still in `Review` before the move.
- Confirm the linked local report was finalized to the `complete` outcome after approval.
- Leave `Published` untouched unless explicitly instructed by the user.

## Approval Note Template

Append this template to the ticket details before moving an item to `Complete`.

```text
Approval:
Reviewed by:
What was checked:
Validation:
Incident/data verification:
Residual risk:
Decision: moved to Complete.
```

## Error Handling

- Review evidence missing: keep the ticket in `Review`, add the missing-evidence note, and stop.
- Tests fail or cannot be run: keep the ticket in `Review` if the work only needs more proof; move to `In progress` if the failure shows more implementation is needed.
- Fresh matching incident/event appears: move the ticket back to `In progress` and include the new evidence.
- Human action needed or task too broad for one reliable Ophestivus pass: move the ticket back to `Backlog`, prefix the title with `[HUMAN REVIEW]`, and add the Human Review / Escalation Ticket template from the Admin Errors SOP.
- Ticket was already moved by someone else: re-read the current ticket state and do not override it without a current reason.
- Ticket details changed during review: restart the audit from the updated ticket instead of promoting stale evidence.
- Approval note update fails: do not move the ticket to `Complete`; keep it in `Review` and record the update failure when possible.
- Unrelated review ticket discovered: do not approve unrelated tickets unless the user authorized review queue scope.

## Validation

- Prefer targeted re-validation for the ticket's claimed lane first. Re-run the smallest coherent test/check set that proves the reviewed work is still valid, and widen only when the ticket evidence or changed surface requires it.
- Expect tier-appropriate proof in the review evidence:
  - `low` risk tickets should show targeted validation plus recurrence verification.
  - `medium` risk tickets should also show one adjacent contract or neighboring-behavior check.
  - `high` risk work should normally have been escalated already unless the local report clearly shows that the issue was reduced to one bounded seam.
- Do not approve a ticket if its claimed fix introduced new lint warnings, type errors, or equivalent validation regressions in the touched lane. Those must be resolved first.
- If the ticket left behind low-risk lint/type issues in touched files that are directly tied to the same lane, prefer sending it back only when those issues undermine the claimed fix or should clearly have been cleaned up as part of the same bounded work.
- Treat unrelated repo-wide failures found during review as background repo health unless they touch the ticket's lane or undermine the claimed resolution. Record them when useful, but do not block promotion solely because the wider repo has unrelated failing checks.
- Treat unrelated pre-existing lint warnings, type errors, or wider validation debt the same way: note them when useful, but do not block promotion unless they overlap the ticket's lane or make the approval evidence unreliable.
- When the fix type is prone to accidental collateral damage, prefer negative verification in review: confirm the report or checks prove that adjacent behavior still works, not only that the original incident stopped.
- Board/API changes: run targeted kanban page, component, and API tests.
- Incident-driven approval: verify Admin Errors backing data or UI state.
- Code-driven approval: run the relevant targeted tests/checks for touched paths.
- Board-helper changes: run `npx eslint ../docs/records/artifacts/agent/ophestivus/tools/ophestivus_review.mjs ../docs/records/artifacts/agent/ophestivus/tools/ophestivus_error_status.mjs ../docs/records/artifacts/agent/ophestivus/tools/ophestivus_intake.mjs` and dry-run the changed helper command.
- Error closeout helper changes: run `npx eslint ../docs/records/artifacts/agent/ophestivus/tools/ophestivus_complete_error_ticket.mjs ../docs/records/artifacts/agent/ophestivus/tools/ophestivus_ticket_report.mjs` and `npm run test -- tests/scripts/ophestivus-ticket-report.test.mjs`.
- Docs-only SOP changes: run `node scripts/check_docs_links.js`.

## Review Checklist

- Review ticket selected by board order or user instruction.
- Ticket details, local report path, and activity read.
- Claimed repo changes or data changes inspected.
- Relevant tests/checks verified.
- Incident/data recurrence verified when applicable.
- No fresh matching failures found after fix/verification timestamp.
- Missing evidence, failed validation, or blockers handled without promoting.
- Work that is too broad or unreliable for Ophestivus alone returned to `Backlog` with `[HUMAN REVIEW]` and the Human Review / Escalation Ticket template.
- `Follow-up` residual risk has either a concrete separate backlog ticket or a clear explanation that no separate ticket is needed.
- Ticket re-read after validation and before promotion.
- Approved ticket received a concise approval note appended to ticket details.
- Approval note presence confirmed while ticket was still in `Review`.
- Approved ticket moved from `Review` to `Complete`.
- `Published` left untouched.

## Maintenance

- Keep this SOP synchronized with `docs/records/artifacts/agent/ophestivus/sop-docs/sop_admin_ophestivus_board_operations.md`.
- If the board gains first-class comments or reviewer approvals, update this SOP to use that surface instead of embedding approval notes in item details.
