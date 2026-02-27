# Phase 10 Slice C Evidence: Runtime SQL Security Audit Integration

Date: 2026-02-27  
Owner: Engineering  
Phase: 10 (Security Residual Controls)  
Slice: C (runtime SQL security audit integration + evidence checkpoint)

## Scope Delivered
1. Added runtime SQL security audit script:
   - `sql/check_runtime_sql_security_audit.sql`
   - Verifies critical runtime RPCs for:
     - function existence
     - `SECURITY DEFINER` posture
     - execute grants (`service_role` allowed, `public`/`authenticated`/`anon` denied)
2. Hardened public-grant verification to inspect function ACL expansion directly (covers default ACL behavior safely).
3. Updated SQL/security operator docs:
   - `docs/sops/sop_sql_migration_operations.md`
   - `docs/security-checklist.md`
   - `docs/database-migrations.md`
4. Added telemetry event-only regression guard:
   - `frontend/tests/lib/app-error-logs.telemetry-event-only.integration.test.ts`
5. Added runtime SQL audit script drift guard:
   - `frontend/tests/lib/runtime-sql-security-audit-script.test.ts`
6. Completed admin error-events route decomposition checkpoint:
   - `frontend/pages/api/admin/error-events.ts`
   - `frontend/lib/server/api/adminErrorEvents/*`

## Validation Run
1. `npm -C frontend run test -- tests/api/admin-error-events.test.ts tests/api/admin-errors-status-bulk.test.ts tests/lib/error-telemetry-policy.test.ts tests/lib/app-error-logs.telemetry-event-only.integration.test.ts tests/lib/runtime-sql-security-audit-script.test.ts`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`

## Staging Checkpoint (Completed)
1. Executed `sql/check_runtime_sql_security_audit.sql` in staging Supabase SQL editor.
2. Initial run showed execute-grant drift on a subset of runtime RPCs (`anon`/`authenticated` execute leakage).
3. Applied remediation migration:
   - `sql/migrations/040_harden_runtime_rpc_execute_grants.sql`
4. Re-ran `sql/check_runtime_sql_security_audit.sql` and captured clean summary:

```json
[
  {
    "total_checks": 60,
    "passing_checks": 60,
    "failing_checks": 0
  }
]
```

5. Phase 10 staging SQL security gate is satisfied (`failing_checks = 0`).

## Rollback
1. Revert this slice commit only.
2. Re-run:
   - `npm -C frontend run lint`
   - `npm -C frontend run type-check`
   - `npm -C frontend run docs:check`
