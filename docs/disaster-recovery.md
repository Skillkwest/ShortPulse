# Disaster Recovery Runbook

Purpose: restore critical product functionality after severe production failures.

## Recovery priorities
1. Authentication and protected-route access.
2. Billing/credits integrity.
3. AI Studio generation and media persistence.
4. Admin/operator operational access.

## Failure classes
- Deployment regression: app code issue after release.
- Schema/policy regression: migration or RLS/storage policy breakage.
- Provider outage: Fal/OpenAI/Stripe partial or full outage.

## Recovery playbook
1. Declare incident and identify failure class.
2. Freeze risky changes (no unrelated deploys).
3. Roll back app deployment to last known-good revision.
4. Revert or patch schema/policies if data access is broken.
5. Validate critical paths: auth, credits, generation, media operations, admin.
6. Document root cause and remediation in `docs/change_log.md`.

## Data safety checks
- Confirm no cross-user data exposure under RLS/storage policies.
- Verify credit balances and ledger consistency after recovery.
- Confirm no duplicate Stripe grants (`stripe_event_log` idempotency).

## Follow-up
- Add permanent prevention work to `docs/planning/backlog.md`.
- Add/refresh ADRs for structural changes made during recovery.
