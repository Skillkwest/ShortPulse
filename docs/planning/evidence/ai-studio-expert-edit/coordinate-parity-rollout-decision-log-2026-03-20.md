# Coordinate Parity Rollout Decision Log (2026-03-20)

Track promote/hold/rollback decisions for the Expert Edit coordinate-parity program.

## Decision Rows
| Date (UTC) | Phase / Row | Decision | Rationale | Evidence Packet | Owner |
| --- | --- | --- | --- | --- | --- |
| 2026-03-20 | `CP-004` | `HOLD` | Baseline packet refreshed with full validation rerun and browser-backed capture harness added, but required matrix closure remains incomplete (`zoom=4`, canonical pan tuples, `4:3` stage, DPR `1/2/3`) and this workspace lacks `PLAYWRIGHT_AUDIT_EMAIL` for harness execution | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp004-baseline-matrix.md` | AI Studio FE + QA |
| 2026-03-20 | `CP-004` | `WAIVER_ACCEPTED` | User-approved waiver: proceed without full CP-004 matrix closure; accepted residual risk on missing baseline slices (`zoom=4`, canonical pan tuples, `4:3` stage, DPR `1/2/3`) due to credential-gated browser capture in this workspace | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp004-baseline-matrix.md` | AI Studio FE + QA |
| 2026-03-20 | `CP-501` | `PENDING` | Canary rollout not started | `TBD` | AI Studio FE + Ops |
| 2026-03-20 | `CP-502` | `PENDING` | Production verification not started | `TBD` | QA + Ops |
| 2026-03-20 | `CP-503` | `PENDING` | Closeout not started | `TBD` | AI Studio FE |

## Policy
1. Every canary promote/hold/rollback decision must add a row with linked evidence.
2. Rollback decisions must record trigger metric and threshold breach.
3. `CP-503` cannot be marked `DONE` until this log contains final production decision rows.
