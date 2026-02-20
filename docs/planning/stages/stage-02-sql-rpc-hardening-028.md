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

## Verification
- `test -f sql/migrations/028_harden_ai_agent_conversation_state_security.sql`
- `test -f sql/migrations/rollback/028_harden_ai_agent_conversation_state_security_rollback.sql`
- `supabase db lint --local --schema public --fail-on warning`

## Owners and validators
- Owner: Engineering
- Validator: Security + DB operations

## KPI
- SQL security/correctness validation matrix passes.

## Evidence
- `sql/migrations/028_harden_ai_agent_conversation_state_security.sql`
- `sql/migrations/rollback/028_harden_ai_agent_conversation_state_security_rollback.sql`
- `docs/planning/evidence/sql/`
