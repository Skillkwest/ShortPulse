# STG-02 SQL/RPC Hardening (028)

## Summary
Harden conversation-state storage and RPC behavior with deterministic retention and least-privilege execution.

## Checklist
- [x] Add forward migration `028_harden_ai_agent_conversation_state_security.sql`.
- [x] Add rollback migration pair for `028`.
- [x] Enforce TTL clamp (`1 day..90 days`, default `30 days`).
- [x] Enforce cap clamp (`1..200`, default `200`).
- [x] Enforce `conversation_id` max length (`191`).
- [x] Add deterministic pruning tie-breaker and keep-current-row guard.
- [x] Add per-user advisory lock for upsert/prune cycle.
- [x] Restrict execute grants to required runtime role.
- [x] Add stale-row cleanup function and schedule guidance.
- [x] Add GitHub Actions workflow for environment-gated hardening gate execution.
- [x] Run staging validation gate and archive evidence output.
- [x] Remediate staging-discovered runtime ambiguities via forward migrations (`029`, `030`).
- [x] Complete production rollout + rollback readiness check.

## Verification
- `test -f sql/migrations/028_harden_ai_agent_conversation_state_security.sql`
- `test -f sql/migrations/rollback/028_harden_ai_agent_conversation_state_security_rollback.sql`
- `test -f sql/check_conversation_state_hardening_028.sql`
- `test -x scripts/conversation_state_hardening_gate.sh`
- `SUPABASE_DB_URL=... ./scripts/conversation_state_hardening_gate.sh`
- GitHub Actions: run `Conversation State Hardening Gate` with `target_environment=staging` and `target_environment=production`; attach run URL/artifact in SQL evidence.
- `supabase db lint --db-url "$SUPABASE_DB_URL" --schema public --fail-on warning`
- Alternative when an explicit linked profile is already governed for the target environment: `supabase db lint --linked --schema public --fail-on warning`

## Owners and validators
- Owner: Engineering
- Validator: Security + DB operations

## KPI
- SQL security/correctness validation matrix passes.

## Evidence
- `sql/migrations/028_harden_ai_agent_conversation_state_security.sql`
- `sql/migrations/rollback/028_harden_ai_agent_conversation_state_security_rollback.sql`
- `sql/migrations/029_fix_conversation_state_upsert_ambiguity.sql`
- `sql/migrations/rollback/029_fix_conversation_state_upsert_ambiguity_rollback.sql`
- `sql/migrations/030_fix_conversation_state_upsert_conflict_target.sql`
- `sql/migrations/rollback/030_fix_conversation_state_upsert_conflict_target_rollback.sql`
- `sql/check_conversation_state_hardening_028.sql`
- `scripts/conversation_state_hardening_gate.sh`
- `.github/workflows/conversation-state-hardening-gate.yml`
- `.github/workflows/apply-conversation-state-migration-028.yml`
- `docs/records/evidence/sql/`
- `docs/records/evidence/sql/2026-02-20-stg-02-local-preflight.md`
- `docs/records/evidence/sql/2026-02-20-stg-02-staging-validation.md`
- `docs/records/evidence/sql/2026-02-20-stg-02-production-validation.md`
