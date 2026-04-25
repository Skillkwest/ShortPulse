# AI Studio Project Persistence Stabilization, Trim, And Fix Plan (2026-04-24)

Last updated: 2026-04-24  
Status: Historical / Superseded  
Owner: Engineering

> Active execution note: this first stabilization contract has been superseded again for current execution by `docs/planning/ai-studio-project-workspace-isolation-bootstrap-and-restore-plan-2026-04-24.md`. It remains for traceability after the active scope narrowed from general Projects stabilization to the current workspace-isolation/bootstrap lane.

## Purpose
This document records the first stabilization posture that replaced the original forward-expansion sequence for Projects.

The original project-persistence phase plan was directionally correct, and much of it is already landed in the repo. At the time of this rewrite, the current problem was different:
1. core project create/list/open architecture exists,
2. project-owned workspace and asset-association seams exist,
3. project-scoped folder authority exists,
4. but the product flow is still not reliable enough to call Projects working correctly.

This historical plan was therefore not “build more project persistence.” It was:
1. audit what already landed,
2. keep the useful architecture,
3. trim overlapping authority,
4. fix the current blockers,
5. stop when the minimum shippable Projects contract is stable.

## Historical Trigger
This rewrite was required because the repo no longer matched the assumptions of the original execution sequence:
1. the repo already contains most of the originally planned project-persistence building blocks,
2. the dominant failures are now runtime reliability and auth/folder correctness,
3. continuing the original phase-by-phase expansion sequence would add more surface area before the existing saved-project flow is trustworthy.

## Repo-Backed Current-State Audit

### What Is Already Landed And Worth Keeping
1. `projects` create/list/read/update foundation is present.
2. dashboard saved-project surfaces are present.
3. AI Studio has a project-aware entry path.
4. `project_workspace_states` exists as a project-owned restore seam.
5. project-owned association seams for saved media, prompts, and generations exist.
6. project-scoped Media Library custom-folder tables and routes exist.
7. project-scoped folder-canvas persistence exists, but it is still a secondary surface.

### What Is Not Reliable Enough Yet
1. opening a saved project can fail with `Project unavailable / Unauthorized`.
2. folder flows can fail with `Invalid folder id`.
3. `sid`-era session machinery still exists and is not yet clearly out of the durable-authority path.
4. test coverage is too mocked to prove the real signed-in project open/reopen flow.

### Repo Facts That Drive This Plan
1. AI Studio hard-gates the route on owned-project resolution and blocks the page when project read fails.
2. protected project API requests still depend on bearer verification at runtime.
3. the auth system verifies the bearer in the proxy and again in route auth helpers.
4. `fetchWithAuth` does not perform a forced session-refresh retry after `401`.
5. Media Library root behavior still correctly treats `All Media` as the global inventory while custom folders are scoped separately.
6. optimistic folder creation uses pending temporary ids, which can leak into request paths if the client does not normalize them correctly.

## Historical Program Goal
Make Projects work correctly as a product feature before doing any more persistence expansion.

That means:
1. a signed-in user can create a project,
2. open it reliably from the dashboard,
3. see a truly empty new project,
4. use project folders without invalid-id failures,
5. leave and reopen the project,
6. get the same project state back,
7. switch to another project without bleed,
8. do all of this without relying on legacy session persistence as a hidden durable authority.

## Historical Minimum Shippable Projects Contract
Projects are only considered shippable when all of these work:
1. create project,
2. open project,
3. rename project,
4. new project opens empty,
5. saved project reopens correctly,
6. project folders work,
7. `All Media` stays global.

If any of those seven behaviors are still broken, this program is not done.

## Historical Blockers
These are the blocker-class issues this plan is meant to close first:
1. `Project unavailable / Unauthorized` on saved-project open.
2. `Invalid folder id` during project-folder use.

## Historical Architecture Debt To Trim
These are important, but they are not all equal in urgency. They should only be trimmed where they clearly improve the blocker path above.
1. duplicate or overlapping auth verification across proxy and route helpers,
2. `sid` still carrying more conceptual weight than a transient runtime identity should,
3. overlapping restore sources across project state, legacy session state, and browser storage,
4. dormant/secondary folder-canvas persistence remaining close to the critical path.

