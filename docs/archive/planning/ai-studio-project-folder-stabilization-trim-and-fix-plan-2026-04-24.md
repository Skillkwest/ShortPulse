# AI Studio Project Folder Stabilization, Trim, And Fix Plan (2026-04-24)

Last updated: 2026-04-24  
Status: Historical / Deferred behind active workspace-isolation lane  
Owner: Engineering

> Archived on 2026-04-26 during the docs-cleanup wave. Superseded for active execution by `docs/planning/ai-studio-project-workspace-isolation-bootstrap-and-restore-plan-2026-04-24.md`.

> Active execution note: this folder stabilization plan is no longer the primary Projects contract. Use `docs/planning/ai-studio-project-workspace-isolation-bootstrap-and-restore-plan-2026-04-24.md` for the active lane. This document remains the narrower folder-specific subplan and historical record for the folder reliability work already performed.

## Purpose
This document records the folder-specific stabilization lane that temporarily became the active Projects bottleneck.

At the time of this rewrite, Projects created, loaded, saved, and reopened well enough that the dominant visible user-facing failure sat inside the Media Library custom-folder lane. The objective of that narrower lane was:
1. make project folders work correctly for saved and unsaved assets,
2. keep folder persistence aligned with the project model already landed in the repo,
3. trim duplicate or dormant folder-specific code that is increasing complexity without product value,
4. stop once the minimum shippable folder contract is reliable.

## Rewrite Trigger
This rewrite is required because the repo and the current browser behavior no longer justify using the broader project stabilization contract as the active lane:
1. signed-in project create/open/save/reopen is now working well enough that it is no longer the top blocker,
2. the current visible failures are concentrated in folder create/use/drop flows,
3. the dominant unresolved defect is the unsaved-reference-to-folder bridge,
4. the repo contains folder-specific duplicate logic and dormant folder-canvas code that can now be trimmed safely or quarantined.

## Repo-Backed Current-State Audit

### What Is Already Landed And Worth Keeping
1. `projects` remains the top-level durable identity.
2. `project_workspace_states` remains the correct restore seam for project workspace/session state.
3. project asset associations already exist for saved media, prompts, and generated outputs.
4. `project_media_folders` and project folder membership tables already exist and are the correct durable authority for custom folders.
5. Media Library root behavior still correctly preserves `All Media` as a user-global inventory surface.

### Current Folder Model
1. Folders are a project-scoped organization layer over durable saved library assets.
2. Folder memberships store saved `media_files` and saved `media_prompts`, not live workspace cards.
3. Project folder tree/content persists independently of the workspace snapshot.
4. Reopening a project restores folder tree and folder contents from folder tables, not from `project_workspace_states`.

### Primary Disconnect
The main disconnect is between how users experience folder drops and how the current code actually stores folder contents:
1. users drag a visible Reference Grid card or other live project reference,
2. folder membership APIs only accept durable saved asset ids,
3. unsaved references therefore must cross a persistence bridge before they can be assigned to a folder,
4. the current Media Library-specific bridge is weak and time-based rather than awaited and deterministic.

### Repo Facts That Drive This Plan
1. `frontend/features/ai-studio/logic/mediaLibraryInternalDropResolver.ts` still uses a Media Library-specific fire-and-poll flow:
   - start `saveReferenceToLibrary(outputId)`,
   - poll local state for saved ids,
   - return `null` if persistence does not surface ids fast enough.
2. unsaved Reference Grid drags usually carry `outputId` and `imageIndex`, not a durable `mediaId`, so they must pass through that bridge.
3. stronger awaited persistence infrastructure already exists elsewhere:
   - `ensureOutputPersisted(...)`
   - shared internal reference handling in `referenceSource/internalReferenceSource.ts`
4. the current tests for `mediaLibraryInternalDropResolver` explicitly permit timeout-to-null behavior, which locks in the current defect instead of preventing it.
5. folder-canvas runtime code is currently dormant in visible UI:
   - `MediaLibraryPanel.tsx` hardcodes the canvas surface off,
   - folder-canvas hook/runtime files are not in the active visible path,
   - but the code, APIs, tests, and docs still exist and add complexity.

## Program Goal
Make the project folder lane reliable without changing the intended UI/UX contract.

That means:
1. users can create and rename project-specific custom folders,
2. users can move and delete project-specific custom folders,
3. users can place saved media and prompts into those folders,
4. users can drop desktop image/video files directly into those folders,
5. character-scoped media remains intentionally excluded from Media Library folders,
6. users can drag an unsaved Reference Grid asset into a folder and have it save once, associate to the active project, and land in the target folder without error,
7. reopening the project restores the folder tree and folder contents correctly,
8. switching projects does not bleed folder tree or folder contents,
9. `All Media` remains global and unchanged.

