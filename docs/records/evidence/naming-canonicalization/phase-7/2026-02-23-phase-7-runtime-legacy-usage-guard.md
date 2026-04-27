# Naming Canonicalization Phase 7 Runtime Legacy Usage Guard

## Metadata
- Date: 2026-02-23
- Phase: 7 (Alias sunset contract entry planning)
- Slice: Runtime legacy alias usage guard
- Owner: Frontend + Docs Governance

## Scope
1. Added runtime legacy naming usage guard:
- `scripts/check_naming_legacy_usage.js`
2. Added `check:naming-legacy-usage` npm script.
3. Integrated runtime alias-usage guard into `npm -C frontend run validate`.
4. Updated Phase 7 readiness document to mark gate `G1` as pass with guardrail enforcement.

## Changed Files
- `scripts/check_naming_legacy_usage.js`
- `frontend/package.json`
- `docs/planning/naming-phase-7-entry-readiness.md`
- `docs/planning/naming-canonical-map.md`
- `docs/planning/naming-canonicalization-program.md`
- `docs/planning/naming-canonicalization-tracker.md`
- `docs/planning/naming-decision-log.md`

## Validation
- `node scripts/check_naming_legacy_usage.js` - Pass
- `npm -C frontend run validate` - Pass
- `npm -C frontend run docs:check` - Pass

## Notes
- This slice adds enforcement only; no runtime behavior changes.
- Alias removal remains deferred until two-release-cycle deprecation window and explicit Stop-Point 7 contraction approval.
