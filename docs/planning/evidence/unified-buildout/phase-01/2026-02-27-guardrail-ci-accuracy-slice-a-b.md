# Phase 01 Evidence: Guardrail + CI Accuracy (Slice A/B)

Date: 2026-02-27  
Owner: Engineering  
Status: In Progress

## Scope Delivered
1. Replaced stale `ReferenceCanvas` path targeting with canonical `ReferenceGrid` in active guardrails:
   1. `.github/workflows/ci.yml` adaptive-media path filter
   2. `scripts/check_size_budgets.js` reference-grid budget target
   3. `.github/CODEOWNERS` adaptive-media critical-path ownership
2. Removed stale missing-file allowlist entries from `scripts/check_naming_legacy_usage.js`.
3. Added CI policy lanes:
   1. `type_check` (hard-fail lane)
   2. `secret_scan` (`warn|enforce` via `SECRET_SCAN_MODE`)
4. Added `scripts/check_secret_exposure.js` for high-confidence secret literals and non-placeholder sensitive env assignments.

## Validation Commands (local)
1. `node scripts/check_size_budgets.js`
2. `node scripts/check_naming_legacy_usage.js`
3. `node scripts/check_secret_exposure.js`
4. `npm -C frontend run docs:check`
5. `npm -C frontend run type-check`
6. `npm -C frontend run lint`
7. `npm -C frontend run build`

## Validation Result
All commands passed.

Operational note:
- `check_size_budgets` reports `useAiStudioState.ts` above the reference-grid target budget in warn mode; the gate remains non-blocking until the phase-7 modularization track.

## Rollback Note
Revert the Phase 01 batch commit to restore previous CI/script behavior:
1. `.github/workflows/ci.yml`
2. `.github/CODEOWNERS`
3. `scripts/check_size_budgets.js`
4. `scripts/check_naming_legacy_usage.js`
5. `scripts/check_secret_exposure.js`
6. `docs/planning/ci-policy-checks.md`
