# ADR 0072: Admin Kanban And Kamaji Foundation

## Status
Accepted

## Context
ShortPulse needs a dedicated admin kanban board for operational work tracking across `Backlog`, `In progress`, `Complete`, and `Published`. The board is also the planned durable coordination surface for a future admin identity agent named Kamaji.

The first implementation must support shared admin visibility without granting the browser direct access to control-plane tables or implying autonomous code execution before the safety contract exists.

## Decision
- Store board tasks in shared Supabase tables: `admin_kanban_items` and `admin_kanban_activity`.
- Keep RLS enabled and expose no direct browser table policies.
- Route all board reads/writes through `/api/admin/kanban/*` handlers that call `requireAdminUser` and use `getSupabaseAdmin`.
- Use soft archive semantics for normal task removal so the board retains audit history.
- Treat Kamaji as a future steward/orchestrator layered on this board, not as an autonomous repo-editing runtime in this phase.

## Consequences
- Admins get a shared board instead of browser-local task state.
- Future Kamaji work can build on durable task ids, statuses, and activity history.
- Autonomous scheduling, memory, claims, locks, repo handoff packets, and implementation execution remain explicit later phases.
- The board cannot be used as an authorization source or hidden memory authority.

## Guardrails
- `Published` remains human-controlled by default.
- Task content must not include secrets or private customer data.
- Kamaji memory, claims, scheduling, and execution tables require separate migrations and docs before activation.
- Any future internal scheduler must follow the existing Supabase Cron + Vault pattern, not browser-local automation.
