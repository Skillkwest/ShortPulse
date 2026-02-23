# Phase 7 Release-Window Checkpoint Template

## Metadata
- Date:
- Release cycle: `R1` | `R2`
- Environment: `staging` | `production`
- Owner:

## Release Context
- Deployed commit SHA:
- Deployment URL/build ID:
- Release notes/change set reference:

## Naming Stability Assertions
1. Compatibility aliases still present (no contraction yet): pass/fail
2. No naming regressions reported by QA/support: pass/fail
3. Active docs remain canonical (`docs:check`): pass/fail
4. Runtime legacy usage guard passes (`check:naming-legacy-usage`): pass/fail

## Required Validation Evidence
- `npm -C frontend run validate`:
- `npm -C frontend run docs:check`:
- `npm -C frontend run test:adaptive-v2-gate`:
- `npm -C frontend run build`:
- `npm -C frontend run check:architecture-boundary`:
- `npm -C frontend run check:size-budget`:
- `npm -C frontend run perf:ai-studio:release-check` (optional if Playwright creds available):

## Regression Audit
- UI/UX regressions observed:
- Runtime/import regressions observed:
- Naming/docs regressions observed:
- Asset-path regressions observed:

## Decision
- Cycle outcome: `pass` | `blocked`
- If blocked, rollback/refinement action:
- Next allowed action:
  - If `R1`: continue to `R2` stability window.
  - If `R2`: eligible to request explicit Stop-Point 7 contraction approval.
