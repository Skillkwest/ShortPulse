# D-Bug Handoff Template

Purpose: provide one reusable handoff format for agents escalating debugging work to D-Bug.

## Template

### Title

`D-Bug Handoff: <short issue label>`

### Source

- Source agent:
- Source task:
- Date:

### Failing surface

- Route, component, script, command, or subsystem:
- Environment:
- User-visible symptom:
- Exact error text or signature:

### Why this is a D-Bug lane

- Why the source agent stopped:
- Why this should be treated as debugging instead of feature work:

### Current evidence

- Reproduction steps:
- Expected behavior:
- Actual behavior:
- Logs, stack traces, screenshots, or file references:
- Frequency:

### Scope control

- Owned write surface:
- Avoid surface:
- In scope:
- Out of scope:

### Attempts already made

1. 
2. 
3. 

### Current hypotheses

1. 
2. 
3. 

### Required context

Read first:

- relevant docs
- SOPs
- ADRs

Inspect first:

- relevant files
- tests
- scripts

### Questions for D-Bug

1. What is the smallest credible failing surface?
2. Can the issue be reproduced or narrowed with current evidence?
3. What is the next safest debug step?

### Expected output

- reproduction packet, or
- debug plan, or
- bounded patch with validation, or
- blocked-with-evidence escalation

### Recommended downstream owner after D-Bug

- Stay with D-Bug, or
- Gear Ball for commit/push/branch-hygiene execution, or
- Nuclo for hosted environment/Supabase/Vercel/SQL remediation

### Suggested validation

- targeted tests
- local repro command
- lint/build only when relevant

### Done state

- D-Bug can explain the failure, the next fix path, and the validation story in a way another engineer can execute without guesswork.

### Closeout artifact

- Preferred retained path:
  - `docs/records/artifacts/agent/d-bug/reports/`
- Suggested filename:
  - `YYYY-MM-DD-<short-issue-label>.md`
