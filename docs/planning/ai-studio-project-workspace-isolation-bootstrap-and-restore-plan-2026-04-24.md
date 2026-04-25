# AI Studio Project Workspace Isolation, Bootstrap, And Restore Plan (2026-04-24)

Last updated: 2026-04-24  
Status: Active  
Owner: Engineering

## Purpose
This plan becomes the active execution contract for the current Projects lane.

The repo no longer just has a folder reliability problem. The current top blocker is broader and more fundamental: project-specific workspace state is not isolated correctly during AI Studio bootstrap.

The active objective is therefore:
1. make project route identity authoritative before any project-sensitive hydration runs,
2. make a fresh project with no saved workspace open empty by explicit contract,
3. make project restore rehydrate only the state that belongs to that project,
4. prevent project autosave from capturing leaked pre-bootstrap state,
5. stop once Reference Grid, Quick Slots, and canvas/workspace state are reliably project-specific.

## Rewrite Trigger
This rewrite is required because the repo and current browser behavior no longer justify using the folder-only stabilization lane as the primary active plan:
1. project folder create/drop behavior has improved enough that it is no longer the top blocker,
2. a newly created `Untitled project` can still open with references from another project,
3. the current highest-severity defect sits in project bootstrap, restore, and autosave sequencing,
4. that defect can contaminate the saved workspace for a fresh project, not just the visible UI.

## Repo-Backed Current-State Audit

### What Is Already Landed And Worth Keeping
1. `projects` remains the durable project identity domain.
2. `project_workspace_states` remains the intended durable restore seam for project session/workspace state.
3. project asset association seams already exist for saved media, prompts, and generated outputs.
4. project-scoped folder authority already exists and should remain layered on top of project-owned workspace state.
5. `All Media` remains correctly user-global and is not the source-of-truth for project workspace restore.

### Locked Product Contract
For project routes:
1. Reference Grid is project-specific.
2. Quick Slot Inventory is project-specific.
3. canvas/workspace state is project-specific.
4. opening Project A restores only Project A state,
5. opening Project B restores only Project B state,
6. a new project with no saved workspace opens empty,
7. project autosave must never capture leaked state from another project.

### Primary Repo Findings
1. `useAiStudioProjectIdentity.ts` resolves `projectId` from router query, so AI Studio first mounts with `projectId = null` before the route identity is fully known.
2. `useAiStudioState.ts` still runs user-global visible-output hydration when `projectId` is falsy:
   - `listVisibleGeneratedOutputs()`
   - merged through `mergeCanonicalGeneratedOutputs(...)`
3. the AI Studio project entry gate in `pages/ai-studio.tsx` happens after hooks execute, so it does not prevent that early global hydration.
4. `useAiStudioProjectWorkspaceRestoreCandidate.ts` returns `snapshot: null` / `source: "none"` when a project has no workspace row.
5. `useAiStudioProjectWorkspaceRestoreHydration.ts` treats `snapshot: null` as a no-op rather than an authoritative empty-project apply.
6. `useAiStudioProjectWorkspacePersistenceController.ts` enables project write-shadow once `projectId` and `sessionId` exist, even though bootstrap may not have settled into a known-good project-owned state yet.
7. `useAiStudioWorkflowSettings.ts` still treats `!projectId` as permission to restore sessionStorage-backed workflow settings during the same pending-project boot window.
8. `useAiStudioCreationState.ts` still initializes workflow-sensitive duration and resolution state from sessionStorage on first render before project bootstrap is resolved.
9. `useAiStudioAgentBridge.ts` still reads non-project chat-mode preference when `projectId` is falsy, and `useAiStudioCharacterModeLifecycle.ts` can still read persisted selected-character state in that same window.
10. `useAiStudioPageSessionPersistence.ts` still falls through to the legacy `sid` session-persistence lane whenever `projectId` is temporarily null, so project-route pending bootstrap can still be treated as a non-project session route.

### Most Likely Current Failure Sequence
1. user clicks `New Project` from `/dashboard`,
2. `/ai-studio?projectId=...` mounts,
3. AI Studio still sees `projectId = null` during the first boot window even though a project route was requested,
4. user-global visible outputs hydrate into the Reference Grid,
5. workflow settings, creation-state defaults, chat mode, selected character, and/or legacy session restore can also hydrate from non-project sources during that same window,
6. resolved project has no workspace snapshot,
7. restore applies nothing and does not clear the grid,
8. project write-shadow later snapshots the leaked references into the new project.

### Why This Plan Is Narrow
This is not a broad redesign of Projects.

