# STG-06 CI And Policy-As-Code Enforcement

## Summary
Automate anti-drift checks and wire governance gates to CI with staged enforcement.

## Checklist
- [x] Add docs semantic drift checker.
- [x] Add migration parity checker.
- [x] Add archive manifest checker.
- [x] Wire new CI jobs with warn/evaluate behavior.
- [ ] Promote to enforce mode after two green release cycles.

## Verification
- `node scripts/check_docs_semantic_drift.js`
- `node scripts/check_migration_doc_parity.js`
- `node scripts/check_archive_manifest.js`

## Owners and validators
- Owner: Engineering
- Validator: Security + Docs governance

## KPI
- Drift checks fail intentionally on seeded mismatch and pass when aligned.

## Evidence
- `docs/planning/ci-policy-checks.md`
- `.github/workflows/ci.yml`
