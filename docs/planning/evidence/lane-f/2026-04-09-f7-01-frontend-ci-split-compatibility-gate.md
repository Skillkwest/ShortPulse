# Lane F Evidence Packet: F7-01 Frontend CI Split Compatibility Gate

- `slice_id`: `F7-01`
- `date_utc`: `2026-04-09`

## Scope

1. `.github/workflows/ci.yml`
2. `frontend/package.json`
3. `docs/planning/ci-policy-checks.md`
4. `docs/release-checklist.md`
5. `docs/testing-guide.md`
6. `docs/api/api-internal-routes.md`

## Commands Run

1. `npm -C frontend run test:frontend-fast-lane`
2. `npm -C frontend run docs:check:frontend-contracts`
3. `npm -C frontend run docs:check`
4. `npm -C frontend run validate:lane-f-governance`

## Results

1. Split the monolithic frontend CI lane into responsibility-based jobs:
   - `frontend_lint`
   - `frontend_docs_contracts`
   - `frontend_fast_tests`
   - `frontend_unit_tests`
   - `frontend_build`
2. Preserved `frontend` as an always-run compatibility aggregator over the split lanes plus `type_check`.
3. Added first-class script seams for the fast-lane suite and narrowed frontend docs-contract checks.
4. Fixed governance drift so CI docs now reflect the `production` push trigger and the split-lane contract.
5. Repaired semantic-doc drift discovered during validation by documenting `/api/kie/upload-url`.

## CI Inventory Before/After

- Before:
  - one monolithic `frontend` job executed lint, docs checks, fast-lane tests, full tests, and build inline
  - `frontend` was both the implementation lane and the compatibility/required-check surface
- After:
  - split frontend responsibilities run in dedicated jobs
  - `frontend` is compatibility-only and fails if any split dependency fails
  - docs-contract checks no longer duplicate `docs_semantic_drift`, `migration_parity`, or `archive_manifest_check`

## Required Check Delta

1. No GitHub UI/ruleset migration was performed in this slice.
2. Existing required-check continuity is preserved because `frontend` remains present.
3. Follow-up migration, if desired, should explicitly replace `frontend` in GitHub settings with new job names or a later stable gate.

## Owner Identity Delta

1. None.

## Environment Policy Delta

1. None.

## Plan Tier Enforcement State

1. Unchanged.
2. Current repository-plan limitations still require manual evidence for ruleset posture; no enforceability posture changed in this slice.

## Rollback Note

If the split lanes cause operational friction, revert the new frontend split jobs and restore the previous monolithic `frontend` implementation while keeping the documentation changes for `/api/kie/upload-url` if that route remains live.

## Linked PR

1. Local working branch: `working-development`
