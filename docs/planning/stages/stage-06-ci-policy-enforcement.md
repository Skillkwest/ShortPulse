# STG-06 CI And Policy-As-Code Enforcement

## Summary
Automate anti-drift checks and wire governance gates to CI with staged enforcement.

## Checklist
- [x] Add docs semantic drift checker.
- [x] Add migration parity checker.
- [x] Add archive manifest checker.
- [x] Wire new CI jobs with warn/evaluate behavior.
- [x] Add environment-gated SQL hardening workflow for staged DB verification.
- [ ] Promote to enforce mode after two green release cycles.
- [x] Capture manual branch-protection mapping evidence with exact required check names.

## Verification
- `node scripts/check_docs_semantic_drift.js`
- `node scripts/check_migration_doc_parity.js`
- `node scripts/check_archive_manifest.js`
- `gh workflow run conversation-state-hardening-gate.yml -f target_environment=staging -f mode=warn`

## Owners and validators
- Owner: Engineering
- Validator: Security + Docs governance

## KPI
- Drift checks fail intentionally on seeded mismatch and pass when aligned.

## Completion gate
STG-06 may be `In Progress`, but it cannot be marked `Completed` until all are true:
- [x] STG-04 Phase C is complete.
- [ ] Warn/evaluate checks are green for two release cycles.
- [x] Branch-protection mapping proof is captured with exact required check names.

## Prototype-mode waiver (MVP)
For MVP prototype execution, STG-06 completion is waived as a production-only gate:
- Build/commit/feature implementation is allowed while STG-06 remains `In Progress`.
- Governance checks continue in warn/evaluate mode with evidence updates.
- Full STG-06 completion remains mandatory before production readiness signoff.

## Evidence
- `docs/planning/ci-policy-checks.md`
- `docs/records/evidence/docs/2026-02-20-branch-protection-required-check-mapping.md`
- `docs/records/evidence/docs/2026-02-21-stg-06-cycle-status.md`
- `docs/records/evidence/docs/2026-02-21-stg-06-prototype-waiver.md`
- `.github/workflows/ci.yml`
