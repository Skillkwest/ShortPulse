# Media Rendering Hardening v2 Execution Tracker (2026-03-16)

Last updated: 2026-03-18
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
2. `lane`
3. `phase`
4. `surface`
5. `contract_lock`
6. `before`
7. `after`
8. `targeted_tests`
9. `full_gates`
10. `risk`
11. `rollback`
12. `status`
13. `evidence`
14. `rebuild_entry_scorecard`
15. `security_boundary_verification`
16. `performance_parity_thresholds`

## Program Snapshot
| phase | lane | status | current_focus | blockers | next_checkpoint |
| --- | --- | --- | --- | --- | --- |
| P0 | Foundation | Completed | Inventory, telemetry truth, and stop/go accepted | none | Implementation may start at P2; P3 remains blocked on Pipeline authority |
| P1 | Foundation | Completed | Surface policy decision matrix + ADR reconciliation | none | Policy lock published |
| P2 | Pipeline | Not Started | Ingest, metadata authority, derivative-first server truth, and sign/resolve handoff | MIME/dimension fallback policy and derivative/server-contract handoff pending | P2 implementation slice opened with derivative-first authority |
| P3 | Surface | Not Started | Read/render contract unification across hot-path and modal-preview surfaces | Pipeline authority contracts and derivative-readiness truth still pending | Cross-surface parity evidence complete |
| P4 | Foundation | Completed | Test realignment | none | Test matrix accepted |
| P5 | Pipeline | Not Started | List profile + folder-query scalability | Query-shape contract pending | Payload and pagination parity evidence |
| P6 | Pipeline | Not Started | Canonical upload and compatibility adapters | Caller inventory/sunset rules pending | Adapter parity and usage telemetry lock |
| P7 | Surface | Not Started | Render cost reduction + anti-bloat | Hot loop profiling packet pending | Perf gate + guardrail enforce mode |
| P8 | Surface | Not Started | Long-tail consistency sweep | Long-tail inventory closure pending | Sweep packet complete |
| P9 | Surface | Not Started | Rollout/decommission | Release windows not complete | Final closeout packet |

