# Lane F Evidence Packet - F4-01 Action Pinning Policy

- `slice_id`: `F4-01`
- `date_utc`: `2026-03-17`

## Scope

1. `.github/dependabot.yml`
2. `docs/planning/ci-policy-checks.md`
3. `docs/planning/lane-f-execution-plan-2026-03-16.md`
4. `docs/planning/lane-f-master-plan-2026-03-16.md`
5. `docs/planning/evidence/lane-f/README.md`
6. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`

## Commands Run

1. `find .github/workflows -maxdepth 1 -name '*.yml' -print0 | xargs -0 rg -n "uses:"`
2. inventory script over `.github/workflows/*.yml` for total and unique action refs
3. `sed -n '1,220p' .github/dependabot.yml`
4. `npm -C frontend run lint`
5. `npm -C frontend run type-check`
6. `npm -C frontend run build`
7. `npm -C frontend run docs:check`

## Results

1. Locked `Phase A` as the current approved workflow action pinning target.
2. Recorded the current action inventory baseline:
   - total `uses:` refs: `42`
   - unique action refs: `4`
   - full-SHA pins: `0`
3. Converted current non-pinned action refs into explicit tracked exceptions with owner and sunset criterion.
4. Added `github-actions` ecosystem coverage to Dependabot so future ref drift remains reviewable.
5. Kept `F4-01` narrow by documenting and governing the current supply-chain posture without forcing a broad SHA-pinning rewrite.

## CI Inventory Before/After

- Before: action inventory existed only as a baseline metric and unpinned refs were implicit drift.
- After: action inventory, phase target, exception ownership, and update procedure are explicit policy surfaces.

## Required Check Delta

- None.

## Owner Identity Delta

- None.

## Environment Policy Delta

- None.

## Plan Tier Enforcement State

1. Branch/ruleset enforcement remains plan-limited and unchanged.
2. Workflow action pinning policy is now explicit under Lane F `Phase A`.
3. Promotion to full-SHA pinning remains deferred to a later approved phase with explicit exception review.

## Rollback Note

Revert the Dependabot `github-actions` stanza and the `Workflow action pinning policy` section if the repository needs to return to pre-Lane F supply-chain governance posture.

## Linked PR

- Pending
