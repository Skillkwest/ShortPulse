# AI Studio Project Persistence Phase 0 Persistence Inventory (2026-04-23)

Last updated: 2026-04-23  
Status: Accepted Working Artifact  
Owner: Engineering

## Purpose
This artifact executes Phase 0 of the AI Studio project-persistence program.

It is the implementation-facing inventory that later phases must follow. It locks:
1. the exact meaning of `new project opens empty`,
2. the exact minimum restore envelope for `open saved project`,
3. the current persistence authorities in the repo,
4. the field-by-field classification of significant persisted AI Studio state,
5. the leak paths that must be closed before Projects are correct.

The master contract remains:
1. [ai-studio-project-persistence-master-plan-2026-04-23.md](./ai-studio-project-persistence-master-plan-2026-04-23.md)
2. [ai-studio-project-persistence-phase-0-contract-and-persistence-inventory-plan-2026-04-23.md](./ai-studio-project-persistence-phase-0-contract-and-persistence-inventory-plan-2026-04-23.md)

## Locked Definitions

### Empty New Project
`New Project` is correct only when the newly opened project has:
1. no project-specific title beyond the default untitled state,
2. no custom project folders,
3. no project folder memberships,
4. no Reference Grid composition,
5. no Quick Slot Inventory composition,
6. no project canvas/workspace restore payload,
7. no project-owned saved prompt/media associations,
8. no restored generated outputs pulled in from another project or from user-global projection reads.

### Saved Project Reopen
Opening a saved project is correct only when AI Studio restores one coherent project-owned session that includes:
1. project title,
2. custom project folders,
3. media memberships in those folders,
4. prompt memberships in those folders,
5. Reference Grid composition,
6. Quick Slot Inventory composition,
7. canvas/workspace state,
8. relevant Create/Edit selections,
9. durable asset references required to resolve the project’s media and prompts,
10. project-visible agent/prompt runtime state when that state is part of the saved workspace.

## Current Persistence Authority Map
| Authority | Current Repo Owner | Current Backing Store | Current Scope | Notes |
| --- | --- | --- | --- | --- |
| URL session identity | `useAiStudioSessionIdentity.ts` | `sid` query param | Session | `/ai-studio` is still `sid`-first and auto-seeds a session id when missing. |
| Session snapshot write shadow | `sessionSnapshot.ts`, `sessionSnapshotStorage.ts`, `useAiStudioSessionPersistenceController.ts` | IndexedDB + in-memory fallback + optional remote AI sessions API | Session | Primary durable restore authority today for much of AI Studio. |
| Remote session metadata/title | `sessionApiClient.ts`, `pages/ai-studio.tsx` | `/api/ai/sessions/*` | Session | Visible project name is still derived from session-era title logic. |
| Workflow settings storage | `useAiStudioWorkflowSettings.ts` | `sessionStorage` | Browser session | Shared per-tool blob, not truly partitioned by project. |
| Resolution fallback storage | `aiStudioStateConfig.ts`, `useAiStudioStateEffects.ts` | `sessionStorage` | Browser session | Video duration, video resolution, image resolution. |
| Beginner mode preference | `useBeginnerModePreference.ts` | `user_preferences` + `localStorage` fallback | User global | Correctly a user-global preference. |
| Media autosave preference | `useMediaAutosavePreference.ts` | `user_preferences` + `localStorage` fallback | User global | Correctly a user-global preference. |
| Create Pulse panel/saved presets | `useCreatePulsePresetPanelPreference.ts` | `user_preferences` + `localStorage` fallback | User global | Catalog/default preference surface, not project restore authority. |
| Expert Edit preset panel/custom presets | `useExpertEditPresetPanelPreference.ts` | `user_preferences` + `localStorage` fallback | User global | Catalog/default preference surface, not project restore authority. |
| Styles library ordering/details/deletions | `useStylesLibraryPanelIdsPreference.ts`, `useStylesLibraryStyleDetailsPreference.ts`, `useStylesLibraryDeletedStyleIdsPreference.ts` | `user_preferences` + `localStorage` fallback | User global | Library customization, not per-project content. |
| Chat mode | `chatModePreference.ts`, `useAiStudioAgentBridge.ts` | `localStorage` | Browser global | Currently leaks across projects even though it is restore-visible session behavior. |
| Selected character | `selectedCharacterPersistence.ts`, `useAiStudioCharacterModeLifecycle.ts` | user-scoped `localStorage` | User global today | Shared helper across Character Manager and AI Studio; likely wrong for project reopen in AI Studio. |
| Model recents | `ModelModal.tsx` | `localStorage` | User global | UI convenience only. |
| Shell split width | `useAiStudioShellResize.ts` | `localStorage` | User global | UI preference only. |
| Global generated output hydration | `generatedMediaAuthority.ts`, `useAiStudioState.ts` | `generation_projection` | User global | Major cross-project bleed path. |
| Media Library custom folders | `mediaFoldersService.ts`, `pages/api/media/folders/*` | `media_folders` + membership tables | User global | Visible folder authority is still user-scoped and incompatible with project isolation. |
| Media list and prompt list browsing | `pages/api/media/list.ts`, `pages/api/media/prompts/list.ts` | `media_files`, `media_prompts`, folder membership joins | User global + optional folder scope | `All Media` behavior is already global; custom folder scoping is wrong for projects. |
| Local reference durability upload | `useAiStudioSessionReferenceDurability.ts` | private storage upload + media rows | Asset durability path | Protects session restore from blob/data URL loss, but is not project-aware yet. |

