# STG-02 Staging Validation Attempt (2026-02-20)

Date: 2026-02-20  
Environment: staging  
Operator: @sleepyseamonster  
Reviewer: Pending

## Scope
- Trigger `conversation_state_hardening_gate` in staging (`mode=warn`).
- Capture run URL/artifact for STG-02 evidence.

## Workflow dispatch attempt
- Command:
  - `gh workflow run .github/workflows/conversation-state-hardening-gate.yml --ref fal-modular-makeover -f target_environment=staging -f mode=warn`
- Result:
  - `fail`
- Error:
  - `HTTP 404: workflow .github/workflows/conversation-state-hardening-gate.yml not found on the default branch`

## Root cause
- GitHub Actions workflow-dispatch requires the workflow to exist on the repository default branch.
- Workflow currently exists on branch `fal-modular-makeover` (PR `#27`) and is not yet on `main`.

## Next action
1. Merge PR `#27` to `main`.
2. Re-run:
   - `gh workflow run conversation-state-hardening-gate.yml --ref main -f target_environment=staging -f mode=warn`
3. Record run URL and artifact:
   - `conversation-state-hardening-gate-<run_id>`
4. If green, update STG-02 tracker status with staging evidence link.