It is a focused stabilization lane for one exact contract:
1. project route boot must not hydrate user-global outputs,
2. empty project restore must actively clear project content state,
3. project restore and autosave must only operate on project-owned state after bootstrap is complete.

## Program Goal
Make project workspace state reliably isolated per project.

That means:
1. a new project opens empty,
2. a saved project restores only its own Reference Grid, Quick Slots, and canvas/workspace state,
3. switching between projects does not bleed project content state,
4. project autosave never persists leaked pre-bootstrap state,
5. `All Media` stays global without becoming a backdoor project-restore authority.

## Minimum Shippable Project Workspace Contract
This lane is only considered shippable when all of these work:
1. `dashboard -> New Project -> empty Reference Grid`,
2. new project opens with empty Quick Slot Inventory,
3. new project opens with empty canvas/workspace state,
4. opening Project A restores only Project A workspace state,
5. opening Project B restores only Project B workspace state,
6. switching between projects does not leak Reference Grid state,
7. switching between projects does not leak Quick Slot state,
8. switching between projects does not leak canvas/workspace state,
9. project autosave cannot persist leaked bootstrap state into a fresh project,
10. project routes never hydrate from user-global visible-output state.

If any of those ten behaviors are still broken, this lane is not done.

## Explicit Current Blockers
1. new projects can open with references from prior project/global state,
2. `snapshot: null` for a project currently means “do nothing” instead of “apply empty project state,”
3. project write-shadow can come online before project bootstrap is safely complete,
4. pending project routes can still restore workflow settings, creation-state defaults, chat mode, selected character, or legacy session state as if they were non-project routes.

## Locked Stabilization Decisions
1. Do not patch this only at the dashboard entry point.
2. Do not treat this as a folder-only issue.
3. Keep `project_workspace_states` as the primary durable authority for project-specific workspace/session content.
4. Keep folders as a separate project-scoped organization layer over durable assets.
5. Keep `All Media` globally accessible.
6. Treat `snapshot: null` for a project as an authoritative empty-project state, not a no-op.
7. Block project write-shadow until project bootstrap is complete.
8. Keep true user preferences global only where that is explicitly intended.

## Project Content State vs User Preference State

### Project Content State
These must be isolated per project and therefore must reset or hydrate per project:
1. Reference Grid outputs,
2. Quick Slot Inventory composition,
3. canvas/workspace state,
4. project-scoped selected output / active output state,
5. project-scoped workflow/runtime selections that are part of reopen behavior,
6. chat mode when it is restored from project session/workspace state,
7. selected character when it is restored from project session/workspace state,
8. agent runtime state,
9. expert edit session state.

### User Preference State
These may remain global only if intentionally treated as user preferences:
1. shell split width,
2. beginner mode,
3. panel arrangement preferences,
4. other clearly non-content UI conveniences.

This distinction is mandatory for the reset path:
1. aggressively reset project content state,
2. do not blindly wipe true user preferences.

## Keep / Simplify / Defer Matrix

### Keep
1. `projects`
2. `project_workspace_states`
3. project asset association seams
4. project folder authority
5. user-global `All Media`

### Simplify
1. project route bootstrap sequencing,
2. global visible-output hydration gating,
3. empty-project restore behavior,
4. project autosave startup timing

### Defer Or Demote
1. any further folder-specific polishing that does not improve project workspace isolation,
2. deeper legacy `sid` cleanup beyond what is required to stop project-state leakage,
3. any broader project-persistence expansion outside this contract

## Workstreams

### Workstream A: Add Project Boot Gating
Goal:
Make project route identity authoritative before any project-sensitive hydration or autosave starts.

Why:
The current primary leak happens during the pre-project boot window.

Scope:
1. introduce an explicit project boot state that distinguishes:
   - non-project route,
   - project route pending bootstrap,
   - project route ready,
2. define project-route pending bootstrap from route intent, not resolved `projectId` alone,
3. prevent user-global visible-output hydration during project-route pending bootstrap,
4. prevent sessionStorage/localStorage-backed workflow/bootstrap restores during project-route pending bootstrap, including:
   - workflow settings,
   - creation-state duration/resolution initializers,
   - chat mode,
   - selected character,
5. prevent legacy session restore apply during project-route pending bootstrap where it can populate project-sensitive state,
6. prevent project write-shadow from starting during project-route pending bootstrap.

Expected output:
1. project routes no longer briefly behave like non-project routes,
2. no project-sensitive state hydrates before project identity and restore state are known.

### Workstream B: Add Explicit Empty-Project Apply
Goal:
Treat `snapshot: null` for a resolved project as an authoritative empty workspace.

