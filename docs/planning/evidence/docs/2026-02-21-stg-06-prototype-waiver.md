# STG-06 Prototype-Mode Enforcement Waiver (2026-02-21)

Date: 2026-02-21  
Stage: STG-06  
Owner: @sleepyseamonster

## Decision

STG-06 enforcement completion is waived for MVP prototype mode.

## Why

- Repository plan tier does not allow enforceable rulesets for this private repository.
- Team is actively iterating on MVP features and must not block build/commit velocity.

## Scope of waiver

- Allowed: continue building, committing, and shipping prototype features.
- Required: keep governance checks runnable in warn/evaluate mode and retain evidence updates.
- Not allowed: treat STG-06 as production-complete.

## Production readiness requirement

Before production readiness signoff:
1. Branch/ruleset enforcement must be enforceable in GitHub settings.
2. STG-06 two-green-cycle criterion must be satisfied and documented.
3. STG-06 status must be promoted from `In Progress` to `Completed`.

## Evidence links

- `docs/planning/evidence/docs/2026-02-20-branch-protection-required-check-mapping.md`
- `docs/planning/evidence/docs/2026-02-21-stg-06-cycle-status.md`

