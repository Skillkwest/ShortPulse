# STG-02 Validation Evidence Template

Date: 2026-02-20  
Environment: `<staging|production>`  
Operator: `<name>`  
Reviewer: `<name>`

## Migration apply
- Command(s):
  - `supabase db push` (or equivalent migration runner)
- Result:
  - `<pass|fail>`
- Notes:
  - `<details>`

## SQL lint
- Command:
  - `supabase db lint --local --schema public --fail-on warning`
- Result:
  - `<pass|fail>`
- Notes:
  - `<details>`

## 028 hardening gate
- Workflow:
  - `Conversation State Hardening Gate` (`conversation_state_hardening_gate`)
- Inputs:
  - `target_environment=<staging|production>`
  - `mode=<warn|enforce>`
- Secret source:
  - GitHub Environment secret `SUPABASE_DB_URL`
- Result:
  - `<pass|fail>`
- Run URL:
  - `<https://github.com/.../actions/runs/...>`
- Artifact:
  - `conversation-state-hardening-gate-<run_id>`
- Key checks:
  - grant posture (`service_role` allowed, `authenticated/public` denied)
  - `SECURITY DEFINER` + `search_path` hygiene
  - TTL/cap clamps and deterministic prune checks
  - cleanup function behavior

## Rollback readiness
- Rollback script:
  - `sql/migrations/rollback/028_harden_ai_agent_conversation_state_security_rollback.sql`
- Rollback owner:
  - `<name>`
- Trigger criteria reviewed:
  - `<yes|no>`

## Signoff
- Engineering:
  - `<name/date>`
- Security/DB Ops:
  - `<name/date>`
