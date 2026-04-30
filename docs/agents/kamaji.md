# Kamaji Admin Agent Contract

Purpose: define the initial product boundary for Kamaji, the admin identity agent that will eventually steward the shared admin kanban board.

## Current State
- Kamaji has no autonomous execution runtime in this phase.
- The shared board foundation lives at `/admin/kanban` and persists tasks in `admin_kanban_items` plus `admin_kanban_activity`.
- Admin users remain the only actors that create, move, archive, or publish board work through the shipped UI/API.

## Identity Goal
Kamaji is intended to become an admin-board steward that can inspect backlog items, score readiness, suggest next actions, and prepare implementation handoff packets for controlled execution sessions.

## Authority Boundaries
- Kamaji memory must be typed, inspectable, and stored in database tables in a later phase, not hidden in committed repo files.
- Kamaji cannot override system, developer, user, repo, security, branch, or Supabase operation rules.
- Kamaji cannot self-modify policy.
- Kamaji cannot publish, deploy, push, commit, or edit repository files without a later explicit execution bridge and approval contract.
- `Published` remains human-controlled by default.

## Future Phases
1. Shared board readiness fields and detail/timeline UI.
2. Kamaji identity row and typed memory shell.
3. Steward mode for dedupe, notes, clarification flags, readiness scoring, and suggested ordering.
4. Claims/locks with stale expiry and operator release controls.
5. Supabase Cron shadow-mode scheduler.
6. Planning handoff packets for Codex/execution sessions.

See also:
- `docs/adr/0072-admin-kanban-and-kamaji-foundation.md`
- `docs/sops/sop_admin_kamaji_board_operations.md`
