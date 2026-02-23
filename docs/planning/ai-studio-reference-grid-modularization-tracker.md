# AI Studio Reference Grid Modularization Tracker

Date: 2026-02-23
Authority: Working
Owner: Engineering
Program Doc: `docs/planning/ai-studio-reference-grid-modularization-program.md`

## Status Overview
| Phase | Status | Owner | Start | Target End | Gate | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Phase 0: Contract Freeze | Completed | Frontend | 2026-02-23 | 2026-02-25 | baseline matrix approved | `docs/planning/evidence/reference-grid-modularization/phase-0/` |
| Phase 1: Domain Core | Completed | Frontend | 2026-02-26 | 2026-03-03 | reducer/selectors parity | `docs/planning/evidence/reference-grid-modularization/phase-1/` |
| Phase 2: Ingestion Unification | Completed | Frontend | 2026-03-04 | 2026-03-10 | canonical ingress matrix pass | `docs/planning/evidence/reference-grid-modularization/phase-2/` |
| Phase 3: Projection Semantics | Completed | Frontend | 2026-03-11 | 2026-03-17 | curated semantics parity | `docs/planning/evidence/reference-grid-modularization/phase-3/` |
| Phase 4: Media Runtime Unification | Completed | Frontend + Media | 2026-03-18 | 2026-03-24 | modal/route runtime parity | `docs/planning/evidence/reference-grid-modularization/phase-4/` |
| Phase 5: Canvas + State Decomposition | In Progress | Frontend | 2026-03-25 | 2026-04-02 | size budget targets pass in target lane | `docs/planning/evidence/reference-grid-modularization/phase-5/` |
| Phase 6: Guardrails + Cleanup | Planned | Frontend + DevEx | 2026-04-03 | 2026-04-09 | two green cycles + cleanup complete | `docs/planning/evidence/reference-grid-modularization/phase-6/` |

## Execution Checklist
### Phase 0: Contract Freeze
- [x] Publish contract-freeze artifact for baseline behavior and perf.
- [x] Lock ingress acceptance matrix (picker/drop/paste/library/agent).
- [x] Capture current quick-slot pointer and keyboard behavior expectations.
- [x] Capture modal/route preview/signing parity baseline.
- [x] Confirm no extraction PR merges before freeze signoff.

Exit validation:
- [x] Baseline tests green.
- [x] Perf baseline capture attached.
- [x] Freeze artifact linked and approved.

### Phase 1: Domain Core
- [x] Introduce `ReferenceEntity` discriminated union.
- [x] Introduce normalized `ReferenceState`.
- [x] Add reducer action API and selectors.
- [x] Add `StudioOutput <-> ReferenceEntity` parity adapters.

Exit validation:
- [x] Domain reducer tests green.
- [x] Adapter parity tests green.

### Phase 2: Ingestion Unification
- [x] Create canonical `ReferenceInput` ingestion adapter.
- [x] Route picker/drop/paste/library/agent through canonical adapter.
- [x] Add ingestion acceptance matrix tests.
- [x] Harden ingestion contracts from post-implementation audit (source parity + full/preview semantics).

Exit validation:
- [x] Ingress parity matrix pass.
- [x] No behavior drift in existing flow tests.
- [x] Post-implementation ingestion hardening evidence captured.
- [x] Hold-closure evidence captured for integration + keyboard parity.

### Phase 3: Projection Semantics
- [x] Introduce explicit all/quick-slot/archived projections.
- [x] Remove implicit hidden-delete coupling semantics.
- [x] Preserve curated behavior via compatibility bridge.

Exit validation:
- [x] Curated tests green.
- [x] Archive/restore determinism verified.

### Phase 4: Media Runtime Unification
- [x] Extract shared modal/route preview-sign-retry-download runtime.
- [x] Replace duplicated modal runtime logic.
- [x] Add parity tests for ladder/fallback/retry semantics.

Exit validation:
- [x] Runtime parity tests green.
- [x] No regression in media modal flow tests.

### Phase 5: Canvas + State Decomposition
- [ ] Split `ReferenceCanvas` into view + controller modules.
- [ ] Split `useAiStudioState` reference concerns into domain services.
- [ ] Maintain behavior parity under compatibility flags.

