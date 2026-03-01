# Unified Phase 01: Guardrail and CI Accuracy Repair

Status: In Progress  
Owner: Engineering

## Objective
Eliminate stale guardrail targets and align CI policy lanes to current repository topology so checks fail only for real regressions.

## In Scope
1. Remove stale `ReferenceCanvas` file targeting in CI and size-budget guardrails.
2. Remove stale missing-file allowlist paths in naming legacy-usage checks.
3. Ensure dedicated `type_check` and `secret_scan` CI jobs exist with warn/enforce policy semantics where applicable.
4. Update CI policy documentation and phase evidence/tracker artifacts.

## Out of Scope
1. Architecture refactors unrelated to guardrails.
2. Feature work or API behavior changes.
3. Branch-protection settings changes in GitHub UI (tracked as operator follow-up evidence).

## Implementation Slices
1. Slice A: stale path correction in CI/scripts/CODEOWNERS.
2. Slice B: CI lane additions (`type_check`, `secret_scan`) and script support.
3. Slice C: docs/tracker/evidence updates and validation closeout.

## Current Slice Status
1. Slice A/B/C engineering scope is complete and validated.
2. Residual closeout item is operator-managed branch-protection mapping evidence.
3. Operator closeout checklist prepared:
   - `docs/planning/evidence/unified-buildout/phase-01/2026-03-01-phase-01-operator-branch-protection-mapping-closeout-checklist.md`

## Validation Gates
1. `node scripts/check_size_budgets.js`
2. `node scripts/check_naming_legacy_usage.js`
3. `node scripts/check_secret_exposure.js`
4. `npm -C frontend run docs:check`
5. `npm -C frontend run type-check`
6. `npm -C frontend run lint`
7. `npm -C frontend run build`

## Required Docs Updates
1. `docs/planning/ci-policy-checks.md`
2. `docs/planning/shortpulse-unified-buildout-tracker.md`
3. `docs/planning/evidence/unified-buildout/phase-01/*`
4. `docs/change_log.md`

## Exit Criteria
1. All validation gates pass.
2. No guardrail target points to non-existent files.
3. CI policy doc reflects live job IDs and scan modes.
4. Evidence note and rollback guidance are committed.

## Rollback Plan
1. Revert this phase batch commit.
2. Restore previous CI workflow/script state.
3. Keep Phase 00 baseline unchanged.
