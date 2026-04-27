# AI Studio Elements Library Decoupling Roadmap (2026-04-09)

Last updated: 2026-04-10  
Status: Completed  
Owner: Engineering  
Tracker anchor: `docs/planning/ai-studio-elements-library-decoupling-tracker-2026-04-09.md`

Historical design anchors:
1. `docs/archive/planning/ai-studio-elements-library-ui-build-plan-2026-04-06.md`
2. `docs/archive/planning/ai-studio-elements-library-ui-spec-2026-04-06.md`
3. `docs/planning/ai-studio-elements-library-component-state-map-2026-04-06.md`
4. `docs/archive/planning/ai-studio-elements-library-wireframes-2026-04-06.md`
5. `docs/planning/ai-studio-elements-library-implementation-checklist-2026-04-06.md`

## Purpose
This roadmap rewrites the Elements decoupling program against the live repo, not against the intended architecture.

The repo audit is clear:
1. Elements persistence is mostly feature-owned already.
2. Elements UI/runtime still borrows Character components, selectors, host contracts, and style contracts.
3. Elements-adjacent AI Studio surfaces still reuse Character-shaped CTA and avatar contracts.
4. Hidden clone-era model state still exists behind the current simplified Elements UI.

The program therefore remains a strangler refactor, but the seam inventory and lane order are now stricter.

Completion note:
1. Lanes 1 through 5 are complete.
2. Elements now owns its live shell, host, DOM, style, and active runtime contracts.
3. The remaining reference-set and `deck_reference_urls` residue is bounded to persistence compatibility only.

## Program Goal
Reach a state where:
1. the Elements library owns its panel shell, host contract, component imports, DOM contract, and style contract,
2. adjacent Elements runtime surfaces no longer depend on Character-owned UI contracts by accident,
3. Character route and embedded Character panel behavior remain unchanged,
4. current Elements UI and UX remain materially unchanged,
5. stale Elements compatibility state is resolved only after live runtime decoupling is complete.

Outcome:
1. achieved on 2026-04-10.

## Explicit Non-Goals
1. No redesign of the Elements manage/profile flow.
2. No Character feature redesign or Character cleanup by adjacency.
3. No speculative schema rewrite.
4. No rename churn that does not remove a live dependency.
5. No declaring “full decoupling” while adjacent live Elements consumers still rely on Character contracts.

## Locked Execution Rules
1. The live Elements UI is the parity target until the user approves a redesign.
2. Lane 1 does not count as complete if it only hides Character imports behind pass-through wrappers. New Elements ownership must come from Elements-owned markup or a neutral shared primitive.
3. Lane 2 must cover root selector scope and data-attribute contracts, not only CSS class additions.
4. Adjacent runtime surfaces that still borrow Character CTA or avatar contracts are part of the decoupling path, not late cleanup. They must be handled before the program can claim style/runtime ownership.
5. No rollout flags, feature toggles, canary gates, temporary runtime switches, or config-based fallback paths are allowed anywhere in this program.
6. Each lane must land as a direct deterministic cutover in small reversible slices rather than as a dual-path rollout.
7. `deckReferenceUrls`, reference-set state, and related compatibility structures remain last-lane work unless a previous lane is blocked by them.
8. Stop between lanes if the next step no longer removes a live Elements-to-Character dependency.

## Repo-Backed Audit Lock
### A. Direct UI/runtime import coupling
Elements still imports Character UI components directly:
1. `frontend/features/elements-manager/components/ElementsManagerShell.tsx`
2. `frontend/features/character-manager/components/CharacterCreateWorkspaceSurface.tsx`
3. `frontend/features/character-manager/components/CharacterDescriptionEditorCard.tsx`

### B. AI Studio host and scroll contract coupling
Elements host behavior is split across Elements files plus Character-only host selectors:
1. `frontend/features/ai-studio/components/ElementsPanel.tsx`
2. `frontend/features/ai-studio/hooks/useElementsPanelPropertiesScrollLock.ts`
3. `frontend/features/ai-studio/hooks/useCharacterPanelPropertiesScrollLock.ts`
4. `frontend/styles/ai-studio-properties.css`