Why:
Current `snapshot: null` behavior leaves stale project content in memory and on screen.

Scope:
1. add one explicit empty-project apply path when project restore is `ready` and `snapshot` is null,
2. reset project content state including:
   - outputs,
   - archived outputs,
   - active output id,
   - quick-slot ids,
   - removed-from-all-refs ids,
   - canvas/workspace state,
   - chat mode,
   - selected character,
   - agent runtime state,
   - expert edit session state,
   - other project-scoped restore-visible content state,
3. keep true user preference state intact.

Expected output:
1. a new project with no saved workspace opens empty by contract,
2. switching into a project with no saved workspace clears prior project content state.

### Workstream C: Delay Project Autosave Until Bootstrap Completes
Goal:
Ensure project write-shadow cannot persist leaked state into a new project.

Why:
The current bug is more severe if autosave records leaked references as the new project’s workspace.

Scope:
1. add a bootstrap completion marker for project routes,
2. only enable project write-shadow after:
   - project identity is resolved,
   - project workspace restore candidate is ready,
   - snapshot hydration applied, or empty-project apply completed,
3. ensure no pre-bootstrap project snapshot write can occur.

Expected output:
1. fresh projects cannot autosave leaked prior-project/global state,
2. project autosave starts from a known-good project-owned state only.

### Workstream D: Audit Full Project-Scoped Surface
Goal:
Verify the same isolation rules cover every intended project-specific workspace surface.

Why:
Reference Grid is the clearest visible failure, but the contract also includes Quick Slots and canvas/workspace.

Scope:
1. verify the boot/apply/reset rules cover:
   - Reference Grid
   - Quick Slot Inventory
   - canvas/workspace state
   - project-scoped runtime selections when they are part of reopen behavior,
2. confirm true user-global surfaces remain outside this reset lane.

Expected output:
1. all intended project-specific workspace surfaces follow the same isolation model,
2. no adjacent project-content surface is left on the wrong side of the bootstrap boundary.

### Workstream E: Validation And Acceptance
Goal:
Lock the corrected project-workspace isolation behavior with the right regression coverage.

Why:
There is not currently enough coverage for the exact `new project opens empty` contract.

Scope:
1. add regression coverage for:
   - project route with unresolved `projectId` does not hydrate global visible outputs,
   - project route with `snapshot: null` applies empty project state,
   - saved project hydrates only its own workspace state,
   - `dashboard -> New Project -> empty state`,
   - Project A -> Project B -> no Reference Grid bleed,
   - Project A -> Project B -> no Quick Slot bleed,
   - Project A -> Project B -> no canvas/workspace bleed,
   - project write-shadow does not persist leaked bootstrap state,
2. run browser verification for:
   - new project opens empty,
   - saved project restores correctly,
   - switching projects preserves isolation.

Expected output:
1. the minimum shippable project-workspace contract is proven by tests and browser verification,
2. future regressions in project bootstrap/isolation are caught earlier.

## Execution Order
1. Workstream A: Add Project Boot Gating
2. Workstream B: Add Explicit Empty-Project Apply
3. Workstream C: Delay Project Autosave Until Bootstrap Completes
4. Workstream D: Audit Full Project-Scoped Surface
5. Workstream E: Validation And Acceptance

Reason for this order:
1. boot sequencing is the highest-confidence primary leak,
2. empty-project apply is the next required contract fix,
3. autosave timing must be fixed before the project route is trustworthy,
4. broader project-scoped surface verification comes after the main leak is closed,
5. validation locks the corrected behavior.

## What We Intentionally Won’t Do
1. no dashboard-only patch,
2. no new project-persistence features,
3. no merge of folder state into the workspace snapshot,
4. no broad schema rewrite unless a real blocker appears,
5. no continued folder-lane polishing unless it directly improves project workspace isolation.

## Done State
This lane is done when:
1. a newly created project with no saved workspace opens empty,
2. saved projects restore only their own Reference Grid, Quick Slots, and canvas/workspace state,
3. opening another project does not leak prior-project state,
4. project routes never hydrate from user-global visible-output state,
5. `snapshot: null` for a project applies a real empty-project reset,
6. project autosave cannot persist leaked pre-bootstrap state,
7. a bootstrap completion marker exists and gates normal project editing/persistence,
8. regression coverage proves the contract.

## Stop Rule
When the done state above is met:
1. this lane is complete,
2. work on this lane must stop,
3. any additional project-persistence work requires a new explicit problem statement with a better ROI than stopping.
