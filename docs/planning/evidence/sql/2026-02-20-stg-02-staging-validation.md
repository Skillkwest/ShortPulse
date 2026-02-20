# STG-02 Staging Validation Evidence (2026-02-20)

Date: 2026-02-20  
Environment: staging  
Operator: @sleepyseamonster  
Reviewer: Pending

## Scope
- Trigger `conversation_state_hardening_gate` in staging (`mode=warn`).
- Capture run URL/artifact for STG-02 evidence.
- Record blockers and corrective action.

## Attempt A: Dispatch before workflow was on default branch
- Command:
  - `gh workflow run .github/workflows/conversation-state-hardening-gate.yml --ref fal-modular-makeover -f target_environment=staging -f mode=warn`
- Result:
  - `fail`
- Error:
  - `HTTP 404: workflow .github/workflows/conversation-state-hardening-gate.yml not found on the default branch`

## Root cause
- GitHub Actions workflow-dispatch requires the workflow to exist on the repository default branch.
- Workflow currently exists on branch `fal-modular-makeover` (PR `#27`) and is not yet on `main`.

## Attempt B: Dispatch after bootstrap merge to `main`
- Bootstrap PR merged:
  - `https://github.com/sleepyseamonster/ShortPulse/pull/28`
- Command:
  - `gh workflow run conversation-state-hardening-gate.yml --ref main -f target_environment=staging -f mode=warn`
- Run URL:
  - `https://github.com/sleepyseamonster/ShortPulse/actions/runs/22241985874`
- Result:
  - Workflow `success` (warn mode), gate script `failed` and emitted warning.
- Artifact:
  - `conversation-state-hardening-gate-22241985874`
  - `https://github.com/sleepyseamonster/ShortPulse/actions/runs/22241985874/artifacts/5596546277`

## Attempt B failure detail
- `psql: error: connection to server on socket "@db.jwmcytzyhcvacjwqtynn.supabase.co/.s.PGSQL.5432" failed: Connection refused`

## Corrective action
1. Update environment secret `SUPABASE_DB_URL` (staging) to a full Postgres URI, not a bare host/string.
2. Recommended format (redacted):
   - `postgresql://<user>:<password>@<host>:<port>/<db>?sslmode=require`
3. Re-run workflow:
   - `gh workflow run conversation-state-hardening-gate.yml --ref main -f target_environment=staging -f mode=warn`
4. After a clean warn-mode run, repeat with `mode=enforce`.
