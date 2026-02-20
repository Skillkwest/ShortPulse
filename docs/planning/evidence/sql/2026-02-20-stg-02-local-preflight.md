# STG-02 Local Preflight Evidence (2026-02-20)

Date: 2026-02-20  
Environment: local preflight  
Operator: @sleepyseamonster

## Scope
- Verify migration/gate artifacts exist and are executable.
- Verify docs parity checks remain green after SQL hardening gate additions.
- Capture local execution blockers before staging run.

## Commands and results
| Command | Result |
| --- | --- |
| `test -f sql/migrations/028_harden_ai_agent_conversation_state_security.sql && test -f sql/migrations/rollback/028_harden_ai_agent_conversation_state_security_rollback.sql && test -f sql/check_conversation_state_hardening_028.sql && test -x scripts/conversation_state_hardening_gate.sh` | pass |
| `npm -C frontend run docs:check` | pass |
| `./scripts/conversation_state_hardening_gate.sh` | fail (`SUPABASE_DB_URL` not set) |

## Blockers
- Staging/production `SUPABASE_DB_URL` is not available in local shell env.
- Direct Postgres connectivity to Supabase host/port needs to be validated from the execution environment used for the gate.

## Next action
1. Run gate in staging environment with `psql` available:
   - `SUPABASE_DB_URL=... ./scripts/conversation_state_hardening_gate.sh`
2. Record full output in:
   - `docs/planning/evidence/sql/<date>-stg-02-staging-validation.md`
3. Repeat for production after staging signoff.