Exit validation:
- [ ] Behavior parity suites green.
- [ ] Target size budgets met in phase target lane.

### Phase 6: Guardrails + Cleanup
- [ ] Promote reference-grid boundary checks to enforce mode.
- [ ] Promote reference-grid target size checks to enforce mode.
- [ ] Remove dead adapters and temporary phase flags.
- [ ] Publish closeout evidence packet.

Exit validation:
- [ ] Two green cycles with enforce mode.
- [ ] No open Sev-1/Sev-2 regressions.
- [ ] Program closeout approved.

## Required Checks Matrix
| Check | Status | Mode | Owner | Notes |
| --- | --- | --- | --- | --- |
| `frontend` | Active | Enforced | Frontend | app and build gate |
| `docs_semantic_drift` | Active | warn/enforce | Docs | existing CI gate |
| `migration_parity` | Active | warn/enforce | Platform | existing CI gate |
| `archive_manifest_check` | Active | warn/enforce | Docs | existing CI gate |
| `architecture_boundary` | Active | warn/enforce | Platform | includes reference-grid lane with `REFERENCE_GRID_BOUNDARY_MODE` |
| `size_budget` | Active | warn/enforce | Frontend | includes target lane with `REFERENCE_GRID_SIZE_BUDGET_MODE` |
| `sql_lint` | Active | warn/enforce | Platform | existing CI gate |
| `deadcode` | Active | Enforced | Platform | existing CI gate |
| `test:adaptive-v2-gate` | Active | Enforced | Frontend | required for protected adaptive/reference paths |

## Blockers And Dependencies
| ID | Dependency | Impact | Owner | Status | Resolution Target |
| --- | --- | --- | --- | --- | --- |
| RG-DEP-01 | Contract freeze signoff | Blocks code extraction | Frontend | Resolved | 2026-02-23 |
| RG-DEP-02 | Keyboard reorder acceptance baseline | Blocks curated accessibility parity closure | Frontend | Resolved | 2026-02-23 |
| RG-DEP-03 | Shared modal/route runtime parity matrix | Blocks phase 4 promotion | Frontend + Media | Resolved | 2026-02-23 |
| RG-DEP-06 | Ingress-to-projection integration test path | Blocks lifting phase-3 kickoff hold | Frontend | Resolved | 2026-02-23 |
| RG-DEP-04 | STG-06 branch-protection enforceability constraint | Blocks production-readiness closeout gating | Engineering Mgmt | Open | TBD |
| RG-DEP-05 | STG-05/STG-06 sequencing compliance | Blocks guardrail enforce promotion if out of sequence | Frontend + DevEx | Open | 2026-04-09 |

## Risk Register Tracker
| Rank | Risk | State | Leading Indicator | Owner | Last Review |
| --- | --- | --- | --- | --- | --- |
| 1 | Hidden regression in legacy-to-domain bridge | Open | parity test diffs | Frontend | 2026-02-23 |
| 2 | Ingestion inconsistency across entry points | Open | matrix test failures | Frontend | 2026-02-23 |
| 3 | Curated semantics drift | Open | curated flow failures | Frontend | 2026-02-23 |
| 4 | Modal/route runtime divergence | Mitigated | media parity failures | Frontend + Media | 2026-02-23 |
| 5 | Guardrails enforce too early | Open | CI failures before decomposition | DevEx | 2026-02-23 |

