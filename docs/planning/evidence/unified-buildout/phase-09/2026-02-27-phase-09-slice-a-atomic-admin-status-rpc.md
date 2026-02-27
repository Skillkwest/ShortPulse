# Phase 09 Slice A Evidence: Atomic Admin Incident Status RPC

Date: 2026-02-27  
Owner: Engineering  
Phase: 09 (Admin Hardening)  
Slice: A (atomic status transitions)

## Scope Delivered
1. Added migration:
   - `sql/migrations/039_admin_error_status_atomic_update.sql`
2. Added rollback migration:
   - `sql/migrations/rollback/039_admin_error_status_atomic_update_rollback.sql`
3. Refactored admin status route to RPC-backed thin handler:
   - `frontend/pages/api/admin/errors-status.ts`
4. Reworked route tests for RPC integration behavior:
   - `frontend/tests/api/admin-errors-status.test.ts`
5. Updated migration documentation:
   - `docs/database-migrations.md`

## Implementation Notes
1. RPC `public.admin_update_app_error_status(...)` now executes incident updates and event-promotion/linking in one database transaction context.
2. RPC enforces caller role (`service_role`) and validates request shape/status in-database.
3. Route maps RPC error classes to stable HTTP responses:
   - `P0002` -> `404`
   - `22023` -> `400`
   - fallback -> `500`

## Validation Run
1. `npm -C frontend run test -- admin-errors-status`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`

## Rollback
1. Revert this slice commit only.
2. Apply rollback SQL:
   - `sql/migrations/rollback/039_admin_error_status_atomic_update_rollback.sql`
3. Re-run:
   - `npm -C frontend run test -- admin-errors-status`
   - `npm -C frontend run type-check`
   - `npm -C frontend run lint`
