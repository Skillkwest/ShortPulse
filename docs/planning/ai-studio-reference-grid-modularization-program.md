# AI Studio Reference Grid Modularization Program (Foundation v1)

Date: 2026-02-23
Authority: Working
Owner: Frontend + AI Studio Engineering
Status: Active
Tracker: `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Summary
This program modularizes AI Studio Reference Grid foundations with a documentation-first, no-regression delivery model.

The scope covers:
1. Reference Grid domain state and projections.
2. Quick Slot inventory semantics.
3. Ingestion paths for file picker, drop, paste, media library, and agent add-to-grid.
4. Shared preview/signing/retry runtime parity between AI Studio modal and Media Library route.

The delivery model is phased strangler extraction with compatibility adapters, explicit gate criteria, rollback-first operations, and evidence capture at each phase.

## Governance Dependencies And Stage Mapping
This program is aligned to the existing governance rollout contract:
1. Structural work maps to `STG-05` (`docs/planning/stages/stage-05-structural-modularization.md`).
2. Guardrail promotion/closeout maps to `STG-06` (`docs/planning/stages/stage-06-ci-policy-enforcement.md`).
3. Final signoff must align with `STG-08` closeout controls (`docs/planning/stages/stage-08-final-validation-signoff.md`).

Plan-tier constraint:
1. Branch-level required-check enforcement is currently constrained by repository plan tier.
2. CI enforce-mode evidence is mandatory until branch-level enforcement constraints are resolved.
3. This constraint is tracked in STG-06 evidence and remains a production-readiness dependency.

## Goals And Non-Goals
### Goals
1. Eliminate multi-responsibility coupling in reference-grid state and runtime modules.
2. Introduce explicit domain contracts for references, ingestion, projections, and drag/drop protocol.
3. Keep current behavior and UX semantics stable while modularizing.
4. Enforce boundary and size guardrails with staged warn-to-enforce rollout.
5. Preserve current adaptive media/perf controls and operational SOP compliance.

### Non-goals
1. No schema migration in this program.
2. No Next.js routing migration.
3. No product-scope expansion beyond reference-grid modularization.
4. No replacement of existing adaptive-media policy system.

## Architecture Invariants
1. Reference Grid remains behavior-parity compatible during migration.
2. One active extraction phase at a time.
3. Rollback path is verified before phase promotion.
4. No release promotion past failed required checks.
5. Reference domain modules remain UI-agnostic and side-effect free.
6. Ingestion normalizes all entry points through one canonical contract.
7. Quick Slot inventory is explicit projection state, not implicit delete/hide behavior.
8. Shared media runtime behavior remains deterministic across modal and route surfaces.

## Current-State Hotspots And Risk Statement
Current hotspot files:
- `frontend/features/ai-studio/components/ReferenceCanvas.tsx` (~3450 lines)
- `frontend/features/ai-studio/components/MediaLibraryModal.tsx` (~1466 lines)
- `frontend/features/ai-studio/hooks/useAiStudioState.ts` (~1206 lines)

Risk statement:
1. Current coupling concentrates rendering, orchestration, ingestion, and media lifecycle concerns in a few files.
2. Feature work and bug fixes carry high regression risk due to mixed responsibilities and duplicated runtime logic.
3. Immediate hard enforcement of final size targets would fail current CI and block phased migration.

## Target Module Topology And Dependency Boundaries
| Module | Path | Responsibility | Allowed Dependencies | Forbidden Dependencies |
| --- | --- | --- | --- | --- |
| Reference Domain | `frontend/features/ai-studio/reference-domain/` | Canonical entities, reducer, invariants, selectors | TS stdlib, shared pure utils | React components, pages, modal/canvas UI |
| Reference Ingestion | `frontend/features/ai-studio/reference-ingestion/` | Normalize file/drop/paste/library/agent inputs | reference-domain, pure parsers | UI components and page orchestration |
| Reference Projections | `frontend/features/ai-studio/reference-projections/` | all refs / quick slots / archived derived views | reference-domain | upload/signing side effects |
| Reference DnD | `frontend/features/ai-studio/reference-dnd/` | versioned drag payload schema + parser/serializer | reference-domain types | component-local ad hoc payload logic |
| Reference Media Runtime | `frontend/features/ai-studio/reference-media-runtime/` | preview/sign/retry/download runtime adapters | adaptive media core, pure helpers | page-level orchestration and reducer internals |
| Reference Grid Controllers | `frontend/features/ai-studio/reference-grid/controllers/` | UI interaction controllers (paste/drop/split/archive) | reference-domain/selectors/ingestion/runtime | direct persistence mutations |
| Reference Grid View | `frontend/features/ai-studio/reference-grid/components/` | presentational rendering | controller props and style modules | business logic and side-effect orchestration |
| Compatibility Adapters | `frontend/features/ai-studio/reference-compat/` | `StudioOutput` parity bridge and migration shims | reference-domain and legacy state shape types | importing new modules back into legacy monolith internals |

## Public Interfaces, Types, And Contracts
### Canonical domain entities
`ReferenceEntity` discriminated union:
- `upload`
- `libraryMedia`
- `generated`
- `promptReference`

### Canonical domain state
`ReferenceState` normalized shape:
- `ids`
- `entities`
- `quickSlotIds`
- `archivedIds`
- `meta`

### Canonical ingestion contract
`ReferenceInput` union:
- `filePicker`
- `drop`
- `paste`
- `mediaLibrary`
- `agent`

### Reducer action API
- `addMany`
- `remove`
- `archive`
- `restore`
- `setQuickSlots`
- `reorderQuickSlots`
- `setStatus`
- `hydrateMedia`

### Projection selector API
- `selectAllRefs`
- `selectQuickSlots`
- `selectArchivedRefs`
- `selectVisibleGrid`

### DnD protocol contract
One versioned payload schema for canvas and shell transfer paths.

### Transitional parity bridge
Compatibility adapters maintain `StudioOutput <-> ReferenceEntity` parity until final cutover.

## Temporary Migration Flags Lifecycle Policy
| Flag | Owner | Default | Create Date | Sunset Date | Retirement Gate |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_REFERENCE_GRID_DOMAIN_BRIDGE` | Frontend | `false` | 2026-02-26 | 2026-04-09 | Phase 6 parity + two green cycles |
| `NEXT_PUBLIC_REFERENCE_GRID_INGESTION_UNIFIED` | Frontend | `false` | 2026-03-04 | 2026-04-09 | Phase 6 ingress matrix pass |
| `NEXT_PUBLIC_REFERENCE_GRID_PROJECTION_V2` | Frontend | `false` | 2026-03-11 | 2026-04-09 | Phase 6 curated semantics parity |
| `NEXT_PUBLIC_REFERENCE_GRID_MEDIA_RUNTIME_SHARED` | Frontend | `false` | 2026-03-18 | 2026-04-09 | Phase 6 modal/route runtime parity |
| `NEXT_PUBLIC_REFERENCE_GRID_CONTROLLER_SPLIT` | Frontend | `false` | 2026-03-25 | 2026-04-09 | Phase 6 behavior + perf parity |