## Evidence Links
- Program evidence root: `docs/planning/evidence/reference-grid-modularization/`
- Phase report template: `docs/planning/evidence/reference-grid-modularization/phase-report-template.md`
- Phase 0 baseline artifact: `docs/planning/evidence/reference-grid-modularization/phase-0/2026-02-23-phase-00-contract-freeze-baseline.md`
- Phase 1 evidence: `docs/planning/evidence/reference-grid-modularization/phase-1/2026-02-23-phase-01-domain-core-foundation.md`
- Phase 2 evidence: `docs/planning/evidence/reference-grid-modularization/phase-2/2026-02-23-phase-02-ingestion-unification-foundation.md`
- Phase 2 post-implementation audit + external benchmark: `docs/planning/evidence/reference-grid-modularization/phase-2/2026-02-23-phase-02-post-implementation-audit-and-external-benchmark.md`
- Phase 2 hardening evidence: `docs/planning/evidence/reference-grid-modularization/phase-2/2026-02-23-phase-02-hardening-ingestion-contract-parity.md`
- Phase 2 hold-closure evidence: `docs/planning/evidence/reference-grid-modularization/phase-2/2026-02-23-phase-02-hold-closure-integration-and-keyboard-parity.md`
- Phase 3 foundation evidence: `docs/planning/evidence/reference-grid-modularization/phase-3/2026-02-23-phase-03-projection-semantics-foundation.md`
- Phase 3 closeout evidence: `docs/planning/evidence/reference-grid-modularization/phase-3/2026-02-23-phase-03-projection-semantics-closeout.md`
- Phase 4 foundation evidence: `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-media-runtime-unification-foundation.md`
- Phase 4 controller parity slice evidence: `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-media-runtime-controller-parity-slice-2.md`
- Phase 4 preview-recovery controller slice evidence: `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-media-preview-recovery-controller-slice-3.md`
- Phase 4 preview-resolver API parity slice evidence: `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-preview-resolver-api-parity-slice-4.md`
- Phase 4 selection-url resolver parity slice evidence: `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-selection-url-resolver-parity-slice-5.md`
- Phase 4 closeout evidence: `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-media-runtime-unification-closeout.md`
- Phase 5 canvas decomposition foundation slice evidence: `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-foundation-slice-1.md`

## Decision Log
| Date | Decision | Rationale | Owner |
| --- | --- | --- | --- |
| 2026-02-23 | Documentation-first starts with Phase 0 artifacts before extraction | lock behavior and reduce regression risk | Frontend |
| 2026-02-23 | Reference-grid boundary and size checks start in warn lane | staged enforcement while legacy hotspots still large | Frontend + DevEx |
| 2026-02-23 | Hold Phase 3 kickoff pending phase-2 post-implementation hardening deltas | preserve no-regression promotion standard on ingress and quick-slot semantics | Frontend |
| 2026-02-23 | Keep Phase 3 hold active after ingestion hardening until integration + keyboard parity coverage closes | no-regression bar requires flow-level + accessibility parity evidence | Frontend |
| 2026-02-23 | Lift Phase 3 kickoff hold after integration + keyboard parity evidence closure | all hold criteria closed under phase-2 evidence packet | Frontend |
| 2026-02-23 | Start Phase 3 with explicit projection-state foundation + compatibility bridge | decouple semantics first while preserving current UI behavior and rollback safety | Frontend |
| 2026-02-23 | Close Phase 3 after explicit all-refs suppression wiring and quick-slot detach finalization checks | hidden-delete coupling removed, curated/archive parity checks green, and guardrails passed | Frontend |
| 2026-02-23 | Start Phase 4 with shared preview policy extraction (budget + retry caps) | introduce low-risk seam for modal/route runtime unification before controller merge | Frontend |
| 2026-02-23 | Route modal signing-pass runtime through shared signing controller with modal-specific relevance/cap options | remove duplicated sign-pass algorithm while preserving modal retry-cap semantics and telemetry surface separation | Frontend |
| 2026-02-23 | Route modal + route preview recovery fallback through shared recovery controller with modal optimizer callback seam | remove duplicated refresh/retry/hydration logic while preserving no-regression fallback semantics | Frontend |
| 2026-02-23 | Route modal + route preview resolver API request/parsing through shared helper | remove duplicated resolve-previews transport logic while preserving unresolved-id fallback semantics | Frontend |
| 2026-02-23 | Route modal media-selection URL signing through shared selection resolver helper | remove duplicated selection signing candidate logic while preserving canonical storage-path priority behavior | Frontend |
| 2026-02-23 | Close Phase 4 after shared sign/resolve/hydrate helper extraction and parity-gate confirmation | done-state checklist for shared modal/route runtime reached and no-regression gates are green | Frontend |
| 2026-02-23 | Start Phase 5 with ReferenceCanvas view/controller foundation split (card view + clipboard controller extraction) | begin strangler decomposition with low-risk seams and parity-test-backed extraction before state-hook decomposition | Frontend |
