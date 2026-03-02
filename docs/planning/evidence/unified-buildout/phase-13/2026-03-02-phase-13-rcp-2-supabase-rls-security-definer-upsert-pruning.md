# Phase 13 RCP-2: Supabase RLS + SECURITY DEFINER + Upsert/Pruning Semantics

Date: 2026-03-02  
Owner: Engineering  
Status: Complete

## Trigger
Required before Wave E session SQL/API finalization (`044_*` reserved slot).

## Primary Sources Reviewed
1. Supabase RLS guide: https://supabase.com/docs/guides/database/postgres/row-level-security
2. Supabase function-management guide (search path/security context): https://supabase.com/docs/guides/database/functions
3. Supabase troubleshooting on function execute grants: https://supabase.com/docs/guides/troubleshooting/how-can-i-revoke-execution-of-a-postgresql-function-2GYb0A
4. Supabase Cron guide: https://supabase.com/docs/guides/cron
5. PostgreSQL `INSERT ... ON CONFLICT` semantics: https://www.postgresql.org/docs/current/sql-insert.html
6. PostgreSQL `CREATE FUNCTION` (`SECURITY DEFINER` safety guidance): https://www.postgresql.org/docs/current/sql-createfunction.html

## Repo-Local Baseline Used
1. Security-definer + grant posture pattern:
   - `sql/migrations/028_harden_ai_agent_conversation_state_security.sql`
   - `sql/migrations/040_harden_runtime_rpc_execute_grants.sql`
   - `sql/migrations/042_harden_queue_recovery_rpc_execute_grants.sql`
2. Migration numbering reservation:
   - `docs/planning/migration-number-reservation-map.md` (`044_*` locked for session persistence)
3. Operational SQL guardrails:
   - `docs/sops/sop_sql_migration_operations.md`
   - `docs/security-checklist.md`

## Decisions Locked For Wave E SQL/API
1. Session table uses strict ownership (`user_id`) and RLS policy `user_id = auth.uid()` for direct relational safety.
2. Session save/list/get server paths execute via service-role backend path and call `SECURITY DEFINER` RPCs.
3. Every `SECURITY DEFINER` session RPC must:
   - set `search_path = public, pg_temp`,
   - validate `auth.role() = 'service_role'`,
   - clamp and validate user-provided limits/cursors/cap/ttl inputs.
4. Execute grants for session RPCs are `service_role` only:
   - `revoke all` from `public`, `anon`, `authenticated`,
   - `grant execute ... to service_role`.
5. Upsert path uses atomic `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` with monotonic `save_seq` increment to support deterministic last-write-wins.
6. Deterministic pruning is executed in the same RPC transaction as save:
   - advisory transaction lock scoped by `user_id`,
   - delete expired rows first,
   - enforce per-user cap while preserving the just-written target `sid`.
7. Expired-session cleanup runs as a separate bounded `SECURITY DEFINER` prune RPC (service-role-only) and is scheduled via `pg_cron`.

## Rejected Alternatives
1. Client-direct table writes/reads as primary save path.
   - Rejected: weakens server-side validation and drift-control; harder to enforce deterministic prune/cap policy.
2. `SECURITY DEFINER` without explicit `search_path`.
   - Rejected: elevated risk of object-resolution hijacking.
3. Public/authenticated execute access on session RPCs.
   - Rejected: violates existing runtime hardening posture in migrations `040`/`042`.
4. Non-atomic prune strategy (separate delayed cleanup only).
   - Rejected: allows cap drift and non-deterministic retention under concurrent writes.

## Implementation Checklist Impacted
1. Migration `044_*` must include:
   - `ai_studio_sessions` table (+ indexes),
   - session save/list/get/prune RPCs,
   - RLS policies,
   - execute-grant hardening statements.
2. Migration `044_*` must include paired rollback script where feasible.
3. SQL audit script must be expanded to include session RPC execute/security checks.
4. API handlers (`/api/ai/sessions/save`, `/api/ai/sessions/:sid`, `/api/ai/sessions`) must enforce authenticated user context and never expose service-role credentials client-side.

## Validation Gates For Upcoming Wave E SQL/API Slice
1. RLS isolation test (two-user cross-access denial).
2. Session RPC execute-audit check (`failing_checks = 0`).
3. Concurrency test proving deterministic cap/prune behavior under repeated upserts.
4. API auth tests (`401` unauthenticated, no cross-user sid retrieval).
