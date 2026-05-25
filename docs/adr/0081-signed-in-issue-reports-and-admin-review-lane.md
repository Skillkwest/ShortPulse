# ADR 0081: Signed-In Issue Reports And Admin Review Lane

## Status

Accepted

## Context

ShortPulse needs a lightweight way for signed-in users to report broken flows, confusing behavior, and account issues without opening direct table access or routing those submissions into Ophestivus before that lane is approved.

The review surface also needs to live inside the existing admin workspace so operators can inspect raw user messages, capture notes, and move reports through a small manual lifecycle.

## Decision

- Store issue reports in a dedicated shared Supabase table: `user_issue_reports`.
- Require authenticated user submission through `POST /api/report-issue`; the server snapshots `user_id`, `submitter_email`, request path, and user agent.
- Keep `user_issue_reports` RLS-enabled with no direct browser policies; all reads and writes flow through trusted server routes using `getSupabaseAdmin`.
- Expose operator review through `/admin/reports` plus `/api/admin/reports*`, guarded by `requireAdminUser`.
- Use a small manual status model: `new`, `reviewing`, and `resolved`.
- Keep Ophestivus out of this runtime lane for now. Future Ophestivus work may read report rows and create derivative artifacts, but Supabase remains the source of truth.

## Consequences

- Signed-in users get a simple authenticated issue-report path without needing email re-entry.
- Admins get a dedicated review queue that is independent from the support-page user lookup surface.
- Report history can persist independently of current user account presence because `user_id` is nullable and uses `on delete set null`, while `submitter_email` remains a durable snapshot.
- Future automation or kanban linkage can be added later without rebuilding the intake contract.

## Guardrails

- Do not expose `user_issue_reports` directly to browser Supabase queries.
- Do not auto-create Ophestivus tickets or agent-owned workflows from user reports in this phase.
- Do not hard-delete reports as part of normal operator review; use status and notes instead.
- Keep report payloads bounded and free of service-role/browser-secret leakage.