Key risk:
1. `.ai-properties > .character-panel-root > .character-manager-page--embedded` has an explicit flex/min-height contract.
2. There is no equivalent Elements-specific root contract today.

### C. Root DOM and data-attribute coupling
The Elements panel still renders Character shell contracts directly:
1. `character-manager-page character-manager-page--embedded`
2. `elements-manager-shell--character-clone`
3. `data-active-tab`
4. `data-surface="panel"`
5. `data-layout-region="sheet"` and `data-layout-region="quickswap"` via shared layout

Primary files:
1. `frontend/features/elements-manager/components/ElementsManagerShell.tsx`
2. `frontend/features/elements-manager/components/ElementsManagerWorkflowTabs.tsx`
3. `frontend/features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx`

### D. Style ownership, import-order, and custom-property coupling
Elements styling is still a Character override layer:
1. `frontend/styles/character-manager.css`
2. `frontend/styles/character-manager-workspace.css`
3. `frontend/styles/character-manager-embedded.css`
4. `frontend/styles/elements-manager.css`
5. `frontend/styles/elements-manager-embedded.css`
6. `frontend/styles/globals.css`

Current structural coupling includes:
1. `.elements-manager-shell--character-clone` scoping in `elements-manager.css`
2. `character-manager-page--embedded` descendant selectors in `character-manager-embedded.css`
3. embedded layout breakpoints living outside Elements-owned stylesheets
4. custom-property/layout assumptions inherited from Character sheets

### E. Adjacent live consumer coupling
The panel is not the only live surface still using Character-shaped contracts:
1. `frontend/features/ai-studio/components/ElementPickerModal.tsx`
2. `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`
3. `frontend/features/ai-studio/components/edit/ExpertEditCharacterPickerModal.tsx`
4. `frontend/styles/ai-studio-character-controls.css`
5. `frontend/features/ai-studio/components/__tests__/VideoPropertiesPanel.test.tsx`
6. `frontend/features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx`

Key shared contracts currently in play:
1. `character-mode-create-btn`
2. `character-mode-create-btn--inline`
3. `character-mode-create-btn-icon`
4. `.ai-character-list-avatar-image`

### F. Stale model and terminology coupling
The UI is simpler than the underlying model:
1. `deckReferenceUrls`
2. `referenceSetState`
3. `activeReferenceSetId`
4. `visibleReferenceSetIds`
5. `referenceSetLabels`
6. `referenceSets`

Primary files:
1. `frontend/features/elements-manager/types.ts`
2. `frontend/features/elements-manager/constants.ts`
3. `frontend/features/elements-manager/hooks/useElementsManagerDraft.ts`
4. `frontend/features/elements-manager/hooks/useElementsManagerViewState.ts`
5. `frontend/features/elements-manager/logic/elementsManagerPersistenceCore.ts`
6. `frontend/features/ai-studio/logic/klingEntityAdapters.ts`
7. `docs/data-dictionary.md`

## Coupling Matrix
| Area | Current owner in practice | Why it blocks full decoupling | Final owner target |
| --- | --- | --- | --- |
| Elements shell imports | Character components | hard runtime coupling | Elements or neutral shared primitive |
| AI Studio host sizing | Character host selector contract | hidden flex/min-height regression risk | Elements panel host contract |
| Root shell and data attributes | Character-shaped shell plus clone scope | Lane 3 cannot cut styles safely without this | Elements-owned root contract |
| Panel layout and breakpoints | Character stylesheets | CSS ownership is not feature-local | Elements stylesheets |
| Picker CTA/avatar contracts | Character or Character-named shared styles | full decoupling claim would be false | intentional shared AI Studio contract or Elements-owned contract |
| Hidden reference-set model | clone-era compatibility state | later cleanup can break adapters/docs if skipped | product-true Elements model |

