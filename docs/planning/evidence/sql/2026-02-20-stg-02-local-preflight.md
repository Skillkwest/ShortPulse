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
| `./scripts/conversation_state_hardening_gate.sh` | fail (`psql` missing on local host) |

## Blockers
- Local environment does not have `psql` installed, so direct gate execution against `SUPABASE_DB_URL` is blocked locally.

## Next action
1. Run gate in staging environment with `psql` available:
   - `SUPABASE_DB_URL=... ./scripts/conversation_state_hardening_gate.sh`
2. Record full output in:
   - `docs/planning/evidence/sql/<date>-stg-02-staging-validation.md`
3. Repeat for production after staging signoff.
