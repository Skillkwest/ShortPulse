# SOP: Admin Ophestivus Board Operations

Purpose: operate the shared Ophestivus board safely as the durable task source for admins and the future Ophestivus steward.

## Scope

- `/admin/kanban` shared task-board workflow.
- Admin-only board APIs under `/api/admin/kanban/*`.
- Board persistence in `admin_kanban_items` and `admin_kanban_activity`.
- Mirrored planning backlog cards sourced from `docs/planning/backlog.md`.
- Current phase: human/admin task tracking only. Autonomous Ophestivus execution is not enabled by this SOP.

## Source Of Truth

- Page: `frontend/pages/admin/kanban.tsx`
- UI component: `frontend/features/admin/components/AdminKanbanBoardSection.tsx`
- Client status model: `frontend/features/admin/data/adminKanbanBoard.ts`
- Server persistence helper: `frontend/lib/server/api/adminKanbanBoard.ts`
- API routes: `frontend/pages/api/admin/kanban/activity.ts`, `frontend/pages/api/admin/kanban/items/*`
- Planning backlog source: `docs/planning/backlog.md`
- Planning backlog parser/sync: `scripts/lib/planning_backlog_parser.mjs`, `scripts/admin_kanban_backlog_sync.mjs`
- Persistence migrations: `sql/migrations/110_add_admin_kanban_foundation.sql`, `sql/migrations/111_harden_admin_kanban_audit_integrity.sql`, `sql/migrations/113_add_admin_kanban_review_status.sql`, `sql/migrations/222_add_admin_kanban_backlog_source_sync.sql`
- Architecture decision: `docs/adr/0072-admin-kanban-and-ophestivus-foundation.md`
- Error-to-review workflow: `docs/records/artifacts/agent/ophestivus/sop-docs/sop_admin_error_to_ophestivus_resolution.md`
- Review-to-complete approval workflow: `docs/records/artifacts/agent/ophestivus/sop-docs/sop_admin_ophestivus_review_to_complete.md`

## Prerequisites

- Migrations `110`, `111`, `113`, and `222` applied in the target environment.
- Admin access granted through `app_metadata` role/roles or `SHORTPULSE_ADMIN_EMAILS`.
- Service-role key configured server-side; never expose it to the browser.

## Workflow

1. Open `/admin/kanban`.
2. Keep canonical product backlog items in `docs/planning/backlog.md` with their hidden `kanban:spb-pN-###` source ids.
3. Sync the backlog document into the board with `cd frontend && npm run admin-kanban:sync-backlog -- --apply` after the target environment has migration `222` applied. Use the default dry run first when the target or source diff is uncertain.
4. Add non-document operational work in `Board Backlog` with a concise title and useful notes.
5. Move tasks through `Backlog -> In progress -> Review -> Complete -> Published`. `Backlog Document` and `Board Backlog` are visual slices of the same `backlog` workflow status; moving a document card forward should preserve the document as source of truth.
6. Archive stale or obsolete tasks from the board instead of deleting records.
7. Use the board header `Action log` control to review recent Ophestivus board activity across tasks.
8. Use the item activity route for future detail/timeline views when item-specific audit context is needed.
9. Use `docs/records/artifacts/agent/ophestivus/sop-docs/sop_admin_ophestivus_review_to_complete.md` before promoting `Review` tickets to `Complete`.

## Ophestivus Helper Commands

- `cd frontend && npm run ophestivus:intake`: pick the first non-human-review backlog ticket or create a backlog ticket from the next Admin Errors incident. Parked `[HUMAN REVIEW]` backlog tickets do not block new bounded intake.
- `cd frontend && npm run admin-kanban:sync-backlog`: dry-run mirror `docs/planning/backlog.md` into the board. Add `-- --apply` only after reviewing the target and confirming migration `222` is available.
- `cd frontend && npm run ophestivus:error-status -- --incident <incident-id> --after <timestamp>`: verify same-fingerprint incident status and fresh recurrence after a fix timestamp.
- `cd frontend && npm run ophestivus:compact-ticket-report`: create a board-safe Review report with approval-note space reserved.
- `cd frontend && npm run ophestivus:complete-error-ticket`: resolve a verified Admin Errors incident, write the compact report, and move the ticket from `In progress` to `Review`.
- `cd frontend && npm run ophestivus:review`: inspect `Review` tickets, append approval notes, and move approved work to `Complete`.
- `cd frontend && npm run ophestivus:move-ticket`: move one active ticket between board columns with dry-run and stale-status guards.
- `cd frontend && npm run ophestivus:append-ticket-note`: append a length-checked note to ticket details.
- `cd frontend && npm run ophestivus:run-log`: write a local markdown SOP run report under `docs/records/artifacts/agent/ophestivus/reports/`.

## Guardrails

- Do not use the board as an authorization source; it tracks work only.
- Do not store secrets, customer private data, or service-role values in task titles or notes.
- Tickets that Ophestivus cannot handle reliably as one working agent must stay in or return to `Backlog`, use the title prefix `[HUMAN REVIEW]`, and include the Human Review / Escalation Ticket template from `docs/records/artifacts/agent/ophestivus/sop-docs/sop_admin_error_to_ophestivus_resolution.md`. If a future board note surface supports styling, render the `*** HUMAN REVIEW REQUIRED ***` banner in the blue theme and bold while preserving the text.
- Human-review backlog tickets are parked handoffs for a human owner. They stay visible on the board, but Ophestivus intake should skip them when selecting the next runnable bounded error.
- `planning_backlog` cards are backlog-document mirrors. Ophestivus Admin Errors intake must skip them and must not treat them as runnable incident tickets.
- Do not edit a mirrored backlog-document card to change the canonical backlog item. Update `docs/planning/backlog.md`, preserve or add the hidden kanban id, then rerun the sync.
- Do not create specialized escalation templates until repeated board patterns justify them; keep provider, SQL/migration, product-decision, multi-agent, release-gate, and security/privacy cases inside the general human-review template for now.
- Keep `Published` human-controlled until a later approved Ophestivus automation phase changes the contract.
- Keep all reads/writes behind `requireAdminUser` and service-role server helpers/RPCs.
- Keep normal removal as archive-only so `admin_kanban_activity` stays useful for audit and future agent coordination.
- Keep item mutations and activity logging inside the transactional admin kanban RPCs; do not reintroduce split item-write/activity-write flows.

## Validation

- UI/API changes: run the kanban component, page, and API route tests.
- Schema changes: run SQL lint against a hosted target when credentials are available, then run `sql/check_runtime_sql_security_audit.sql` in staging before release signoff.
- Docs changes: run `npm -C frontend run docs:check`.
