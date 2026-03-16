# Media Rendering Hardening v2 Execution Tracker (2026-03-16)

Last updated: 2026-03-16  
Status: Active  
Roadmap source: `docs/planning/media-rendering-hardening-v2-master-roadmap-2026-03-16.md`

## Status Legend
- `Not Started`
- `In Progress`
- `Blocked`
- `Completed`

## Required Row Schema
Each row must include exactly:
1. `slice_id`
2. `phase`
3. `surface`
4. `contract_lock`
5. `before`
6. `after`
7. `targeted_tests`
8. `full_gates`
9. `risk`
10. `rollback`
11. `status`
12. `evidence`

## Program Snapshot
| phase | status | current_focus | blockers | next_checkpoint |
| --- | --- | --- | --- | --- |
| P0A | Not Started | Characterization + baseline lock | Baseline packet not published | Metrics + characterization packet complete |
| P0B | Not Started | Full image-surface inventory lock | Inventory IDs not frozen | Inventory lock accepted |
| P1 | Not Started | Signed URL + preview resolution contract | Policy decision pending | Cross-surface parity tests green |
| P2 | Not Started | List profile + folder-query scalability | Query-shape contract pending | Payload and pagination parity evidence |
| P3 | Not Started | Canonical upload and compatibility adapters | Sunset gates undefined | Adapter parity and usage telemetry lock |
| P4 | Not Started | Metadata authority and parser policy | MIME/dimension fallback policy pending | Invariant tests and propagation checks |
| P5 | Not Started | Render cost reduction | Hot loop profiling packet pending | Large-library perf gate pass |
| P6 | Not Started | Anti-bloat enforcement | Budget/boundary media coverage pending | Enforce-mode checks green |
| P7 | Not Started | Long-tail consistency sweep | Inventory long-tail closure pending | Consistency sweep packet complete |
| P8 | Not Started | Rollout/decommission | Release windows not complete | Final closeout packet |

## Seed Slice Backlog
| slice_id | phase | surface | contract_lock | before | after | targeted_tests | full_gates | risk | rollback | status | evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MRH2-P0A-001 | P0A | inventory+contracts | Freeze seam list and baseline metrics schema | No authoritative baseline bundle | Baseline bundle published | Characterization suite bootstrapped | lint,type-check,build,docs:check | Missing edge-path coverage | Revert baseline-only docs slice | Not Started | `docs/planning/evidence/media-rendering-hardening-v2/` |
| MRH2-P0B-001 | P0B | image surfaces | Freeze all `next/image` and `<img>` callsite IDs | Partial hot-path assumptions | Full surface registry with owners | Inventory lock integrity checks | lint,docs:check | Long-tail misses | Revert inventory lock slice | Not Started | `docs/planning/media-rendering-hardening-v2-image-surface-inventory-lock-2026-03-16.md` |
| MRH2-P1-001 | P1 | signed-url policy | Cross-surface preview/fallback contract | Route/modal/panel/reference drift | One deterministic policy + taxonomy | Signed URL resolver tests | lint,type-check,build,test:adaptive-v2-gate | Regression on reference-grid quality | Feature-flag rollback to previous resolver | Not Started | TBD |
| MRH2-P2-001 | P2 | media list API | `profile=minimal` default contract | Hot path overfetch includes metadata | Profiled response with compatibility mode | List payload parity tests | lint,type-check,build,docs:check | Consumer contract drift | Keep expanded fallback path enabled | Not Started | TBD |
| MRH2-P2-002 | P2 | folder queries | Replace id fan-in query pattern | `.in(id, ids)` growth risk | Scalable membership query shape | Folder scalability tests | lint,type-check,build | Query latency regression | Revert to previous query behind flag | Not Started | TBD |
| MRH2-P3-001 | P3 | upload adapters | `/api/media/upload` canonical | Legacy endpoints are primary consumers | Compatibility adapters with telemetry | Upload parity adapter tests | lint,type-check,build,docs:check | Adapter parity mismatch | Keep old route behavior behind kill switch | Not Started | TBD |
| MRH2-P4-001 | P4 | metadata | Dimension + MIME fallback authority | Allowed MIME > parser support | Deterministic metadata policy | Dimension invariants tests | lint,type-check,build | Null-dimension behavior changes | Revert metadata canonicalization step | Not Started | TBD |
| MRH2-P5-001 | P5 | render hot loops | Virtualization recompute clamp | Full-list recompute pressure | Visible-window prioritized scheduling | Render perf tests | lint,type-check,build,perf:ai-studio:release-check | UX stutter under load | Rollback to previous scheduler | Not Started | TBD |
| MRH2-P6-001 | P6 | governance checks | Media hotspot budgets + boundaries | No enforceable media guardrails | Enforced size/boundary checks | Guardrail check tests | lint,type-check,build,check:size-budget,check:architecture-boundary | False-positive checks block PRs | Warn-mode fallback with tracked sunset | Not Started | TBD |
| MRH2-P8-001 | P8 | decommission | Legacy adapter retirement criteria | Compatibility paths still live | Legacy routes removed post-gates | Sunset verification tests | lint,type-check,build,docs:check | Hidden consumers remain | Re-enable adapters via revert/kill switch | Not Started | TBD |

## Merge Discipline
1. One seam per PR.
2. No mixed feature work in hardening slices.
3. Every row needs explicit rollback note before merge.
4. Every row requires evidence link before status moves to `Completed`.
5. Blocked rows must include blocker owner and unblock criterion.