## Phase Plan
| Phase | Window | Scope | Definition Of Done | Required Tests | Evidence Requirement |
| --- | --- | --- | --- | --- | --- |
| Phase 0: Contract Freeze | 2026-02-23 to 2026-02-25 | Baseline behavior matrix and perf baseline | Contract freeze artifact approved; no extraction PR merged | existing targeted suites + perf audit capture | `docs/planning/evidence/reference-grid-modularization/phase-0/` |
| Phase 1: Domain Core | 2026-02-26 to 2026-03-03 | Add `reference-domain` types/reducer/selectors + parity adapters | Reducer parity and selector parity green | new domain unit tests + parity bridges | `docs/planning/evidence/reference-grid-modularization/phase-1/` |
| Phase 2: Ingestion Unification | 2026-03-04 to 2026-03-10 | One ingestion builder for all entry points | All ingress paths produce canonical parity outputs | ingestion contract matrix tests | `docs/planning/evidence/reference-grid-modularization/phase-2/` |
| Phase 3: Projection Semantics | 2026-03-11 to 2026-03-17 | Explicit all/quick-slot/archive projections | Hidden-delete ambiguity removed; curated parity green | curated tests + projection tests | `docs/planning/evidence/reference-grid-modularization/phase-3/` |
| Phase 4: Media Runtime Unification | 2026-03-18 to 2026-03-24 | Shared preview/sign/retry/download runtime | Modal and route runtime parity green | media runtime parity + modal tests | `docs/planning/evidence/reference-grid-modularization/phase-4/` |
| Phase 5: Canvas + State Decomposition | 2026-03-25 to 2026-04-02 | Split canvas/state responsibilities | Size budgets pass in warn or enforce target lane; behavior parity unchanged | canvas/state parity and integration flows | `docs/planning/evidence/reference-grid-modularization/phase-5/` |
| Phase 6: Guardrails + Cleanup | 2026-04-03 to 2026-04-09 | Enforce new boundary/size checks, remove dead adapters/flags | Two green cycles; no Sev-1/Sev-2 regressions; cleanup complete | full gate suite + perf audits | `docs/planning/evidence/reference-grid-modularization/phase-6/` |