## Seed Slice Backlog
| slice_id | lane | phase | surface | contract_lock | before | after | targeted_tests | full_gates | risk | rollback | status | evidence | rebuild_entry_scorecard | security_boundary_verification | performance_parity_thresholds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MRH2-P0-001 | Foundation | P0 | inventory | Freeze all image/media callsite IDs and owners | Partial hot-path assumptions | Full surface registry with owners, parity tests, and queued-surface dispositions | Inventory integrity checks | lint,docs:check | Long-tail misses | Revert inventory-only docs slice | Completed | `docs/planning/media-rendering-hardening-v2-image-surface-inventory-lock-2026-03-16.md` | N/A (docs-only slice) | N/A (docs-only slice) | N/A (docs-only slice) |
| MRH2-P0-002 | Foundation | P0 | telemetry | Approve trustworthy baseline fields | Misleading delivery telemetry allowed into baseline | Telemetry truth spec + baseline packet gating with explicit surface coverage limits | Telemetry spec review | lint,docs:check | False baseline confidence | Revert docs-only calibration slice | Completed | `docs/planning/media-rendering-hardening-v2-telemetry-baseline-truth-spec-2026-03-18.md` | N/A (docs-only slice) | N/A (docs-only slice) | N/A (docs-only slice) |
| MRH2-P0-003 | Foundation | P0 | stop/go | Lock pre-implementation readiness and evidence naming | Foundation prerequisites exist but are not closed as one gate | Stop/go checklist accepted; evidence/index naming normalized | Stop/go review | lint,docs:check | Behavior-changing work starts on incomplete planning truth | Revert docs-only stop/go closeout slice | Completed | `docs/planning/media-rendering-hardening-v2-pre-implementation-stop-go-checklist-2026-03-18.md` | N/A (docs-only slice) | N/A (docs-only slice) | N/A (docs-only slice) |
| MRH2-P1-001 | Foundation | P1 | surface policy | One delivery rule per surface and source class | Route/modal/panel/reference/character/detail drift | Accepted surface policy matrix + decision-log entries | Policy matrix review + resolver parity tests | lint,docs:check,test:adaptive-v2-gate | Wrong policy lock causes broad rework | Hold implementation; revert docs-only policy slice | Completed | `docs/planning/media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md` | Required before behavior-changing P3 slices | Must verify no cross-tenant or signed-URL trust boundary drift before cutover | Define per-surface parity thresholds before policy cutover |
| MRH2-P1-002 | Foundation | P1 | ADR | Publish durable delivery-policy ADR and reconcile existing media ADRs | Surface policy intent is not yet reconciled with accepted ADR set | ADR published; ADR 0018 and ADR 0036 reconciliation logged | ADR review | lint,docs:check | Policy docs conflict and later implementation drifts | Revert docs-only ADR slice and hold policy cutover | Completed | `docs/adr/0044-media-rendering-surface-delivery-policy-and-adr-reconciliation.md` | N/A (docs-only slice) | N/A (docs-only slice) | N/A (docs-only slice) |
| MRH2-P2-001 | Pipeline | P2 | metadata | Dimension + MIME fallback authority | Allowed MIME > parser support | Deterministic authority and invariants | Dimension invariants tests | lint,type-check,build | Null-dimension behavior changes | Revert metadata canonicalization step | Not Started | `docs/planning/media-rendering-hardening-v2-metadata-authority-spec-2026-03-16.md` | Required before metadata cutover | Verify no public/private media path leak through metadata backfill or fallback | Lock aspect-ratio and derivative readiness parity thresholds |
| MRH2-P2-002 | Pipeline | P2 | sign+resolve handoff | Explicit server-owned sign/resolve handoff contract for Surface | Surface consumes implicit sign/resolve semantics from mixed legacy behavior | Contract matrix and decision log explicitly cover server handoff assumptions for Surface `P3` | Sign/resolve contract review + API characterization tests | lint,type-check,build,docs:check | Hidden server-contract drift surprises Surface cutover | Hold sign/resolve semantic changes until a dedicated slice lands or handoff contract is accepted | Not Started | `docs/planning/media-rendering-hardening-v2-pipeline-lane-execution-plan-2026-03-18.md` | Required before sign/resolve semantic change | Verify signed URL trust, expiry, and resolver fallback stay inside existing auth boundaries | Define sign/resolve latency and unresolved-rate thresholds before cutover |
| MRH2-P3-001 | Surface | P3 | hot-path surfaces | Cross-surface preview/fallback contract | Route/modal/panel/reference-grid drift | Deterministic source preference + taxonomy | Signed URL resolver tests + surface smoke | lint,type-check,build,test:adaptive-v2-gate | Preview regression on protected surfaces | Feature-flag rollback to previous resolver | Not Started | TBD | Required before surface cutover | Verify trusted-host, signed-URL, and fallback boundary invariants on every protected surface | Define route/modal/panel/reference parity and latency thresholds |
| MRH2-P3-002 | Surface | P3 | character+quick-swap+detail+modal-preview | Include character-grid, quick-swap, detail-modal, and media-library preview/detail modals in unified contract | Secondary preview/detail surfaces only partially covered | Explicit parity contract for character/quick-swap/detail/modal-preview surfaces | Character/quick-swap/detail/modal-preview surface tests | lint,type-check,build | Hidden surface drift survives in modal/detail paths | Revert surface adapter slice | Not Started | TBD | Required before secondary-surface cutover | Verify avatar/detail-preview surfaces do not widen signed URL or cross-user media access | Define character/quick-swap/detail/modal-preview parity thresholds |
| MRH2-P4-001 | Foundation | P4 | policy tests | Reclassify tests that lock drift | Signed URL unchanged / no-transform defaults treated as architectural truth | Test matrix accepted and rewrite queue seeded | Test classification review | lint,docs:check | Old tests block valid policy work | Keep tests in characterization-only bucket until replacement lands | Completed | `docs/planning/media-rendering-hardening-v2-test-realignment-matrix-2026-03-18.md` | N/A (docs-only slice) | N/A (docs-only slice) | N/A (docs-only slice) |
| MRH2-P5-001 | Pipeline | P5 | media list API | `profile=minimal` default contract | Hot path overfetch includes metadata | Profiled response with compatibility mode | List payload parity tests | lint,type-check,build,docs:check | Consumer contract drift | Keep expanded fallback path enabled | Not Started | `docs/planning/media-rendering-hardening-v2-api-list-profile-spec-2026-03-16.md` | Required before list-profile cutover | Verify minimal profile does not strip auth- or ownership-critical fields | Define payload-size and pagination parity thresholds |
| MRH2-P5-002 | Pipeline | P5 | folder queries | Replace id fan-in query pattern | `.in(id, ids)` growth risk | Scalable membership query shape | Folder scalability tests | lint,type-check,build | Query latency regression | Revert to previous query behind flag | Not Started | `docs/planning/media-rendering-hardening-v2-folder-query-scalability-spec-2026-03-16.md` | Required before query cutover | Verify folder membership query preserves user scoping and row-level access semantics | Define dataset-tier latency thresholds |
| MRH2-P6-001 | Pipeline | P6 | upload adapters | `/api/media/upload` canonical | Legacy endpoints are still active callers | Compatibility adapters with telemetry | Upload parity adapter tests | lint,type-check,build,docs:check | Hidden consumer breakage | Keep old route behavior behind kill switch | Not Started | `docs/planning/media-rendering-hardening-v2-legacy-adapter-sunset-spec-2026-03-16.md` | Required before endpoint sunset | Verify adapters preserve storage auth, content-type validation, and private bucket boundaries | Define adapter parity and failure-rate thresholds |
| MRH2-P7-001 | Surface | P7 | render hot loops | Virtualization recompute clamp | Full-list recompute pressure | Visible-window prioritized scheduling | Render perf tests | lint,type-check,build,perf:ai-studio:release-check | UX stutter under load | Roll back to previous scheduler | Not Started | TBD | Required before perf cutover | Verify no media prefetch/decode change bypasses existing auth or signed fetch boundaries | Define scroll, longtask, and open-to-first-media thresholds |
| MRH2-P7-002 | Surface | P7 | guardrails | Media hotspot budgets + boundaries | No enforceable media guardrails | Enforced size/boundary checks | Guardrail check tests | lint,type-check,build,check:size-budget,check:architecture-boundary | False-positive checks block PRs | Warn-mode fallback with tracked sunset | Not Started | TBD | Required before enforce-mode | Verify guardrails do not exempt auth-sensitive media code paths | Define guardrail false-positive and budget thresholds |
| MRH2-P8-001 | Surface | P8 | long-tail | Long-tail inventory closure | Non-hot-path surfaces remain inconsistent | Long-tail parity sweep packet | Surface smoke pack | lint,type-check,build,docs:check | Hidden long-tail regressions | Revert isolated surface slices | Not Started | TBD | Required before long-tail parity signoff | Verify long-tail sweeps do not accidentally promote public/static assumptions into signed/private surfaces | Define smoke-pass and regression thresholds for long-tail surfaces |
| MRH2-P9-001 | Surface | P9 | decommission | Legacy adapter retirement criteria | Compatibility paths still live | Legacy routes removed post-gates | Sunset verification tests | lint,type-check,build,docs:check | Hidden consumers remain | Re-enable adapters via revert/kill switch | Not Started | TBD | Required before decommission | Verify retirement does not strand authenticated consumers or leak fallback paths | Define clean-release-window and usage-zero thresholds |

## Merge Discipline
1. One seam per PR.
2. No mixed feature work in hardening slices.
3. Every row needs explicit rollback note before merge.
4. Every row requires evidence link before status moves to `Completed`.
5. Blocked rows must include blocker owner and unblock criterion.
6. Behavior-changing rows must attach rebuild-entry scorecard, security-boundary verification, and performance-parity thresholds before cutover.
