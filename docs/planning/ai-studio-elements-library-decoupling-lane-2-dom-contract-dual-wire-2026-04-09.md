# AI Studio Elements Library Decoupling Lane 2: DOM And Root Contract Dual-Wire (2026-04-09)

Last updated: 2026-04-10  
Status: Completed  
Owner: Engineering  
Roadmap anchor: `docs/planning/ai-studio-elements-library-decoupling-roadmap-2026-04-09.md`  
Tracker anchor: `docs/planning/ai-studio-elements-library-decoupling-tracker-2026-04-09.md`

## Goal
Introduce Elements-owned root selectors, cluster selectors, and required data-attribute contracts in parallel with the current Character-derived ones so Lane 3 can move style ownership safely.

## Why This Lane Exists
The live Elements panel is still styled through Character root scope and descendant selectors. Lane 3 cannot remove that safely unless Lane 2 first gives Elements its own DOM contract surface.

## In Scope
1. Add an Elements-owned root contract beside `character-manager-page--embedded`.
2. Add Elements-owned selectors for major rendered clusters.
3. Preserve current DOM order, accessibility semantics, and data attributes used by tests/layout logic.
4. Keep Character selectors in place as safety net during the lane.

## Out Of Scope
1. Removing Character selectors.
2. Removing Character stylesheet inheritance.
3. Adjacent picker/avatar/CTA runtime contract changes.
4. Model cleanup.
5. Any rollout flag, feature toggle, canary gate, or temporary runtime switch.

## Required Contract Inventory
### Root contract
Lane 2 must explicitly classify and preserve:
1. `data-active-tab`
2. `data-surface`
3. `data-layout-region`
4. the current embedded root structure used by `ElementsPanel.layout.test.tsx`

### Cluster inventory
#### Cluster A: root shell and workflow chrome
1. panel root
2. workflow tabs row
3. manage/profile shell wrapper

#### Cluster B: manage surface
1. manage panel container
2. list container
3. list card
4. avatar/copy/CTA affordances inside the manage list
5. loading and empty states

#### Cluster C: profile surface
1. sheet container
2. photo/name/alias row
3. description editor mount
4. references heading and grid
5. any dropzone/status affordances

#### Cluster D: cross-surface status and error affordances
1. error shells
2. destructive affordances
3. status copy that is selector-bound

## Primary Files
1. `frontend/features/elements-manager/components/ElementsManagerShell.tsx`
2. `frontend/features/elements-manager/components/ElementsManagerWorkflowTabs.tsx`
3. Elements-owned layout wrapper output introduced in Lane 1 if applicable
4. `frontend/styles/elements-manager.css`
5. `frontend/styles/elements-manager-embedded.css`
6. `frontend/features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx`

## Preferred Execution Order
1. Add Elements-owned root selector contract.
2. Add shell/workflow selectors.
3. Add manage selectors.
4. Add profile selectors, split at least into sheet container, photo/fields row, and references grid.
5. Add loading/error/status selectors.
6. Update tests only as needed to assert the additive contract while preserving old safety-net selectors.

## Acceptance Criteria
1. Every major Elements panel cluster has Elements-owned selectors.
2. `data-active-tab`, `data-surface`, and `data-layout-region` remain intentionally preserved.
3. Character selectors remain in place where still needed for safety.
4. The panel still renders correctly across the required breakpoint matrix.
5. The repo is ready for a style-ownership cutover without another large markup rewrite.

## Validation
### Required
1. `cd frontend && npm run lint`
2. `cd frontend && npx vitest run 'features/ai-studio/components/__tests__/ElementsPanel.layout.test.tsx'`

### Manual parity checks
1. manage view
2. profile view
3. `>=1101`
4. `1280..1101`
5. `<=1180`
6. `<=1100`
7. `<=860`

## Rollback Posture
1. Remove additive Elements selectors in reverse cluster order.
2. Leave Character selectors intact during rollback.
3. Do not start Lane 3 until dual-wired parity is stable.
4. The dual-wire window is structural only. Do not introduce runtime toggles between old and new DOM contracts.

## Exit Gate
Lane 2 is complete when:
1. Elements-owned root and cluster contracts exist everywhere Lane 3 needs them,
2. Character selectors are still present as backup,
3. the panel can begin style cutover without a fresh DOM reshaping pass.
