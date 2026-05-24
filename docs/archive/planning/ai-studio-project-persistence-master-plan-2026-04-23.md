# AI Studio Project Persistence Master Plan (2026-04-23)

Last updated: 2026-04-24  
Status: Historical buildout contract; superseded for active execution by `docs/planning/ai-studio-project-workspace-isolation-bootstrap-and-restore-plan-2026-04-24.md`  
Owner: Engineering

> Archived on 2026-04-26 during the docs-cleanup wave. Superseded for active execution by `docs/planning/ai-studio-project-workspace-isolation-bootstrap-and-restore-plan-2026-04-24.md`.

> Active execution note: use `docs/planning/ai-studio-project-workspace-isolation-bootstrap-and-restore-plan-2026-04-24.md` as the current stabilization contract. This original master plan remains the historical buildout record for the broader Projects program.

## Summary
This program replaces the remaining AI Studio session-persistence skeleton with a real `Project` model.

The program is intentionally narrow:
1. `Project` becomes the top-level durable identity for AI Studio save/open behavior.
2. Opening a saved project must restore one coherent project session.
3. Left-rail libraries remain broadly user-global.
4. `All Media` remains the user-global media inventory.
5. The project-specific layer is introduced on top of that global inventory rather than by redesigning every library table into a project-local system.

## Program Goal
Ship a project model that behaves the way the product contract now requires:
1. the dashboard creates real user-owned projects,
2. a new project opens empty,
3. reopening a saved project restores that same project’s working state,
4. project title and custom Media Library folders are isolated per project,
5. project restore no longer depends on legacy session persistence as the primary user-facing durable authority.

## Locked Product Contract

### Project Identity
1. `Project` is the durable top-level AI Studio identity.
2. Clicking `New Project` from `/dashboard` creates a real user-owned `projects` row in Supabase.
3. Clicking a saved project from the dashboard reopens that project’s saved AI Studio session.

### New Project Behavior
1. A brand new project starts empty.
2. Empty means:
   - no Reference Grid content,
   - no Quick Slot Inventory content,
   - no project canvas/workspace content,
   - no project-specific folders yet.

### Left-Rail Library Behavior
1. Left-rail libraries remain broadly user-global and available across projects.
2. This includes:
   - Media Library browse inventory,
   - Characters,
   - Elements,
   - Pulse Presets,
   - Prompt Presets,
   - Styles.
3. This program does not convert those full libraries into project-local systems.

### Media Library Behavior
1. The Media Library keeps its current broad shape:
   - top folder area,
   - bottom `All Media` browse area,
   - familiar folder creation and assignment behavior.
2. The project-specific layer is the top folder area only:
   - project title is project-specific,
   - custom folders are project-specific,
   - items placed into those folders are project-specific memberships.
3. `All Media` remains globally accessible in every project.
4. Project folders may contain:
   - images,
   - videos,
   - audio,
   - prompts.
5. “Reference cards” are not a distinct durable master type in this program; that phrase refers to media shown in the Reference Grid.

### Restore Contract
Opening a saved project must restore one coherent project session. At minimum, restore must include:
1. project title,
2. project folder tree,
3. project folder memberships,
4. Reference Grid composition,
5. Quick Slot Inventory composition,
6. canvas/workspace state,
7. relevant Create/Edit selected state,
8. durable references to the media and prompts required to render that project again.

## Current-State Repo Audit
The repo still reflects the old session-era model in several important places:
1. `sid` is still the primary AI Studio page/session identity through `useAiStudioSessionIdentity`.
2. The visible “project name” is still driven by session-era state and snapshot-title logic rather than by `projects.title`.
3. Media folders are currently user-global through `media_folders`, `media_folder_media_items`, and `media_folder_prompt_items`.
4. Media and prompt browse APIs are user-scoped and folder-scoped, not project-scoped.
5. Generated output hydration still reads from user-wide projection data, which is a major future cross-project bleed path.
6. Restore-relevant state is fragmented across runtime state, session snapshots, browser storage, and `user_preferences`.
7. There is useful in-progress `projects` foundation work in the repo already, but some of it still carries session-era assumptions.
8. One concrete example is the current `projects/create` bootstrap path calling `ensureDefaultMediaFolderForUserExists`, which ties project creation to the old user-global folder authority and is incompatible with the locked folder direction for this program.

## Canonical Scope Model

### User-Global
The following remain broadly user-global:
1. left-rail library availability,
2. master media inventory in `media_files`,
3. master prompt inventory in `media_prompts`,
4. styles definitions,
5. pulse preset definitions,
6. prompt preset definitions,
7. character library,
8. elements library,
9. true account defaults and preferences such as autosave.

### Project-Scoped
The following become project-scoped:
1. `projects.title`,
2. the custom Media Library folder tree shown in the active project,
3. membership of media and prompts inside those project folders,
4. Reference Grid composition,
5. Quick Slot Inventory composition,
6. canvas/workspace state,
7. relevant Create/Edit selected values that should reopen with the project,
8. project-owned association to durable assets required to restore the project.

### Ephemeral
The following remain ephemeral:
1. hover and focus state,
2. open modal state,
3. in-flight generation and upload progress,
4. transient drag/drop affordances,
5. temporary local input state not yet committed to the project.

## Locked Technical Direction
1. `projectId` becomes the durable AI Studio identity.
2. `sid` remains only as a temporary migration-layer runtime/session key.
3. Keep `media_files` and `media_prompts` as the user-global asset inventories.
4. Do not duplicate media binaries merely because a project references them.
5. Represent project usage through project association and project-folder membership records rather than by cloning assets.
6. Do not reuse the existing user-global `media_folders` tables as the long-term visible folder authority once project folders ship.
7. Keep project restore distinct from true user-global preferences.

