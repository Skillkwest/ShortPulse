# Ophestivus Helper Tools

Purpose: inventory the local commands Ophestivus uses for no-click admin error and board workflows.

Run commands from `frontend/` unless noted otherwise.

## Commands

| Command                                                                           | Script path                                             | Purpose                                                                                                                 | Mutates data                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `npm run ophestivus:intake`                                                       | `frontend/scripts/ophestivus_intake.mjs`                | Select the first runnable non-human-review Backlog ticket or create a new Backlog ticket from the next Admin Errors incident. Parked human-review backlog cards do not block new bounded intake. | Yes, unless `--dry-run`             |
| `npm run ophestivus:error-status -- --incident <incident-id> --after <timestamp>` | `frontend/scripts/ophestivus_error_status.mjs`          | Check incident family status and fresh same-fingerprint events after a timestamp.                                       | No                                  |
| `npm run ophestivus:error-event-detail -- --incident <incident-id>`               | `frontend/scripts/ophestivus_error_event_detail.mjs`    | Print redacted latest event stack/metadata details for an incident or ticket.                                           | No                                  |
| `npm run ophestivus:compact-ticket-report`                                        | `frontend/scripts/ophestivus_ticket_report.mjs`         | Build a board-safe Review summary with local report path and room reserved for the later approval note.                 | No                                  |
| `npm run ophestivus:complete-error-ticket`                                        | `frontend/scripts/ophestivus_complete_error_ticket.mjs` | Write the full local report, validate Review evidence, resolve the incident, write the compact ticket summary, and move to `Review`. | Yes, unless `--dry-run`    |
| `npm run ophestivus:review`                                                       | `frontend/scripts/ophestivus_review.mjs`                | Read Review tickets, append approval notes, and move approved tickets to `Complete`.                                    | Yes with `--approve`, otherwise no  |
| `npm run ophestivus:move-ticket`                                                  | `frontend/scripts/ophestivus_move_ticket.mjs`           | Move one active ticket between board columns with dry-run and stale-status guards.                                      | Yes, unless `--dry-run`             |
| `npm run ophestivus:append-ticket-note`                                           | `frontend/scripts/ophestivus_append_ticket_note.mjs`    | Append a note to ticket details with length prediction and optional note compaction.                                    | Yes, unless `--dry-run`             |
| `npm run ophestivus:run-log`                                                      | `frontend/scripts/ophestivus_run_log.mjs`               | Write a local markdown SOP run report under `docs/records/artifacts/agent/ophestivus/reports/`.                         | Local file write unless `--dry-run` |

## Preferred Safety Pattern

1. Use `--dry-run` first when the helper supports it.
2. Inspect the planned mutation.
3. Run the mutating command only after validation is complete and the ticket state is current.
4. Re-check status with `ophestivus:error-status` for incident-driven work.
5. For Admin Errors closeout, let `ophestivus:complete-error-ticket` write the full local report and place the report path in the compact ticket summary.
6. Let `ophestivus:complete-error-ticket` fail before Review if the compact summary is missing the full report path, has a truncated `Report:` value, or does not leave approval-note room.
7. Use `ophestivus:run-log` directly for non-error SOP work or ad hoc reports that are not handled by the complete-error-ticket helper.

## Report Fields

Every Review-ready error ticket should include a compact board summary with:

- Resolution type: `new-code`, `verified-existing-fix`, `no-code`, `config`, or `data`.
- Repo changes.
- Tests/validation.
- Verification class: `live-route-verified`, `tests-and-data-verified`, `telemetry-filter-verified`, or `blocked-live-verification`.
- Recurrence check.
- Residual risk classification: `Accepted`, `Monitor`, or `Follow-up` for Review-ready work. Use `Human Review` only for backlog escalation.
- Residual risk text.
- Repo-relative full report path under `docs/records/artifacts/agent/ophestivus/reports/`.
- Local dev note when stale localhost chunks may be involved.

The full narrative belongs in the local report, not in the board ticket.

Create a separate Backlog ticket for `Follow-up` residual risk only when the follow-up is concrete, actionable, and not already tracked.

Use `ophestivus:error-event-detail` for runtime/UI/client incidents before making a root-cause call. It should provide enough redacted stack and metadata context to avoid ad hoc Supabase event queries in normal SOP runs.
