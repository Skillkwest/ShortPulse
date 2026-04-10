# AI Studio Elements Library Decoupling Tracker (2026-04-09)

Last updated: 2026-04-10  
Status: Completed  
Roadmap source: `docs/planning/ai-studio-elements-library-decoupling-roadmap-2026-04-09.md`

## Purpose
This tracker turns the repo-backed Elements decoupling roadmap into lane gates, validation bundles, and stop rules.

It is intentionally narrow:
1. reduce live Elements-to-Character coupling,
2. preserve current Elements UI/UX,
3. protect Character and AI Studio host behavior,
4. keep stale model cleanup behind runtime/style ownership.

## Status Legend
- `Not Started`
- `In Progress`
- `Blocked`
- `Completed`

## Program Snapshot
| Lane | Status | Current Focus | Hard Exit Gate | Blockers | Plan Artifact |
| --- | --- | --- | --- | --- | --- |
| Audit Lock | Completed | Repo-backed seam inventory complete across host/runtime, DOM/data attributes, CSS/load order, adjacent consumers, and stale model state | Packet reflects live repo, not intended architecture | none | roadmap + tracker |
| 1 | Completed | Elements-owned workspace/layout and description-editor primitives landed; Elements host sizing/scroll behavior made explicit | `ElementsManagerShell` no longer imports Character UI components directly and `elements-panel-root` has explicit host contract | none | `docs/planning/ai-studio-elements-library-decoupling-lane-1-primitives-and-host-contract-2026-04-09.md` |
| 2 | Completed | Elements-owned root selectors, cluster selectors, and required data attributes were dual-wired beside existing contracts | Elements-owned root and cluster contracts exist for every major panel region without removing Character safety net | none | `docs/planning/ai-studio-elements-library-decoupling-lane-2-dom-contract-dual-wire-2026-04-09.md` |
| 3 | Completed | Elements panel runtime/style ownership now lands entirely on Elements-owned shell, workspace, and panel selectors | Elements panel and adjacent live Elements surfaces no longer depend on Character-owned rendering/style contracts | none | `docs/planning/ai-studio-elements-library-decoupling-lane-3-style-ownership-cutover-2026-04-09.md` |
| 4 | Completed | Tests, packet indexes, and historical 2026-04-06 docs now reflect the post-cutover Elements architecture accurately | No misleading runtime/test/doc language remains; historical docs intentionally classified | none | `docs/planning/ai-studio-elements-library-decoupling-lane-4-runtime-test-doc-contract-cleanup-2026-04-09.md` |
| 5 | Completed | Active Elements runtime model flattened; persistence compatibility bounded; adapters/tests/docs aligned | Final model recorded and all downstream consumers aligned | none | `docs/planning/ai-studio-elements-library-decoupling-lane-5-data-model-compatibility-retirement-2026-04-09.md` |

## Audit Lock Checklist
- [x] Direct Character UI imports mapped.
- [x] AI Studio host flex/min-height and scroll-lock dependencies mapped.
- [x] Root selector and data-attribute contracts mapped.
- [x] Character stylesheet/load-order/custom-property dependence mapped.
- [x] Adjacent CTA/avatar consumer surfaces mapped.
- [x] Stale model/doc coupling mapped.

## Live Invariants
Every lane must satisfy:
1. no intentional Elements UI/UX change,
2. no Character regression,
3. no class deletion before replacement selectors exist,
4. no declaring style/runtime ownership complete while adjacent live Elements consumers still borrow Character-owned contracts,
5. no rollout flags, feature toggles, canary gates, temporary runtime switches, or config-based fallback paths,
6. no stale-model cleanup before runtime/style decoupling is proven,
7. a narrow rollback note and a lane-specific validation bundle for every slice.

## Breakpoint And Host Gates
Every panel-affecting lane must re-check:
1. `>=1101`
2. `1280..1101`
3. `<=1180`
4. `<=1100`
5. `<=860`

Every host-affecting lane must re-check:
1. `elements-panel-root` flex/min-height behavior in AI Studio
2. manage/profile transition scroll-lock apply and restore
3. Character panel parity if shared host/layout code moved

## Lane Checklists
### Lane 1
- [x] Elements-owned workspace/layout wrapper created or neutral primitive extracted safely.
- [x] Elements-owned description editor implementation created without pass-through Character re-export.
- [x] `ElementsManagerShell` no longer imports Character UI components directly.
- [x] `ElementsPanel` host root contract is explicit enough to survive later shell-class removal.
- [x] `useElementsPanelPropertiesScrollLock` preserves manage/profile parity with the Character panel hook.
- [x] Character parity tests pass if a shared primitive moves.

### Lane 2
- [x] Elements-owned root contract added beside `character-manager-page--embedded`.
- [x] Elements-owned selectors added for shell, manage, profile, references, loading, and error clusters.
- [x] `data-active-tab`, `data-surface`, and `data-layout-region` contracts are preserved and intentionally classified.
- [x] Character selectors remain in place as safety net.
- [x] Elements panel parity holds across required breakpoints.

