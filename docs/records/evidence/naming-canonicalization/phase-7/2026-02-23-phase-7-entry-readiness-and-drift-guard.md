# Naming Canonicalization Phase 7 Entry Readiness and Drift Guard

## Metadata
- Date: 2026-02-23
- Phase: 7 (Alias sunset contract entry planning)
- Slice: Entry-readiness package + active-doc naming drift guard
- Owner: Frontend + Docs Governance

## Scope
1. Added Phase 7 readiness plan with explicit done-state audit, release-window tracker, and compatibility alias inventory.
2. Added automated active-doc naming drift guard:
- `scripts/check_naming_canonical_drift.js`
3. Wired drift guard into docs gate:
- `npm -C frontend run docs:check`

## Changed Files
- `scripts/check_naming_canonical_drift.js`
- `frontend/package.json`
- `docs/README.md`
- `docs/planning/README.md`
- `docs/planning/naming-canonical-map.md`
- `docs/planning/naming-phase-7-entry-readiness.md`
- `docs/planning/naming-canonicalization-program.md`
- `docs/planning/naming-canonicalization-tracker.md`
- `docs/planning/naming-decision-log.md`

## Validation
- `npm -C frontend run docs:check` - Pass
- `node scripts/check_naming_canonical_drift.js` - Pass
- `npm -C frontend run validate` - Pass

## Notes
- No runtime behavior changes were made.
- Alias deletion remains intentionally deferred until two-release-cycle deprecation window criteria are satisfied and Stop-Point 7 is approved.
