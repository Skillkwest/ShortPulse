# Elements Workflow Measurement Refresh

Date: 2026-06-01

## System

- `Elements workflow`
- Related shared surface: `Media delivery / signing / preview resolution`

## Evidence Class

- Production URL measurement on `https://www.shortpulse.ai`.
- Repo/worktree KPI tooling correction for evidence-depth measurement.
- No product UI, UX, intended behavior, or runtime feature code changed.

## What Changed

- Corrected the approved-panel KPI capture helper so measurements already observed during panel open are represented in the scored packet:
  - `openToFirstMediaP95Ms` is now derived from repeated visible-media observations instead of staying null.
  - runs that reach a terminal media or empty state without showing loading copy count `loadingStateVisibleMsP95` as measured `0ms` instead of missing.
- Added a regression proving absent loading copy is treated as measured zero only after the open run reaches a terminal state.

## Proof

- `npm -C frontend run test -- --run scripts/__tests__/media_panel_kpi_capture.test.ts scripts/__tests__/media_panel_kpi_score.test.ts` passed: 2 files, 29 tests.
- Production capture passed:
  - `node frontend/scripts/media_panel_kpi_capture.mjs --surface elements-media-panel --base-url https://www.shortpulse.ai --format markdown --runs 5`
  - `node frontend/scripts/media_panel_kpi_capture.mjs --surface ai-studio-panel --base-url https://www.shortpulse.ai --format markdown --runs 5`

## Production KPI Results

| Surface                |    Score | Evidence | Coverage | First media p95 | Loading p95 | Open-to-first p95 | Settle p95 | Extra list calls/open | Missing preview ratio | Console errors/open |
| ---------------------- | -------: | -------- | -------: | --------------: | ----------: | ----------------: | ---------: | --------------------: | --------------------: | ------------------: |
| `elements-media-panel` | `6 / 10` | `low`    |    `51%` |         `942ms` |       `0ms` |           `942ms` |   `1351ms` |                   `0` |                   `0` |                 `0` |
| `ai-studio-panel`      | `6 / 10` | `low`    |    `51%` |         `666ms` |       `0ms` |           `666ms` |   `1074ms` |                   `0` |                   `0` |                 `0` |

Both surfaces still report `includeLibraryTotalCount=true` on the open-phase media-list request, confirming the approved-panel list-orchestration root fix remains visible in production.

## Decision

- Move `Elements workflow` to `6/10`, at ship floor.
- Do not move above floor. Evidence depth remains low at `51%`, the score is capped by coverage below `75%`, and persistence/signing/canonical-preview metrics are still not directly measured.
- Move `Elements workflow` out of exact-next order. Its previous live blocker class is now reduced enough that `Create workflow` becomes the next higher-ROI launch-readiness lane.
- Keep `Media delivery / signing / preview resolution` at `6/10`, at floor. The shared approved-panel evidence is better, but still not deep enough to justify a maturity lift.

## Next Proof

- Exact next lane: `Create workflow`.
- If the approved-panel/Elements lane reopens, the next proof is measurement-depth hardening for direct signing, fallback, canonical-preview, empty-state, and persistence metrics.
