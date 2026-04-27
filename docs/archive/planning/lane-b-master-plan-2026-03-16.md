# Lane B Master Plan (2026-03-16)

> Archived on 2026-04-27 during docs cleanup because this completed foundation packet is retained as historical execution context while the active foundation planning surface continues from `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`, `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`, and the remaining active Lane C docs.

Last updated: 2026-03-17  
Status: complete  
Owner: Engineering  
Roadmap anchor: `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`  
Tracker anchor: `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`  
Tracker spec: `docs/archive/planning/lane-b-tracker-spec-2026-03-16.md`

## Summary
Lane B delivers behavior-preserving foundational modularization with strict no-regression and no-bloat control.

Execution is split into two coordinated tracks:
1. `B-Core`: code modularization and boundary hardening for oversized hotspots.
2. `B-Style`: AI Studio style/token/class standardization after core seams stabilize.

Generation pipeline contract/queue hardening is intentionally separated from Lane B and tracked in:
- `docs/archive/planning/generation-pipeline-hardening-master-plan-2026-03-16.md`

The default contract is unchanged user behavior, unchanged API response shapes, and small one-seam PRs.

Closeout evidence:
1. `docs/planning/evidence/lane-b/2026-03-17-b6-01-lane-b-convergence-gate-cycle-2.md`
2. `docs/planning/evidence/lane-b/2026-03-17-b6-01-lane-b-closeout-review.md`

## Baseline Findings (Audit Snapshot)
As of 2026-03-16:
1. Multiple critical hotspots exceed practical maintainability thresholds:
   - `ExpertEditPanelView.tsx` (6368 LOC)
   - `useInpaintMaskController.ts` (1801 LOC)
   - `MediaLibraryPanel.tsx` (2058 LOC)
   - `CharacterManagerShell.tsx` (2749 LOC)
   - `pages/admin/index.tsx` (1660 LOC)
2. Current size-budget guardrails include Lane B domain-specific modes in warn-default posture:
   - `EXPERT_EDIT_SIZE_BUDGET_MODE`
   - `CHARACTER_MANAGER_SIZE_BUDGET_MODE`
   - `ADMIN_HEALTH_SIZE_BUDGET_MODE`
3. Architecture boundary guardrails include Lane B boundary/cycle modes in warn-default posture:
   - `EXPERT_EDIT_BOUNDARY_MODE`
   - `CHARACTER_MANAGER_BOUNDARY_MODE`
   - `ADMIN_HEALTH_BOUNDARY_MODE`
   - `EXPERT_EDIT_CYCLE_MODE`
   - `CHARACTER_MANAGER_CYCLE_MODE`
   - `ADMIN_HEALTH_CYCLE_MODE`
4. Style governance has source-of-truth conflict on panel color (`#1C1F26` doc rationale vs `#1c1f20` runtime/token inventory).
5. Playwright/perf visual audits exist but are credentials-gated and not yet a guaranteed CI-blocking lane.

## Execution Phases
### B0: Governance Bootstrap
1. Publish this master plan plus Lane B tracker spec.
2. Publish ADR for Lane B modularization governance and gate policy.
3. Update SOP baseline (`sop_new_feature_modularization`) with no-regression extraction checklist.
4. Register artifacts in planning/docs indexes and lane tracker pointers.

### B1: Guardrails Before Extraction
1. Add Lane B domain size-budget modes:
   - `EXPERT_EDIT_SIZE_BUDGET_MODE`
   - `CHARACTER_MANAGER_SIZE_BUDGET_MODE`
   - `ADMIN_HEALTH_SIZE_BUDGET_MODE`
2. Expand architecture-boundary checks for new extraction seams with lane modes:
   - `EXPERT_EDIT_BOUNDARY_MODE`
   - `CHARACTER_MANAGER_BOUNDARY_MODE`
   - `ADMIN_HEALTH_BOUNDARY_MODE`
3. Add cycle-detection gate for targeted directories with lane modes:
   - `EXPERT_EDIT_CYCLE_MODE`
   - `CHARACTER_MANAGER_CYCLE_MODE`
   - `ADMIN_HEALTH_CYCLE_MODE`
   Start warn, then enforce after convergence.
4. Lock PR policy:
   - one seam per PR,
   - no cross-domain extraction,
   - no behavior/UI/API changes,
   - measured hotspot reduction required.

### B2: AI Studio Core Modularization (`B-Core`)
1. AI-01: Split `ExpertEditPanelView` into orchestration + focused controllers/presenters; preserve public props.
2. AI-02: Split `useInpaintMaskController` into pure math/state modules + thin orchestration hook.
3. AI-03: Split `MediaLibraryPanel` into controllers + presentation seams.
4. AI-04: Split `AiStudioPageContent` into layout/rail composition modules; preserve prop contract.
5. AI-05: Further slim `/pages/ai-studio.tsx` into page-level wiring hooks; keep orchestrator role only.
6. AI-05 is merge-blocked until Lane A baseline-green signoff; Lane A retains ownership of immediate size-budget gate recovery for this file.

### B3: Character Modularization (`B-Core`)
1. CM-01: Split `CharacterManagerShell` into domain hooks plus presentational shell.
2. CM-02: Split `useCharacterManagerDraft` into feature slices while preserving caller contract.
3. CM-03: Split persistence modules into IO adapters vs pure transforms.

### B4: Admin And Health Modularization (`B-Core`)
1. AH-01: Split `/pages/admin/index.tsx` into tab-specific controller hooks.
2. AH-02: Split `/pages/api/admin/user-health.ts` into lookup/load/analyze/respond modules.
3. AH-03: Split `lib/server/adminUserHealth/fleet.ts` into lifecycle/metrics/persistence/read services with stable entrypoints.

### B5: Style Standardization (`B-Style`)
1. Freeze canonical style contract for phase 1 (including panel baseline token decision).
2. Add semantic/component typography/state token map with compatibility aliases.
3. Migrate AI Studio styles in slices (shell -> controls -> modals/libraries -> create/expert -> inline literals).
4. Add no-new-literals guard script for scoped surfaces with explicit allowlist for intentional dynamic color lanes.
5. Capture visual parity packet per slice using repo-native Playwright audit flow.

### B6: Convergence And Enforcement
1. Promote new Lane B guards from `warn` to `enforce` after two consecutive green cycles.
2. Close lane only after tracker evidence is complete for every slice.
3. Record closeout in evidence packets and foundation-lane tracker notes.

## Merge Gates
Required per slice:
1. `cd frontend && npm run lint`
2. `cd frontend && npm run type-check`
3. `cd frontend && npm run check:architecture-boundary`
4. `cd frontend && npm run check:size-budget`
5. `cd frontend && npm run build`
6. Targeted Vitest suites for touched seams

Lane-level full gate:
1. `cd frontend && npm run test`
2. `cd frontend && npm run docs:check`

## Assumptions And Defaults
1. Small PR slicing is mandatory; scope narrows when parity is uncertain.
2. P0 Reference Grid -> Styles incident remains out of scope except non-behavioral path/import moves required by modularization.
3. Existing completed modularization/governance programs remain baseline and are not reopened unless a touched seam requires it.
4. No new runtime libraries are introduced in Lane B without ADR-approved exception.
5. Queue/submit payload contract hardening and claim-collision remediation are out of scope for Lane B and run under Track P1.
6. Parallel preparatory work is allowed while Lane A is active; behavior-changing or baseline-dependent Lane B merges require baseline-green signoff (already satisfied as of 2026-03-16).