## Minimum Shippable Folder Contract
This lane is only considered shippable when all of these work:
1. create folder,
2. rename folder,
3. move folder,
4. delete folder,
5. drag saved media into folder,
6. drag saved prompt into folder,
7. drag unsaved reference into folder,
8. desktop file drop/upload into folder,
9. folder contents persist with the project,
10. folders do not bleed across projects,
11. `All Media` stays global.

If any of those eight behaviors are still broken, this lane is not done.

## Explicit Current Blockers
1. dropping an unsaved Reference Grid item into a folder can fail with `Unable to resolve dropped reference.` or equivalent error behavior.
2. the dropped asset can still save later into `All Media`, proving the persistence bridge raced and folder assignment never happened.
3. the Media Library-specific resolver duplicates logic that already exists in a stronger shared internal-drop path.

## Locked Stabilization Decisions
1. Do not redesign the visible Media Library or project model as part of this lane.
2. Keep folders as a project-scoped organization layer over saved media and saved prompts.
3. Keep `All Media` user-global.
4. Keep folder tree/content persistence separate from the workspace snapshot.
5. Character-scoped media remains intentionally isolated from Media Library folders.
5. Treat folders as accepting durable ids only:
   - saved `mediaId`
   - saved `promptId`
6. Any workspace output dropped into a folder must first be converted into a durable asset through the shared awaited persistence path.
7. Trim duplicate logic first; do not trim durable data structures that express the correct product model.
8. Treat folder canvas as non-core for this lane. It must not shape decisions about the visible folder contract.

## Keep / Simplify / Defer Matrix

### Keep
1. `projects`
2. `project_workspace_states`
3. `project_media_items`
4. `project_prompt_items`
5. `project_media_folders`
6. `project_media_folder_media_items`
7. `project_media_folder_prompt_items`
8. global media and prompt inventories

### Simplify
1. Media Library internal drop resolution
2. unsaved reference persistence bridge for folder drops
3. folder membership flow so it always happens after durable ids exist
4. tests that currently encode timeout-to-null folder resolution as acceptable behavior

### Defer Or Demote
1. folder canvas as a product-facing surface
2. broad removal of legacy non-project folder APIs until repo inspection proves no visible surface still depends on them
3. active folder UI selection persistence unless the product explicitly requires it

## Workstreams

### Workstream A: Fix Unsaved Reference -> Folder Flow
Goal:
Make unsaved project references drop into folders reliably.

Why:
This is the main current user-facing blocker.

Scope:
1. replace the Media Library-specific fire-and-poll flow with an awaited persistence contract,
2. ensure folder assignment happens only after a durable `mediaId` or `promptId` exists,
3. make the resulting folder membership write deterministic instead of timing-dependent.

Expected output:
1. unsaved Reference Grid item -> folder works without error,
2. the asset saves once,
3. the asset is associated to the active project,
4. the asset appears in the target folder immediately after resolution completes.

### Workstream B: Remove Duplicate Weak Resolver Logic
Goal:
Collapse Media Library onto the stronger shared internal-drop resolution path.

Why:
The current Media Library-specific resolver is both redundant and the source of the primary bug.

Scope:
1. remove or fully fold `mediaLibraryInternalDropResolver.ts` into the shared internal reference pipeline,
2. standardize folder drop resolution on one flow:
   - resolve source,
   - persist if needed,
   - get durable ids,
   - associate to project,
   - assign to folder,
   - refresh folder contents,
3. rewrite tests so timeout failure is no longer the expected contract.

Expected output:
1. Media Library no longer carries its own weaker save-and-poll resolver path,
2. folder drop behavior matches the stronger shared persistence model already used elsewhere.

### Workstream C: Tighten Folder Membership Semantics
Goal:
Make folder membership behavior explicit and consistent.

Why:
The system is clearer and leaner when folder membership only operates on durable ids.

Scope:
1. audit folder assign/unassign/move paths so they only operate on durable media/prompt ids,
2. confirm already-saved library media, already-saved prompts, and newly persisted references converge into the same membership API,
3. preserve desktop file drop/upload semantics for folder targets,
4. keep character-scoped media exclusion explicit and intentional,
5. improve error handling so folder failures are specific about whether resolution failed or membership failed.

Expected output:
1. folder membership has one clear contract,
2. runtime failures are easier to diagnose,
3. no hidden polling dependency remains.

### Workstream D: Verify Folder Persistence Within Projects
Goal:
Confirm folder persistence behaves correctly inside the broader project model.

Why:
Folders are a project-owned overlay, not the workspace snapshot itself. The lane must prove that boundary works.

Scope:
1. verify project reopen restores:
   - folder tree
   - folder contents
