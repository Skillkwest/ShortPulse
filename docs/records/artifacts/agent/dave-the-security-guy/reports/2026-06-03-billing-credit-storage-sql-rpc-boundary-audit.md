# Billing, Credit, And Storage SQL/RPC Boundary Audit

Date: 2026-06-03

Agent: Dave the Security Guy

Mode: Launch-readiness security lane, primary current runtime and canonical SQL/RPC/storage paths only.

## Scope

Audited local repo source for the user-account isolation boundary covering billing rows, credit balances/ledger/reservations, storage entitlement helpers, and the runtime SQL grant audit guardrail. This pass did not audit legacy, backup, fallback, or deprecated routes except where current primary runtime evidence required it. No hosted Supabase data, customer data, Vercel state, GitHub secrets, or production billing state was mutated.

## Ranked Finding

### 1. Runtime SQL security audit guardrail was stale after audit-script hardening

Severity: Medium as a launch-readiness guardrail issue; High for relevance to account/storage entitlement isolation proof.

Confidence: High.

Affected trust boundary: Supabase RPC execute grants for privileged runtime helpers, including storage entitlement helpers and service-role-only mutation/control-plane RPCs.

Launch impact: This test guards the SQL audit script used to catch grant drift that could expose explicit-user helper RPCs to client roles. A stale guardrail weakens confidence in the very check that protects account/storage isolation.

ROI: High. Small test-only correction, no UI/UX/product behavior change, and directly restores signal for a proven prior account-isolation risk class.

Root cause: `frontend/tests/lib/runtime-sql-security-audit-script.test.ts` still expected the old temp-table shape for `sql/check_runtime_sql_security_audit.sql`. The current script emits direct detail and summary queries from duplicated CTEs, which avoids the old temp-table dependency while preserving the same grant/security checks.

Fix: Updated only the guardrail test to assert the current canonical audit-script shape: the ordered `all_checks` detail output plus summary counters. No app behavior or SQL posture was changed.

## Confirmed Local Posture

- `sql/migrations/141_harden_storage_entitlement_helper_grants.sql` is the canonical source that revokes explicit-user storage entitlement helper RPC execution from `public`, `anon`, and `authenticated`, and grants those helpers only to `service_role`.
- `get_media_storage_quota_summary()` remains the authenticated customer-facing quota summary path and derives the user from `auth.uid()` before calling explicit-user helpers.
- Billing and credit SQL sources keep customer reads scoped by `user_id = auth.uid()` and reserve privileged mutation authority for service-role paths. User-originated ledger writes are debit-only and underflow/self-credit protections remain in the SQL contract.
- Primary frontend account/billing/credit reads inspected in this lane filter by the current authenticated user id before reading private billing, subscription, ledger, balance, or storage add-on rows.

## Hosted Proof Limit

I did not rerun hosted Supabase proof in this pass because no pinned database URL or approved hosted target credential was available in the local environment. The Nuclo handoff retained in this workspace reports production proof after remediation, including `sql/check_runtime_sql_security_audit.sql` passing 346/346 checks, `sql/audit_billing_credit_rls.sql` clean, and `sql/check_media_storage_scope_drift.sql` clean. Treat that as retained handoff evidence, not as a fresh live run from this pass.

## Validation

Passed:

- `npm -C frontend test -- --run tests/sql/storage-entitlement-helper-grants.test.ts tests/lib/runtime-sql-security-audit-script.test.ts`

Result: 2 test files passed, 3 tests passed.

## Stop Condition

Reached for this lane. The highest-ROI confirmed issue was a stale security guardrail test around the current runtime SQL audit script, and it was fixed without changing product behavior. Further work from here would require either a fresh hosted Supabase proof target or a newly proven primary-route trust-boundary issue; otherwise it becomes adjacency, hygiene, or lower-ROI tinkering.

## Next Highest-ROI Step

If approved and credentials/target are available, rerun the hosted Supabase SQL security proof against the intended production project and compare it to the Nuclo handoff results. Without that hosted proof target, the next Dave lane should move to another primary current trust boundary rather than continue editing around this one.