## Breakpoint And Host Parity Matrix
The program must explicitly preserve these live behaviors:
1. AI Studio embedded host flex/min-height behavior from `frontend/styles/ai-studio-properties.css`
2. workspace layout crossover from `frontend/styles/character-manager-workspace.css`
3. embedded responsive behavior from `frontend/styles/character-manager-embedded.css`
4. Elements-specific responsive overrides from `frontend/styles/elements-manager-embedded.css`

Required parity checkpoints:
1. `>=1101`
2. `1280..1101`
3. `<=1180`
4. `<=1100`
5. `<=860`

## Lane Map
### Lane 1: Primitives And Host Contract
Goal:
1. remove direct Character UI imports from the Elements shell,
2. establish an explicit Elements host contract in AI Studio,
3. preserve the current rendered output.

Key files:
1. `frontend/features/elements-manager/components/ElementsManagerShell.tsx`
2. new Elements-owned component or neutral shared primitive files under `frontend/features/elements-manager/components/`
3. `frontend/features/ai-studio/components/ElementsPanel.tsx`
4. `frontend/features/ai-studio/hooks/useElementsPanelPropertiesScrollLock.ts`
5. `frontend/styles/ai-studio-properties.css`

Plan:
1. `docs/planning/ai-studio-elements-library-decoupling-lane-1-primitives-and-host-contract-2026-04-09.md`

### Lane 2: DOM And Root Contract Dual-Wire
Goal:
1. add Elements-owned root selectors, cluster selectors, and required data-attribute contracts beside the current Character ones,
2. keep the Character contract as safety net until style ownership is ready to move.

Key files:
1. `frontend/features/elements-manager/components/ElementsManagerShell.tsx`
2. `frontend/features/elements-manager/components/ElementsManagerWorkflowTabs.tsx`
3. Elements-owned layout wrapper output if Lane 1 introduced it
4. `frontend/styles/elements-manager.css`
5. `frontend/styles/elements-manager-embedded.css`
6. `frontend/features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx`

Plan:
1. `docs/planning/ai-studio-elements-library-decoupling-lane-2-dom-contract-dual-wire-2026-04-09.md`

### Lane 3: Style Ownership And Adjacent Runtime Contract Cutover
Goal:
1. move live Elements layout/style ownership out of Character stylesheets,
2. replace remaining live Elements-adjacent CTA/avatar runtime contracts that still borrow Character ownership,
3. make the final runtime/style claim true before cleanup lanes begin.

Key files:
1. `frontend/styles/elements-manager.css`
2. `frontend/styles/elements-manager-embedded.css`
3. `frontend/styles/ai-studio-properties.css`
4. `frontend/features/elements-manager/components/ElementsManagerShell.tsx`
5. `frontend/features/elements-manager/components/ElementsManagerWorkflowTabs.tsx`
6. `frontend/features/ai-studio/components/ElementPickerModal.tsx`
7. `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`
8. `frontend/features/ai-studio/components/edit/ExpertEditCharacterPickerModal.tsx`
9. `frontend/styles/ai-studio-character-controls.css`

Plan:
1. `docs/planning/ai-studio-elements-library-decoupling-lane-3-style-ownership-cutover-2026-04-09.md`

### Lane 4: Tests, Docs, And Terminology Cleanup
Goal:
1. align tests, comments, and planning/docs language to the now-decoupled runtime,
2. classify the older 2026-04-06 Elements docs explicitly.

Key files:
1. `frontend/features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx`
2. `frontend/features/ai-studio/components/__tests__/VideoPropertiesPanel.test.tsx`
3. `frontend/features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx`
4. runtime comments in Elements panel files if any remain
5. `docs/README.md`
6. `docs/planning/README.md`
7. older 2026-04-06 Elements planning docs

Plan:
1. `docs/planning/ai-studio-elements-library-decoupling-lane-4-runtime-test-doc-contract-cleanup-2026-04-09.md`

### Lane 5: Data-Model Compatibility Retirement
Goal:
1. classify and resolve stale Elements compatibility state after live runtime decoupling is proven,
2. align persistence, adapters, tests, and docs to the final product-true model.