## Field Classification

### Project Identity And Metadata
| Surface | Current Owner | Current Storage | Classification | Target Authority | Owning Phase | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `sid` URL session identity | `useAiStudioSessionIdentity.ts` | query param | Ephemeral migration key | `projectId` primary, `sid` bounded compatibility only | 2, 7 | Keep only as migration/runtime support. |
| Project row identity | `projects` foundation | Supabase `projects` | Project-scoped | `projects.id` | 1 | Durable top-level identity. |
| Visible project name | `pages/ai-studio.tsx`, `MediaLibraryPanel.tsx` | session title override + AI session title | Project-scoped | `projects.title` | 2 | Must stop depending on session title logic. |
| Dashboard saved project entry | `dashboard.tsx` + projects APIs | Supabase `projects` | Project-scoped | `projects` list/open surfaces | 1, 6 | Dashboard becomes canonical open surface. |

### Workspace Restore Snapshot
| Surface | Current Owner | Current Storage | Classification | Target Authority | Owning Phase | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Workspace mode/tool/prompt/model/aspect | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Core restore-visible session state. |
| Expert create mode | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Required to reopen Standard vs Pulse state. |
| Active pulse preset id | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Active selected preset belongs to project reopen. |
| Create/Edit reference inputs | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Includes `referenceImageUrl`, `extraImageUrls`, edit/video ref text. |
| Video/image generation settings | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Includes duration, resolution, reference mode, image resolution, audio/fix toggles. |
| Kling/Seedance workflow settings | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Restore-visible model workflow state. |
| Kling elements | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Composition state required for reopen. |
| Motion reference video url | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Same restore contract. |
| Active outputs/archived outputs | `sessionSnapshot.ts` | session snapshot | Project-scoped with asset dependency | `project_workspace_states` + project asset association | 3, 4 | Output metadata belongs to project restore, asset resolution depends on Phase 4. |
| Active output id | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Restore-visible selection. |
| Quick Slot ids | `sessionSnapshot.ts` (`curatedReferenceIds`) | session snapshot | Project-scoped | `project_workspace_states` | 3 | Direct project composition. |
| Removed-from-all-refs ids | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Direct project composition. |
| Canvas snapshot | `sessionSnapshot.ts`, `sessionSnapshotCanvas.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Explicitly part of reopen contract. |
| Expert Edit snapshot | `sessionSnapshot.ts`, `sessionSnapshotExpertEdit.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Explicitly part of reopen contract. |

### Agent And Prompt Runtime
| Surface | Current Owner | Current Storage | Classification | Target Authority | Owning Phase | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Agent messages | `sessionSnapshot.ts`, `useAiStudioAgentBridge.ts` | session snapshot + in-memory runtime | Project-scoped | `project_workspace_states` | 3 | Part of restoring the saved AI Studio session coherently. |
| Agent input draft | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Reopen-visible unfinished work. |
| Latest agent prompt | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Needed to resume saved session state. |
| Prompt origin | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Restore-visible behavior. |
| Chat mode enabled | `chatModePreference.ts`, `useAiStudioAgentBridge.ts` | `localStorage` | Project-scoped | `project_workspace_states` | 3 | Current browser-global storage is a cross-project leak. |
| Pulse workflow session | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Explicitly part of saved Pulse session. |
| Agent runtimes split (`standard`, `pulse`) | `sessionSnapshot.ts` | session snapshot | Project-scoped | `project_workspace_states` | 3 | Must survive project reopen if runtime split remains product-visible. |

