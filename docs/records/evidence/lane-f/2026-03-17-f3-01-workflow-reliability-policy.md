# Lane F Evidence Packet - F3-01 Workflow Reliability Policy

- `slice_id`: `F3-01`
- `date_utc`: `2026-03-17`

## Scope

1. `.github/workflows/ci.yml`
2. `.github/workflows/conversation-state-hardening-gate.yml`
3. `.github/workflows/apply-conversation-state-migration-028.yml`
4. `.github/workflows/media-storage-deploy-gate.yml`
5. `docs/planning/ci-policy-checks.md`
6. `docs/release-checklist.md`
7. `docs/archive/planning/lane-f-execution-plan-2026-03-16.md`
8. `docs/archive/planning/lane-f-master-plan-2026-03-16.md`
9. `docs/records/evidence/lane-f/README.md`
10. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`

## Commands Run

1. `sed -n '1,260p' .github/workflows/ci.yml`
2. `for f in .github/workflows/*.yml; do echo "--- $f"; sed -n '1,80p' "$f"; done`
3. `sed -n '1,280p' docs/planning/ci-policy-checks.md`
4. `npm -C frontend run lint`
5. `npm -C frontend run type-check`
6. `npm -C frontend run build`
7. `npm -C frontend run docs:check`

## Results

1. Added explicit workflow-level `concurrency` to all active Lane F governed workflows.
2. `CI` now cancels stale `pull_request` and `push` runs while preserving operator-invoked `workflow_dispatch` runs.
3. Environment-targeted manual gates/migrations now serialize by target environment and never auto-cancel in-progress runs.
4. `docs/planning/ci-policy-checks.md` now documents the canonical trigger/concurrency/cancellation posture.
5. Merge-queue readiness posture is explicit: `merge_group` remains deferred until merge queue adoption and must be added in the same PR that changes merge policy.
6. `docs/release-checklist.md` now requires Lane F workflow-governance edits to preserve the documented trigger/concurrency policy.

## CI Inventory Before/After

- Before: active governed workflows had no explicit workflow-level `concurrency` policy.
- After: all active governed workflows in Lane F scope have explicit concurrency groups and cancellation posture.

## Required Check Delta

- No required-check names changed.
- No job IDs changed.
- Required-check trigger posture remains `pull_request`/`push`/`workflow_dispatch` for `CI`; `merge_group` remains documented as deferred.

## Owner Identity Delta

- None.

## Environment Policy Delta

- None.

## Plan Tier Enforcement State

1. Branch/ruleset enforcement remains plan-limited.
2. Workflow reliability posture is now implemented locally in workflow YAML and mirrored in policy docs.
3. Manual compensating-control evidence remains required for branch/ruleset enforcement posture.

## Rollback Note

Revert the four workflow `concurrency` blocks and the paired policy-doc updates if the new run-cancellation posture causes unintended operator friction or blocks governed manual operations.

## Linked PR

- Pending
