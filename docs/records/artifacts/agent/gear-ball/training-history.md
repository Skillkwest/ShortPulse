# Gear Ball Training History

Purpose: keep the current training synthesis short and actionable. Detailed run narratives live in `run-log.md` and the dated retained reports.

## Current Score Snapshot

- Recent substantive-run range: `6/10` to `9/10`
- Current working band: `8.5/10` to `9/10`
- Main gap to `10/10`: first-manifest fan-out completeness on shared contracts

## Recent Run Notes

- 2026-05-20: another production SOP run stayed inside the `8.5/10` band. Preflight/build/full-suite discipline was solid, but the browser-smoke lane overran user preference and then ended as `smoke-incomplete by user direction`.
- 2026-05-20: a later production SOP run stayed below `9/10` because a `build`-only type failure was fixed after the full suite had already started, which forced Gear Ball to treat the earlier suite as stale and rerun final validation on the corrected tree.

## Structural Milestones

- 2026-05-13: added the retained self-audit loop, retained artifacts area, baseline KPI, report template, and helper-tool decision rule.
- 2026-05-14 to 2026-05-15: stabilized branch/allowed-branch discipline, three-branch promotion discipline, and explicit handoff-chain publishing.
- 2026-05-15 to 2026-05-16: added file-backed preflight manifests, early build/docs gates, and route-smoke expectations.
- 2026-05-18 to 2026-05-19: tightened closeout invalidation, shared-contract fan-out rules, and sub-`9/10` mechanical-remediation expectations.

## Repeated Slips And Shipped Remediations

| Slip class                               | What changed to prevent it                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Parallel Git/index collisions            | Serialized all index-touching Git commands in SOP and memory.                                                                             |
| Branch drift before first write          | Added explicit branch + `shortpulse.allowedBranch` verification before any Git mutation.                                                  |
| Repo-root Vitest path mistakes           | Normalized repo-root `frontend/...` paths and added file-backed test manifests.                                                           |
| Late leftover tails after early commits  | Added inter-batch leftover audits after every commit and one final pre-push leftover audit.                                               |
| Build/docs regressions found too late    | Added early `build` and early `docs:check` triggers for compound-risk lanes.                                                              |
| Invalid early closeouts                  | Added closeout invalidation rule when later product/docs/test work appears.                                                               |
| Shared-contract fan-out misses           | Added mandatory shared-contract checklist in the SOP and auto-inferred contract tests in `gear-ball:preflight`.                           |
| Soft route-smoke behavior                | Added `smoke-incomplete` as a scored failure mode for qualifying runs.                                                                    |
| Tooling PATH/runtime assumptions         | Switched helper/docs/test invocations and Husky pre-commit lint-staged execution to explicit local binaries or direct Node entrypoints.   |
| Broken local wrapper/native-module drift | On wrapper/runtime mismatch, fall back directly to the approved Node 22 binary plus package entrypoints for `build` and full-suite gates. |
| Pre-smoke manifest drift                 | Rebuild the active manifest from live `git status --short` after smoke/KPI capture steps that generate new retained or support files.     |

## Current Training Priorities

1. Improve first-manifest fan-out on shared contracts beyond the currently known preview/KPI/layout rules.
2. Keep route-level browser smoke consistently green on qualifying frontend/admin runs, including the current active surface when legacy triggers disappear.
3. Keep helper and runtime-entry assumptions minimal so preflight, build, and full-suite gates behave the same way in every Codex run.

## Current Retained Guidance

- Prefer file-backed manifests on large runs.
- Treat shared contracts as fan-out triggers, not local-file-only changes.
- Ship mechanical remediation on sub-`9/10` runs whenever feasible.
- Keep retained closeout aligned with the exact validated worktree state.

## Detailed Evidence

- Concise run ledger: `docs/records/artifacts/agent/gear-ball/run-log.md`
- Full retained reports: `docs/records/artifacts/agent/gear-ball/reports/`