### Media Library, Assets, And Folder Membership
| Surface | Current Owner | Current Storage | Classification | Target Authority | Owning Phase | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `All Media` browse inventory | `pages/api/media/list.ts` | `media_files` | User global | Stay global | 4, 5 | Correctly global across projects. |
| Prompt inventory browse | `pages/api/media/prompts/list.ts` | `media_prompts` | User global | Stay global | 4, 5 | Correctly global across projects. |
| Visible custom folder tree | `mediaFoldersService.ts` | `media_folders` | Project-scoped | `project_media_folders` | 5 | Current user-global authority must not be reused. |
| Folder media memberships | `media_folder_media_items` path | membership table | Project-scoped | `project_folder_media_items` | 5 | Current rows bleed across projects. |
| Folder prompt memberships | `media_folder_prompt_items` path | membership table | Project-scoped | `project_folder_prompt_items` | 5 | Current rows bleed across projects. |
| Folder canvas state | `mediaFolderCanvasService.ts` | folder canvas table | Project-scoped if retained | project-scoped folder canvas or explicit cut | 5 | Product decision needed only if folder canvas remains in scope. |
| Generated output hydration | `generatedMediaAuthority.ts` | `generation_projection` | Project-scoped restore dependency | project asset association read path | 4 | Current user-wide hydrate is the biggest bleed path. |
| Persisted media save/manual save | `useAiStudioPersistenceActions.ts` | media rows + generation persistence | Project-scoped restore dependency | project asset association | 4 | Save paths need project association, not just user ownership. |
| Autosave association | `useAiStudioMediaAutosaveOrchestrator.ts`, `useMediaAutosavePreference.ts` | user preference + save flow | Mixed | preference stays user-global, saved asset association becomes project-scoped | 4 | Separate preference from asset association. |
| Local reference durability upload | `useAiStudioSessionReferenceDurability.ts` | storage-backed uploads | Project-scoped restore dependency | project asset association + durable storage | 4 | Asset should be durable and associated to the active project when restore-relevant. |

### Workflow Settings And Selection State Outside The Snapshot
| Surface | Current Owner | Current Storage | Classification | Target Authority | Owning Phase | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Workflow settings by tool | `useAiStudioWorkflowSettings.ts` | `sessionStorage` | Project-scoped | `project_workspace_states` | 3 | Shared blob is effectively browser-global. |
| Shared aspect setting | `useAiStudioWorkflowSettings.ts` | `sessionStorage` | Project-scoped | `project_workspace_states` | 3 | Restore-visible selection. |
| Video duration/session fallback | `useAiStudioStateEffects.ts`, `aiStudioStateConfig.ts` | `sessionStorage` | Project-scoped | `project_workspace_states` | 3 | Cross-project leak today. |
| Video resolution/session fallback | `useAiStudioStateEffects.ts`, `aiStudioStateConfig.ts` | `sessionStorage` | Project-scoped | `project_workspace_states` | 3 | Cross-project leak today. |
| Image resolution/session fallback | `useAiStudioStateEffects.ts`, `aiStudioStateConfig.ts` | `sessionStorage` | Project-scoped | `project_workspace_states` | 3 | Cross-project leak today. |
| Selected character in AI Studio | `useAiStudioCharacterModeLifecycle.ts` | user-scoped `localStorage` | Project-scoped | `project_workspace_states` | 3 | Current shared Character Manager persistence helper is wrong for project reopen. |