## Historical Stabilization Decisions
1. Do not add new project-persistence features until the current minimum contract is reliable.
2. Keep the already-landed useful foundations:
   - `projects`
   - `project_workspace_states`
   - project asset-association tables
   - project folder tables
3. Keep left-rail libraries broadly user-global.
4. Keep `All Media` broadly user-global.
5. Keep project-specific custom folders as a separate layer on top of global inventory.
6. Treat folder canvas as secondary and explicitly non-core for this stabilization program.
7. Treat `sid` as a migration/runtime identity only, not as the intended durable restore authority for Projects.

## Historical Keep / Simplify / Defer Matrix

### Keep
1. `projects` identity/domain model
2. dashboard create/list/open surfaces
3. project workspace snapshot contract
4. project media/prompt/generation association seams
5. project folder tables and routes
6. global media and prompt inventories

### Simplify
1. project-open auth path
2. project-route restore authority
3. browser-global persistence participation on project routes
4. error handling for project entry

### Defer Or Demote
1. folder canvas as a product-facing surface
2. any non-core persistence expansion beyond the minimum shippable contract
3. any deeper library redesign beyond project custom folders

## Historical Workstreams

### Workstream A: Stabilize Project Open
Goal:
Make opening a saved project reliable for normal signed-in users.

Why:
This is the highest-severity current blocker and the first thing that must become trustworthy.

Scope:
1. audit the exact `dashboard -> /ai-studio?projectId=<id> -> /api/projects/:id` path,
2. identify whether the failure is:
   - stale/near-expiry bearer behavior,
   - client session cache drift,
   - route/proxy auth mismatch,
   - project ownership lookup failure,
3. make the entry path resilient enough that one transient auth failure does not surface as a broken Projects feature during normal signed-in use.

Expected output:
1. saved project open no longer fails with the current unauthorized gate in normal use,
2. the project-entry error surface distinguishes permanent failure from recoverable session/auth transitions.

### Workstream B: Simplify Auth Behavior On Project APIs
Goal:
Remove avoidable auth brittleness from the core project flow.

Why:
Current protected project routes are too fragile for a feature that now hard-gates the whole AI Studio route.

Scope:
1. review proxy verification versus route verification for protected project APIs,
2. add the minimal safe recovery behavior needed for normal session/token transitions,
3. reduce duplicated or redundant verification work where it creates reliability cost without meaningful product value.

Guardrail:
Do not weaken ownership or auth guarantees. The change is about reducing brittleness, not reducing security.

Expected output:
1. project APIs behave consistently during normal signed-in token/session transitions,
2. auth failures are either recoverable or clearly terminal, not mixed together.

### Workstream C: Fix Folder Runtime Correctness
Goal:
Make project folders work without invalid-id failures or request-path corruption.

Why:
Custom folders are part of the minimum shippable contract, and they currently have a visible runtime failure.

Scope:
1. ensure pending/optimistic folder ids never hit folder-scoped media/prompt reads,
2. audit folder create/select/rename/move/delete flows under project routes,
3. confirm project folder membership works for:
   - images
   - videos
   - audio
   - prompts

Expected output:
1. no `Invalid folder id` error during normal project-folder usage,
2. project folders remain isolated per project,
3. `All Media` remains global.

### Workstream D: Collapse Restore Around Project-Owned Authority
Goal:
Reduce overlapping restore authorities so project reopen is easier to reason about and verify.

Why:
The repo still contains live session-era machinery, which increases ambiguity even after project state exists.

Scope:
1. make `project_workspace_states` the clearly primary restore document for project routes,
2. keep project asset-association seams as support for durable asset resolution,
3. identify project-route code paths still deriving restore behavior from legacy session or browser-global sources,
4. demote those paths where they still behave as hidden project authority.

Expected output:
1. project reopen is primarily explained by project-owned state,
2. `sid` is no longer a meaningful durable authority for project reopen,
3. browser-global persistence is no longer silently restoring project-specific state.