Key files:
1. `frontend/features/elements-manager/types.ts`
2. `frontend/features/elements-manager/constants.ts`
3. `frontend/features/elements-manager/hooks/useElementsManagerDraft.ts`
4. `frontend/features/elements-manager/hooks/useElementsManagerViewState.ts`
5. `frontend/features/elements-manager/logic/elementsManagerPersistenceCore.ts`
6. `frontend/features/ai-studio/logic/klingEntityAdapters.ts`
7. `frontend/features/elements-manager/logic/__tests__/elementsManagerPersistenceCore.test.ts`
8. `docs/data-dictionary.md`

Plan:
1. `docs/planning/ai-studio-elements-library-decoupling-lane-5-data-model-compatibility-retirement-2026-04-09.md`

Result:
1. completed on 2026-04-10 by flattening the active Elements runtime model, updating adapters/tests/docs, and bounding legacy reference-set storage to persistence only.

## Sequencing Rules
1. Lane 1 must finish before Lane 2 starts.
2. Lane 2 must establish Elements-owned root and cluster contracts before Lane 3 removes any rendering-critical Character selector dependency.
3. Lane 3 must include adjacent live runtime consumers that still borrow Character CTA/avatar ownership. Lane 4 is not allowed to inherit unresolved runtime-style coupling.
4. Lane 4 must stay limited to tests, docs, terminology, and historical-document disposition.
5. Lane 5 remains last unless an earlier lane is blocked by a specific stale-model contract.

## Validation Matrix
### Always required
1. `cd frontend && npm run lint`
2. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx'`

### Required when shared layout primitives move
1. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/CharacterPanel.layout.test.tsx'`
2. `cd frontend && npx vitest run 'features/character-manager/components/__tests__/CharacterManagerShell.layout.test.tsx'`

### Required when adjacent CTA/avatar contracts move
1. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/VideoPropertiesPanel.test.tsx'`
2. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx'`

### Required when persistence/model contracts move
1. `cd frontend && npx vitest run 'features/elements-manager/logic/__tests__/elementsManagerPersistenceCore.test.ts'`

### Required when docs or contract classification changes materially
1. `cd frontend && npm run docs:check`

### Manual parity gates
1. AI Studio `Libraries -> Elements` manage view
2. AI Studio `Libraries -> Elements` profile view
3. manage/profile transitions and rail scroll-lock restore
4. breakpoint matrix at `>=1101`, `1280..1101`, `<=1180`, `<=1100`, and `<=860`
5. AI Studio `Libraries -> Characters`
6. `/character`

## Historical Document Disposition
| Document group | Current posture | Required final posture |
| --- | --- | --- |
| 2026-04-06 Elements build/spec/state-map docs | historical design anchors with Character-clone assumptions | annotate as superseded or keep as historical reference intentionally in Lane 4 |
| 2026-04-09 decoupling packet | active execution packet | source of truth until program closeout |
| `docs/data-dictionary.md` Elements model rows | partially stale to current hidden model | align in Lane 5 |

## Done State
This job is done only when all of the following are true:
1. Elements no longer imports Character UI components directly.
2. Elements no longer relies on Character shell classes or inherited Character selectors to render the panel.
3. AI Studio host behavior for Elements is first-class and explicit.
4. Adjacent live Elements surfaces no longer depend on Character-owned CTA/avatar contracts by accident.
5. Stale Elements compatibility state is either removed or intentionally bounded with a written reason.
6. Character route and embedded Character panel behavior remain unchanged.
7. Required validation for the final touched seams is passing.
8. Remaining work is optional polish, historical wording, or unrelated cleanup rather than a live Elements-to-Character dependency.

## Stop Working Rule
When the Done State above is satisfied:
1. stop the program,
2. do not continue into adjacent cleanup by momentum alone,
3. do not reopen the packet for low-ROI wording or refactor churn,
4. only continue if a new repo-backed dependency, regression, or user-requested scope change appears.
