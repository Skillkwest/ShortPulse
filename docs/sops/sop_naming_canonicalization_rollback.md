# SOP: Naming Canonicalization Rollback

## Purpose
Provide a deterministic rollback procedure for naming-only slices when regression risk or breakage is detected.

## Scope
- Applies to naming-canonicalization slices only.
- Applies to docs, UI copy, symbol aliases, callsite migrations, and asset-path canonicalization.

## Preconditions
1. Slice evidence artifact exists for the change being rolled back.
2. Rollback owner has identified the exact commit range.
3. No unrelated functional changes are included in rollback scope.

## Rollback Triggers
1. Failing `validate`/adaptive/perf/docs gates post-slice.
2. Runtime import/path breakage from rename/cutover.
3. UI copy or asset-path regressions impacting user flows.

## Procedure
1. Isolate rollback scope to the naming slice commit set only.
2. Revert the slice commit(s) with non-interactive git commands.
3. Re-run required gates:
- `npm -C frontend run validate`
- `npm -C frontend run test:adaptive-v2-gate`
- `npm -C frontend run perf:ai-studio:release-check`
- `npm -C frontend run docs:check`
4. Log rollback details in:
- `docs/planning/naming-canonicalization-tracker.md`
- `docs/planning/naming-decision-log.md`
- slice evidence artifact
5. Mark slice as `blocked` and do not proceed until a corrective mini-plan is approved.

## Post-Rollback Requirements
1. Add root-cause summary to evidence.
2. Record whether rollback was full or partial.
3. Reconfirm canonical map integrity before restarting execution.