### Workstream E: Trim Non-Core Fat
Goal:
Keep the stabilization program lean and prevent secondary surfaces from driving complexity.

Why:
The current system has more persistence-related surface area than the minimum contract needs.

Scope:
1. demote dormant/secondary paths that are not needed for the minimum contract,
2. keep folder-canvas persistence out of the core ship gate,
3. avoid adding new persistence scope unless it directly supports the minimum contract.

Expected output:
1. fewer hidden dependencies on non-core surfaces,
2. clearer critical path for project create/open/reopen.

### Workstream F: Add Real Acceptance Coverage
Goal:
Add at least one realistic signed-in verification path that proves Projects actually work.

Why:
The current tests are too mocked to catch the browser failure we already have.

Scope:
1. cover:
   - create project
   - open project
   - rename project
   - create/use folders
   - add content/state
   - leave
   - reopen
   - verify isolation with a second project
2. add narrower coverage for auth/session-transition behavior during project open.

Expected output:
1. one realistic flow proves the minimum shippable contract,
2. future regressions in project open/reopen are caught earlier.

## Historical Execution Order
1. Workstream A: Stabilize Project Open
2. Workstream B: Simplify Auth Behavior On Project APIs
3. Workstream C: Fix Folder Runtime Correctness
4. Workstream D: Collapse Restore Around Project-Owned Authority
5. Workstream E: Trim Non-Core Fat
6. Workstream F: Add Real Acceptance Coverage and final done-state audit

Reason for this order:
1. project open is the top blocker,
2. auth is the most likely root cause of the most severe blocker,
3. folders are the next visible blocker,
4. authority cleanup should follow once the main path is stable enough to evaluate,
5. non-core trimming should not happen blindly before the blocker path is understood,
6. realistic acceptance coverage should lock the final system.

## Historical Validation Requirements
1. one signed-in create/open/reopen acceptance path,
2. regression coverage for the project-open auth boundary,
3. regression coverage for optimistic folder creation and folder-scoped media/prompt reads,
4. project isolation checks proving:
   - folders do not bleed,
   - project workspace does not bleed,
   - `All Media` still remains global.

## Historical Non-Goals
1. do not redesign the full left-rail library system,
2. do not add new project-persistence features beyond the minimum contract,
3. do not treat folder canvas as part of the minimum shippable contract,
4. do not continue the original phase-expansion sequence by momentum alone.

## Historical Done State
This stabilization program was considered done only when all of the following were true:
1. dashboard project create/open works reliably,
2. opening `/ai-studio?projectId=...` works reliably for normal signed-in use,
3. the current `Project unavailable / Unauthorized` blocker is gone,
4. a new project opens clean with:
   - no carried-over Reference Grid state,
   - no carried-over Quick Slot state,
   - no carried-over canvas/workspace state,
   - no carried-over custom folders,
5. saved projects restore correctly for:
   - project title,
   - project folders,
   - folder contents,
   - Reference Grid,
   - Quick Slots,
   - canvas/workspace state,
   - relevant project-specific selected state,
6. `All Media` remains globally accessible across projects,
7. project folders are isolated per project,
8. the current `Invalid folder id` blocker is gone from normal folder usage,
9. project routes no longer rely on legacy session persistence as the primary durable authority,
10. at least one realistic signed-in verification flow proves the minimum shippable contract.

## Historical Stop Rule
When the done state above was met:
1. this stabilization program is complete,
2. work on this lane must stop,
3. any further Projects work requires a new explicitly scoped follow-up problem statement.

## Relationship To Prior Plans
1. The original `ai-studio-project-persistence-master-plan-2026-04-23.md` remains useful as the historical buildout contract for the Project model.
2. This document superseded it as the first active execution contract for the broader stabilization lane.
3. The active narrow follow-up for the current repo state is `ai-studio-project-folder-stabilization-trim-and-fix-plan-2026-04-24.md`, which focuses specifically on project folder reliability, unsaved-reference persistence, and safe fat trimming inside the Media Library folder lane.