### User-Global Preferences And Catalog Customization
| Surface | Current Owner | Current Storage | Classification | Target Authority | Owning Phase | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Beginner mode | `useBeginnerModePreference.ts` | `user_preferences` + `localStorage` fallback | User global | Stay in `user_preferences` | 3 retain | Personal product preference, not project content. |
| Media autosave enabled | `useMediaAutosavePreference.ts` | `user_preferences` + `localStorage` fallback | User global | Stay in `user_preferences` | 4 consume | Personal save policy. |
| Create Pulse panel ids | `useCreatePulsePresetPanelPreference.ts` | `user_preferences` + `localStorage` fallback | User global | Stay in `user_preferences` | retain | Catalog/default arrangement. |
| Create Pulse saved presets library | `useCreatePulsePresetPanelPreference.ts` | `user_preferences` + `localStorage` fallback | User global | Stay in `user_preferences` | retain | Personal preset library, not project restore. |
| Expert Edit panel ids | `useExpertEditPresetPanelPreference.ts` | `user_preferences` + `localStorage` fallback | User global | Stay in `user_preferences` | retain | Catalog/default arrangement. |
| Expert Edit custom preset overrides | `useExpertEditPresetPanelPreference.ts` | `user_preferences` + `localStorage` fallback | User global | Stay in `user_preferences` | retain | Personal preset library. |
| Styles panel ids | `useStylesLibraryPanelIdsPreference.ts` | `user_preferences` + `localStorage` fallback | User global | Stay in `user_preferences` | retain | Styles library customization. |
| Styles deleted ids | `useStylesLibraryDeletedStyleIdsPreference.ts` | `user_preferences` + `localStorage` fallback | User global | Stay in `user_preferences` | retain | Styles library customization. |
| Styles details overrides | `useStylesLibraryStyleDetailsPreference.ts` | `user_preferences` + `localStorage` fallback | User global | Stay in `user_preferences` | retain | Styles library customization. |

### UI Convenience And Ephemeral Browser State
| Surface | Current Owner | Current Storage | Classification | Target Authority | Owning Phase | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Recent models | `ModelModal.tsx` | `localStorage` | User global convenience | Stay local or remain UI-only | retain | Not required for project restore. |
| AI shell split width | `useAiStudioShellResize.ts` | `localStorage` | User global preference | Stay local UI preference | retain | Not project content. |
| Modal open state, hover state, drag hover state | many page/component hooks | runtime only | Ephemeral | runtime only | n/a | Never persist into project state. |
| In-flight upload/generation progress | runtime/task orchestration hooks | runtime only | Ephemeral | runtime only | n/a | Reconstruct from live task systems when needed, not from project snapshot. |

## Migration-Critical Leak Paths
| Priority | Leak Path | Why It Is Wrong | Current Owner | Target Phase |
| --- | --- | --- | --- | --- |
| P0 | Global generated-output hydration from `generation_projection` | Every project can hydrate user-wide outputs on boot | `generatedMediaAuthority.ts` | 4 |
| P0 | User-global visible custom folders | New projects would inherit old folders | `mediaFoldersService.ts`, folder APIs | 5 |
| P0 | Workflow settings blob in `sessionStorage` | Create/Edit selections bleed across projects in the same browser session | `useAiStudioWorkflowSettings.ts` | 3 |
| P0 | Visible project name still bound to session title logic | Project rename is not actually writing to the project domain | `pages/ai-studio.tsx`, `MediaLibraryPanel.tsx` | 2 |
| P0 | `projects/create` still bootstraps old default folder flow | Project creation is coupled to the wrong folder domain | `pages/api/projects/create.ts` | 1 |
| P1 | AI Studio selected character in localStorage | Character-mode selection can bleed between unrelated projects | `useAiStudioCharacterModeLifecycle.ts` | 3 |
| P1 | Chat mode stored in browser-global localStorage | Saved project reopen can mismatch the project’s prior session behavior | `chatModePreference.ts`, `useAiStudioAgentBridge.ts` | 3 |
| P1 | Resolution fallback keys in `sessionStorage` | Project reopen can pick up stale browser-session values | `useAiStudioStateEffects.ts` | 3 |
| P1 | Local-only blob/data refs uploaded without project association | Durable asset exists, but project ownership is still undefined | `useAiStudioSessionReferenceDurability.ts` | 4 |

## Implementation Notes For Later Phases
1. Phase 1 must keep `projects` creation focused on project identity and stop bootstrapping the old user-global folder path.
2. Phase 2 must move project title authority from session title logic to `projects.title`.
3. Phase 3 must migrate restore-visible workflow selections, chat mode, selected character, and other reopen-visible state into one project-owned workspace authority.
4. Phase 4 must stop project reopen from reading user-global generated output projections and instead resolve restore-relevant assets by project association.
5. Phase 5 must replace the visible folder authority, not just relabel the current user-global folder tables.

## Exit Check
Phase 0 is complete only if later implementation can answer all of the following without re-opening product decisions:
1. Is this value project-scoped, user-global, or ephemeral?
2. What is the current authority for this value?
3. What later phase owns its migration?
4. What exact leak does the current implementation create?

This artifact is intended to be that answer set.