## Required CI Checks And Promotion/Freeze Rules
### Required checks
1. `frontend`
2. `docs_semantic_drift`
3. `migration_parity`
4. `archive_manifest_check`
5. `architecture_boundary`
6. `size_budget`
7. `sql_lint`
8. `deadcode`
9. `test:adaptive-v2-gate`

### Promotion rules
1. All required checks must be green.
2. Phase evidence packet must be complete.
3. Rollback path must be validated in the phase report.
4. Perf audit gates must pass for reference-grid impact phases.
5. STG-06 branch-protection mapping evidence must remain current.

### Freeze rules
Freeze immediately on any of:
1. parity test failure.
2. perf gate failure.
3. Sev-1 or Sev-2 regression.
4. docs/runtime mismatch in phase packet.

## Rollback Playbooks
| Scenario | Trigger | Immediate Action | Recovery Target |
| --- | --- | --- | --- |
| Domain parity regression | Failing reducer/adapter parity tests | Disable domain bridge flag and revert phase PR | <= 30 minutes |
| Ingestion behavior drift | Ingress matrix mismatch across entry points | Disable ingestion flag and restore legacy constructor path | <= 30 minutes |
| Curated semantics regression | quick-slot/archive behavior mismatch | Disable projection flag and re-enable legacy projection path | <= 30 minutes |
| Media runtime regression | modal/route preview mismatch, signing fallback failure | Disable shared runtime flag and restore prior runtime split | <= 30 minutes |
| Performance regression | audit gate breach at target dataset | freeze promotion, roll back latest phase change, run incident checklist | <= 60 minutes |

## Test Matrix
| Layer | Required Scenarios |
| --- | --- |
| Unit | domain reducer, selectors, DnD protocol, ingestion normalization |
| Integration | add-files (picker/drop), paste text/media, media-library select, quick-slot reorder/remove, archive/restore |
| Accessibility | pointer and keyboard quick-slot reorder parity |
| Performance | `runReferenceGridAudit`, `runStudioShellAudit` gate thresholds |
| Parity | `StudioOutput` bridge parity, media runtime modal/route parity |

## Risk Register
| Rank | Risk | Leading Indicator | Owner | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | Hidden behavior change during extraction | parity suite failures | Frontend | strangler adapters + contract freeze |
| 2 | Ingestion drift between entry points | matrix mismatch | Frontend | canonical ingestion adapter + fixture matrix |
| 3 | Quick-slot semantics regressions | curated tests failing | Frontend | explicit projection selectors + compatibility bridge |
| 4 | Modal/route runtime divergence | parity mismatches in signing/retry flows | Frontend + Media | shared runtime with parity assertions |
| 5 | CI guardrails block rollout prematurely | hard-fail on future budgets before decomposition | DevEx | staged warn-to-enforce policy for reference-grid budgets |
| 6 | Perf degradation under 50-60 refs | perf audit threshold misses | Frontend | retain existing adaptive/perf guardrails during migration |

## Decision Log
| Date | Decision | Alternatives | Rationale |
| --- | --- | --- | --- |
| 2026-02-23 | Documentation-first execution | code-first extraction | lower regression risk and stronger coordination |
| 2026-02-23 | Reducer + selectors domain model | external state library | no new dependencies and predictable transitions |
| 2026-02-23 | Staged warn-to-enforce guardrail rollout | immediate strict enforcement | avoids blocking while current hotspots exceed future targets |
| 2026-02-23 | Compatibility adapters until Phase 6 | big-bang cutover | safer rollback and lower blast radius |

## Assumptions And Locked Defaults
1. No new external state library.
2. No schema migration in this program.
3. No route additions are expected.
4. Documentation-first execution is mandatory before code extraction.
5. Zero-regression means no unplanned behavior change and no promotion past failed gates.
6. Program docs remain under `docs/planning/` with `Authority: Working` until closeout.

## External Best-Practice References
1. React reducer extraction: https://react.dev/learn/extracting-state-logic-into-a-reducer
2. Redux normalized state shape: https://redux.js.org/usage/structuring-reducers/normalizing-state-shape
3. Redux Toolkit entity adapter: https://redux-toolkit.js.org/api/createEntityAdapter
4. TypeScript discriminated unions: https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html
5. WAI-ARIA keyboard interaction patterns: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
6. WAI-ARIA rearrangeable listbox example: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/examples/listbox-rearrangeable/
7. Martin Fowler strangler pattern: https://martinfowler.com/bliki/StranglerFigApplication.html
8. Testing Library guiding principles: https://testing-library.com/docs/guiding-principles/