### Lane 3
- [x] Elements panel renders correctly through Elements-owned selectors and stylesheets.
- [x] `.elements-manager-shell--character-clone` is removed or no longer rendering-critical.
- [x] `character-manager-page--embedded` is no longer rendering-critical for Elements.
- [x] Adjacent live consumers using `character-mode-create-btn*` and shared avatar contracts are moved to intentional shared ownership or Elements-owned ownership.
- [x] Video/Create picker consumer tests pass if avatar/CTA contracts move.
- [x] Remaining Character rendering/style dependencies are empty or explicitly documented as intentional shared primitives.

### Lane 4
- [x] Elements runtime comments no longer describe the feature as Character-derived or clone-based.
- [x] Tests assert final behavior, not transitional clone architecture.
- [x] `docs/README.md` and `docs/planning/README.md` describe the packet accurately.
- [x] 2026-04-06 Elements docs are annotated, retained, or archived intentionally.

### Lane 5
- [x] Phase 5A symbol classification complete.
- [x] Phase 5B runtime simplification complete.
- [x] Phase 5C persistence/docs/tests closeout complete.
- [x] Final disposition recorded for `deckReferenceUrls`.
- [x] Final disposition recorded for reference-set state family.
- [x] Adapters and persistence tests reflect the final model.

## Stale Symbol Disposition Table
| Symbol | Keep | Alias | Collapse | Remove | Status |
| --- | --- | --- | --- | --- | --- |
| `deckReferenceUrls` | [ ] | [x] | [ ] | [ ] | bounded persistence alias only |
| `referenceSetState` | [ ] | [ ] | [x] | [ ] | collapsed to single persistence compatibility structure |
| `activeReferenceSetId` | [ ] | [ ] | [ ] | [x] | removed from active runtime |
| `visibleReferenceSetIds` | [ ] | [ ] | [ ] | [x] | removed from active runtime |
| `referenceSetLabels` | [ ] | [ ] | [ ] | [x] | removed from active runtime |
| `referenceSets` | [ ] | [ ] | [x] | [ ] | collapsed behind persistence compatibility boundary |

## Risk Register
### R1: AI Studio host regression
Mitigation:
1. establish explicit Elements host sizing rules before shell-class removal,
2. validate `useElementsPanelPropertiesScrollLock` against Character parity,
3. keep host changes additive until proven.

### R2: Wrapper indirection hides coupling instead of removing it
Mitigation:
1. do not count pass-through wrapper re-exports as decoupling,
2. require Elements-owned markup or a neutral shared primitive,
3. run Character parity tests if shared extraction happens.

### R3: DOM/class migration outruns style coverage
Mitigation:
1. dual-wire root selectors and cluster selectors before any deletion,
2. keep Character selectors as safety net through Lane 2,
3. verify explicit breakpoint matrix, not just one viewport.

### R4: Adjacent CTA/avatar consumers regress during cutover
Mitigation:
1. treat picker/create-button/avatar contracts as live runtime work in Lane 3,
2. run Video/Create picker tests when those contracts move,
3. include Character-only picker surfaces in the same validation bundle if a shared contract is re-homed.

### R5: Stale model cleanup breaks adapters or docs
Mitigation:
1. split Lane 5 into classification, runtime simplification, and closeout phases,
2. keep a symbol until all known consumers are accounted for,
3. update persistence tests and data dictionary in the same lane.

### R6: Rollout mechanics introduce permanent complexity
Mitigation:
1. do not use feature flags, toggles, or canaries,
2. prefer small deterministic cutovers with immediate validation,
3. use narrow rollback-friendly slices instead of dual-path runtime logic.

## Validation Matrix
### Core bundle
1. `cd frontend && npm run lint`
2. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx'`

### Shared layout bundle
1. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/CharacterPanel.layout.test.tsx'`
2. `cd frontend && npx vitest run 'features/character-manager/components/__tests__/CharacterManagerShell.layout.test.tsx'`

### CTA/avatar consumer bundle
1. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/VideoPropertiesPanel.test.tsx'`
2. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx'`

### Persistence/model bundle
1. `cd frontend && npx vitest run 'features/elements-manager/logic/__tests__/elementsManagerPersistenceCore.test.ts'`

### Docs bundle
1. `cd frontend && npm run docs:check`

## Slice Template
Use this for each implementation slice:

### Slice ID
- `lane`:
- `scope`:
- `date`:

### Goal
- dependency being removed:

### Files
- touched:
- explicit non-goals:

### Validation
- command bundle used:
- results:

### Rollback
- revert strategy:
- trigger conditions:

### Outcome
- coupling reduced:
- user-visible change:
- residual dependency intentionally kept:

## Program Done State
Mark the overall job done only when:
1. Lane 1 through Lane 5 are completed or intentionally closed with written justification.
2. Elements owns its live shell, host, DOM, style, and adjacent runtime contracts.
3. No repo-backed Character dependency still materially shapes the Elements experience.
4. Any retained compatibility residue is explicitly bounded and documented.
5. Final required validation for the touched seams is green.
6. Remaining work is optional polish, historical wording, or unrelated cleanup.

## Final Stop Rule
Once the Program Done State is satisfied:
1. stop working on this program,
2. do not continue with opportunistic cleanup,
3. do not create new follow-on lanes unless a new repo-backed dependency or user-requested scope change is identified.