2. verify folders do not bleed across projects,
3. verify `All Media` remains global across projects,
4. explicitly decide whether active folder selection is intentionally ephemeral or needs persistence.

Expected output:
1. folder persistence is correct for the related project,
2. project isolation is clear,
3. the product boundary between workspace restore and folder restore is explicit.

### Workstream E: Trim Safe Fat
Goal:
Reduce folder-lane complexity without removing visible behavior.

Why:
The current lane still carries dormant or duplicative code that increases maintenance cost and confusion.

Scope:
1. remove or quarantine folder-canvas code from the active critical path,
2. keep folder-canvas behavior out of visible folder acceptance criteria,
3. do not remove legacy non-project folder routes yet unless later repo inspection proves no visible surface depends on them.

Expected output:
1. fewer non-core folder surfaces influencing active design and debugging decisions,
2. cleaner critical path around project folders.

### Workstream F: Validation And Acceptance
Goal:
Lock the corrected folder behavior with the right tests and final browser verification.

Why:
Current tests encode the broken resolver contract. The lane is not done until the tests prove the new one.

Scope:
1. add regression coverage for:
   - create/rename/move/delete folder behavior
   - saved media -> folder
   - saved prompt -> folder
   - unsaved reference -> folder
   - desktop file upload -> folder
   - delayed persistence before folder assignment
   - project reopen restores folder tree and contents
   - second project shows no folder bleed
2. run targeted browser validation for:
   - drag from `All Media` into folder
   - drag from Reference Grid into folder
   - reopen project and confirm folder contents persist

Expected output:
1. the minimum shippable folder contract is proven by tests and browser validation,
2. future regressions in folder drop/persistence behavior are caught earlier.

## Execution Order
1. Workstream A: Fix Unsaved Reference -> Folder Flow
2. Workstream B: Remove Duplicate Weak Resolver Logic
3. Workstream C: Tighten Folder Membership Semantics
4. Workstream D: Verify Folder Persistence Within Projects
5. Workstream E: Trim Safe Fat
6. Workstream F: Validation And Acceptance

Reason for this order:
1. the unsaved-reference bridge is the main visible defect,
2. the duplicate weak resolver is the biggest trim opportunity and the strongest direct root cause,
3. membership semantics should be tightened after the shared resolver path is in place,
4. persistence verification is only meaningful once the active drop path is correct,
5. safe trimming should follow the critical fix, not precede it blindly,
6. validation should lock the final contract.

## Validation Requirements
1. regression coverage for create/rename/move/delete folder behavior,
2. regression coverage for saved media -> folder,
3. regression coverage for saved prompt -> folder,
4. regression coverage for unsaved reference -> folder,
5. regression coverage for desktop file upload -> folder,
6. regression coverage for delayed persistence before folder assignment,
7. regression coverage for folder restore on project reopen,
8. project isolation checks proving folder tree and folder contents do not bleed,
9. browser verification proving `All Media` still behaves globally while custom folders remain project-specific.

## Explicit Non-Goals
1. do not redesign the full left-rail library system,
2. do not merge folder state into the workspace snapshot,
3. do not make folders accept non-durable workspace entities directly,
4. do not expand project persistence beyond what is needed for the folder contract,
5. do not continue polishing adjacent Projects behavior unless a new concrete blocker appears.

## Done State
This folder stabilization program is done only when all of the following are true:
1. project folders can be created, renamed, moved, and deleted reliably in normal use,
2. dragging already-saved media from `All Media` into a project folder works,
3. dragging already-saved prompts into a project folder works,
4. dropping supported desktop image/video files into a project folder works,
5. dragging an unsaved Reference Grid item into a project folder works,
6. the unsaved item saves once, associates to the active project, and lands in the target folder without error,
7. folder tree and folder contents restore correctly when the project is reopened,
8. folder tree and folder contents from Project A do not appear in Project B,
9. `All Media` remains user-global and unchanged,
10. character-scoped media remains intentionally excluded from Media Library folder membership,
11. Media Library no longer depends on the special fire-and-poll resolver path,
12. dormant folder-canvas code is either removed or clearly quarantined from the active product path,
13. targeted tests and browser verification prove the minimum shippable folder contract.

## Stop Rule
When the done state above is met:
1. this folder stabilization lane is complete,
2. work on this lane must stop,
3. any further folder work requires a new explicitly scoped follow-up problem statement and better ROI than stopping.

## Relationship To Prior Plans
1. `ai-studio-project-persistence-master-plan-2026-04-23.md` remains the historical buildout contract for the broader Project model.
2. `ai-studio-project-persistence-stabilization-trim-and-fix-plan-2026-04-24.md` remains the historical first stabilization contract for the broader Projects lane.
3. This document supersedes that broader stabilization plan as the active narrow contract for the current repo state because the dominant unresolved issues are now folder-specific.