## Explicit Non-Goals
1. Do not redesign the left-rail libraries.
2. Do not make every existing asset table project-owned by default.
3. Do not solve every possible library taxonomy problem in this program.
4. Do not continue this program past the defined done state.

## Recommended Data Model Direction

### Keep
1. `projects`
2. user-global `media_files`
3. user-global `media_prompts`
4. existing global library catalogs
5. `user_preferences` for true user-level defaults

### Add
1. `project_workspace_states`
   - one authoritative durable workspace snapshot per project,
   - schema-versioned,
   - stores Reference Grid, Quick Slots, canvas/workspace state, and project-scoped selected workflow values.
2. `project_media_folders`
   - project-owned replacement for the currently visible custom-folder area.
3. `project_folder_media_items`
   - project-folder membership for media assets.
4. `project_folder_prompt_items`
   - project-folder membership for saved prompts.
5. `project_asset_membership` or an equivalent association seam
   - used to associate restore-relevant assets with the active project without making the whole inventory project-local.

### Avoid In Early Phases
1. Do not add `project_id` to every existing media/generation table immediately.
2. Do not rewrite the left-rail libraries into project-local domains.
3. Do not keep the current user-global `media_folders` tables as the visible folder authority once project folders ship.

## Program Phase Contract
| Phase | Title | Primary Outcome | Why It Exists |
| --- | --- | --- | --- |
| 0 | Contract And Persistence Inventory | One exact classification of every persisted AI Studio value and leak path | Prevents implementation from re-opening product decisions or carrying hidden global/session state forward |
| 1 | Projects Foundation Hardening | Stable project create/read/list/update identity layer | Gives later phases a clean, user-owned project domain to build on |
| 2 | Project Runtime Entry And Title Authority | AI Studio resolves owned project identity first and reads/writes project title from `projects` | Separates project identity from the old session-title veneer |
| 3 | Project Workspace Authority | One authoritative project-owned workspace snapshot contract | Moves restore authority off `sid` without yet solving folder membership or global-asset redesign |
| 4 | Project Asset Association | Restore-relevant media and prompts can be resolved by project association | Stops project restore from scanning or leaking user-global assets |
| 5 | Project Folder Cutover | Visible custom folders become project-scoped while `All Media` stays global | Lands the user-facing folder behavior the product now requires |
| 6 | Dashboard Saved-Project Surfaces | Dashboard becomes the canonical create/open surface for real saved projects | Makes saved-project behavior visible and usable from the dashboard |
| 7 | Legacy Session Demotion And Cleanup | Legacy session persistence is retired or bounded to compatibility only | Finishes the migration so Projects become the clear durable authority |

## Validation Requirements
1. API tests for project create/read/update/list ownership boundaries.
2. Hydration tests proving:
   - a new project opens empty,
   - reopening a project restores the same workspace,
   - switching projects does not leak folders or selected runtime state.
3. Media Library tests proving:
   - `All Media` remains globally accessible,
   - project folders are isolated per project,
   - project folders accept media and prompts,
   - audio survives the same project-folder path.
4. Reference Grid, Quick Slot, and canvas restore tests proving project-specific composition survives reload and reopen.
5. Compatibility regression coverage for the temporary `sid` migration window.

## Primary Risks
1. User-global generated-output hydration will continue leaking across projects until explicitly re-scoped.
2. The current folder domain is deeply user-scoped and cannot be made project-correct by naming alone.
3. Browser-global workflow settings can silently break project reopen behavior if not migrated early.
4. Local-only blob references will break real project restore unless they are staged into durable assets.
5. If project identity, workspace authority, and asset association are implemented out of order, the repo can end up with two competing restore authorities instead of one.

## Done State
The program is done when:
1. a user can create a real project from the dashboard,
2. a new project opens empty,
3. opening a saved project restores the same project workspace,
4. project title is persisted on the project itself,
5. Media Library custom folders are isolated per project,
6. `All Media` remains globally accessible across projects,
7. project folders can hold media and prompts with no cross-project bleed,
8. Reference Grid, Quick Slots, and canvas/workspace state reopen correctly for the saved project,
9. the implementation no longer depends on legacy session persistence as the primary durable user-facing authority,
10. docs and tests describe and validate the project model rather than the old session model.

## Program Stop Rule
When the done state above is met:
1. this program is complete,
2. work on this program must stop,
3. any further work requires a new explicitly scoped follow-up problem statement,
4. the correct closeout reminder is: the done state has been achieved and this lane should not continue by momentum.

## Phase Links
1. `docs/archive/planning/ai-studio-project-persistence-phase-0-contract-and-persistence-inventory-plan-2026-04-23.md`
2. `docs/archive/planning/ai-studio-project-persistence-phase-1-projects-foundation-hardening-plan-2026-04-23.md`
3. `docs/archive/planning/ai-studio-project-persistence-phase-2-project-runtime-entry-and-title-authority-plan-2026-04-23.md`
4. `docs/archive/planning/ai-studio-project-persistence-phase-3-project-workspace-authority-plan-2026-04-23.md`
5. `docs/archive/planning/ai-studio-project-persistence-phase-4-project-asset-association-plan-2026-04-23.md`
6. `docs/archive/planning/ai-studio-project-persistence-phase-5-project-folder-cutover-plan-2026-04-23.md`
7. `docs/archive/planning/ai-studio-project-persistence-phase-6-dashboard-saved-project-surfaces-plan-2026-04-23.md`
8. `docs/archive/planning/ai-studio-project-persistence-phase-7-legacy-session-demotion-and-cleanup-plan-2026-04-23.md`
