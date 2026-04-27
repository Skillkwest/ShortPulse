# Lane A Evidence Packet: A1-01 Naming Gate Recovery

date_utc: 2026-03-16  
slice_id: A1-01  
lane: A  
phase: A1  
owner: Engineering

## Scope
1. Recover `check:naming-legacy-usage` without runtime behavior changes.
2. Keep compatibility bridge contract usage explicit and temporary.
3. Reconfirm `validate` pass path after gate recovery.

## Commands Run
1. `npm -C frontend run check:naming-legacy-usage`
2. `npm -C frontend run validate`
3. `npm -C frontend run check:size-budget`

## Results
| command | exit_code | result |
| --- | --- | --- |
| `check:naming-legacy-usage` | 0 | pass |
| `validate` | 0 | pass (`lint`, `type-check`, naming guard, full `test`) |
| `check:size-budget` | 1 | fail (`frontend/pages/ai-studio.tsx` 1880 > 1700) |

## Baseline Or Delta Notes
1. Naming guard recovery implemented in `scripts/check_naming_legacy_usage.js` by adding explicit temporary allowlist entries for compatibility bridge files:
   - `frontend/features/ai-studio/hooks/contracts/pageContentAdapter.ts`
   - `frontend/features/ai-studio/hooks/contracts/pageContentContracts.ts`
2. Allowlist includes an in-code sunset note tied to ADR-0023 alias-sunset tracking.
3. No runtime module behavior changed in this slice.

## Rollback Note
1. Revert commit containing `scripts/check_naming_legacy_usage.js` allowlist update if naming policy direction changes.
2. Keep rollback scoped to gate policy only; do not alter bridge runtime contracts in Lane A.

## Linked Plan Artifacts
1. `docs/archive/planning/lane-a-master-plan-2026-03-16.md`
2. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
