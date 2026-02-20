# SQL Evidence

Store STG-02 SQL hardening execution evidence here using ISO-dated files.

Recommended naming:
- `YYYY-MM-DD-stg-02-staging-validation.md`
- `YYYY-MM-DD-stg-02-production-validation.md`

Required minimum evidence:
1. Migration apply command and target environment.
2. `sql_lint` command + outcome.
3. `conversation_state_hardening_gate.sh` output summary.
4. Workflow run URL + artifact name for `conversation_state_hardening_gate`.
5. Rollback readiness confirmation (rollback script path + operator owner).
