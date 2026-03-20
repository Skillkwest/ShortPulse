# Coordinate Parity Rollout Decision Log (2026-03-20)

Track promote/hold/rollback decisions for the Expert Edit coordinate-parity program.

## Decision Rows
| Date (UTC) | Phase / Row | Decision | Rationale | Evidence Packet | Owner |
| --- | --- | --- | --- | --- | --- |
| 2026-03-20 | `CP-004` | `HOLD` | Baseline packet refreshed with full validation rerun and browser-backed capture harness added, but required matrix closure remains incomplete (`zoom=4`, canonical pan tuples, `4:3` stage, DPR `1/2/3`) and this workspace lacks `PLAYWRIGHT_AUDIT_EMAIL` for harness execution | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp004-baseline-matrix.md` | AI Studio FE + QA |
| 2026-03-20 | `CP-004` | `WAIVER_ACCEPTED` | User-approved waiver: proceed without full CP-004 matrix closure; accepted residual risk on missing baseline slices (`zoom=4`, canonical pan tuples, `4:3` stage, DPR `1/2/3`) due to credential-gated browser capture in this workspace | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp004-baseline-matrix.md` | AI Studio FE + QA |
| 2026-03-20 | `CP-301` | `PASS` | Canonical selected-layer mask resolution and scene-preserving mask remap contract validated via local Phase 3 suite | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp301-cp302-mask-export-contract-progress.md` | AI Studio FE |
| 2026-03-20 | `CP-302` | `HOLD` | Submit/export camera-crop parity is green in local automated tests, but required browser-backed parity matrix (`zoom/pan/aspect/DPR`) remains credential-blocked in this workspace | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp301-cp302-mask-export-contract-progress.md` | AI Studio FE + QA |
| 2026-03-20 | `CP-302` | `WAIVER_ACCEPTED` | User-directed skip: browser-backed parity matrix and additional formal closeout evidence are explicitly waived; proceed with residual risk acknowledged | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp301-cp302-mask-export-contract-progress.md` | AI Studio FE + QA |
| 2026-03-20 | `CP-303` | `PASS` | Shared zoom clamp authority enforced in viewport + flatten contracts and revalidated in the Phase 3 command suite | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp303-zoom-clamp-parity.md` | AI Studio FE |
| 2026-03-20 | `CP-401` | `IN_PROGRESS` | Canonical zoom/pan transform-threshold matrix assertions were added to unit harnesses; final row closeout remains gated by CP-302 browser-backed matrix closure and Phase 4 consolidation | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp401-transform-threshold-harness-progress.md` | AI Studio FE |
| 2026-03-20 | `CP-402` | `IN_PROGRESS` | Inline/modal pointer lifecycle parity assertions for `pointercancel` and `pointerleave` were added to integration tests; final row closeout remains gated by CP-302 and Phase 4 consolidated evidence | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp402-pointer-lifecycle-integration-progress.md` | AI Studio FE + QA |
| 2026-03-20 | `CP-401` | `PASS` | Unit transform-threshold harness is consolidated into a deterministic parity gate command used for CI gating | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp403-cp404-parity-gate-and-ci-enforcement.md` | AI Studio FE |
| 2026-03-20 | `CP-402` | `PASS` | Inline/modal pointer lifecycle integration coverage is consolidated into the deterministic parity gate command | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp403-cp404-parity-gate-and-ci-enforcement.md` | AI Studio FE + QA |
| 2026-03-20 | `CP-403` | `PASS` | Deterministic drift signatures are enforced by parity gate suites; optional browser-backed audit remains available for additional runtime evidence | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp403-cp404-parity-gate-and-ci-enforcement.md` | QA + AI Studio FE |
| 2026-03-20 | `CP-404` | `PASS` | Dedicated CI gate job (`expert_edit_coordinate_parity`) is wired with warn/enforce policy and enforce default | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp403-cp404-parity-gate-and-ci-enforcement.md` | AI Studio FE + DevEx |
| 2026-03-20 | `CP-501` | `IN_PROGRESS` | Canary entry criteria and rollback contract are now locked; rollout execution is in progress pending canary matrix evidence | `docs/planning/evidence/ai-studio-expert-edit/2026-03-20-cp501-canary-entry-and-rollback-contract.md` | AI Studio FE + QA + Ops |
| 2026-03-20 | `CP-502` | `PENDING` | Production verification not started | `TBD` | QA + Ops |
| 2026-03-20 | `CP-503` | `PENDING` | Closeout not started | `TBD` | AI Studio FE |

## Policy
1. Every canary promote/hold/rollback decision must add a row with linked evidence.
2. Rollback decisions must record trigger metric and threshold breach.
3. `CP-503` cannot be marked `DONE` until this log contains final production decision rows.
