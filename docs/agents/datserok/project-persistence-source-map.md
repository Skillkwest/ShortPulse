# Datserok Project Persistence Source Map

Purpose: give Datserok a compact first-load map for how project creation, saving, restore, and project-owned workspace behavior currently work in ShortPulse.

## First Truths

1. Projects are real user-owned rows created before entering AI Studio.
2. `projectId` is the top-level durable project identity.
3. Durable project save/restore authority lives on the project workspace route, not on the legacy `sid` session route.
4. Project workspace persistence is sanitized and intentionally narrower than the old session replay model.
5. Project associations are additive membership seams over user-global assets and generations.
6. Media Library folders are global across projects.

## Shipped UX Contract

### Project creation and opening

- `/dashboard` `New Project` asks for a name, calls `POST /api/projects/create`, then routes into AI Studio with `?projectId=<uuid>`.
- `/dashboard` `Open Projects` launches the shared saved-project modal rather than embedding project previews in the dashboard shell.
- AI Studio left-rail `Projects` reuses the same modal to create, open, switch, and delete non-current projects without leaving AI Studio.

### Durable identity and title authority

- `projectId` is the durable handoff boundary for Projects.
- `sid` still coexists, but for project routes it is runtime identity only.
- Visible project title on project routes is owned by `projects.title`, not by local session-only title state.

### What project workspace saves

Project workspace persistence keeps durable project content such as:

- active output media for the shared right rail,
- Quick Slot Inventory and Reference Grid projection ids,
- durable Canvas scene items and cameras,
- and other sanitized workspace content allowed by the current snapshot projection.

### What project workspace does not save

Project workspace persistence does not durably restore:

- unsent Standard Create, Edit, Video, or Sound draft text,
- visible Standard conversation continuity,
- most conversational runtime state,
- active output focus,
- Character Mode shell state,
- Expert Edit document state,
- browser-global workflow settings,
- or selected-character local storage state.

Project-visible conversation resets on project open or project switch. Hidden Pulse parking is the narrow exception and remains subject to the authority checks in ADR 0070.

### Two-phase save model

- The sanitized workspace snapshot is written first.
- Project media, prompt, and generation association repair runs after the durable write.
- If repair fails, the save returns `saved_with_repair_pending` rather than discarding the workspace write.
- The warning means restore durability succeeded but association completeness still needs a later successful pass.

### Read and reopen model

- `GET /api/projects/:projectId/workspace` returns the sanitized saved snapshot quickly.
- Generated-output delivery refreshes asynchronously after workspace bootstrap from project-owned generation association rows.
- Reopen should feel like restoring a durable working board, not replaying the previous chat session.

### Media Library authority on project routes

- `All Media` remains user-global even on project routes.
- Custom Media Library folders remain global across projects.
- Folder membership and folder-canvas state use the same global folder authority on project and non-project routes.
- Projects own workspace snapshots and associations, not a second folder tree.

### Delete behavior

- Deleting a non-current project removes the owned project row, owned workspace row, and project-only association rows by cascade.
- Deleting a project does not delete the user-global Media Library folder tree.

## Canonical Doc Stack

Use these in roughly this order for current-truth reads:

1. `docs/sops/sop_ai_studio_projects_foundation.md`
2. `docs/adr/0062-project-identity-foundation.md`
3. `docs/adr/0063-project-workspace-authority.md`
4. `docs/adr/0064-project-asset-association-foundation.md`
5. `docs/adr/0065-project-generated-output-association-and-restore-refresh.md`
6. `docs/adr/0070-project-workspace-conversational-runtime-exclusion.md`
7. `docs/adr/0085-global-media-library-folder-authority.md`
8. `docs/sops/sop_ai_studio_session_persistence_reference_only.md` only for retired-lane historical context

## Canonical Code Ownership Map

### API and server authority

- `frontend/pages/api/projects/create.ts`
  - authenticated project creation
- `frontend/pages/api/projects/index.ts`
  - project listing for dashboard and modal
- `frontend/pages/api/projects/[...projectPath].ts`
  - project route dispatcher
- `frontend/lib/server/projectApiRoutes/item.ts`
  - project read, rename, delete
- `frontend/lib/server/projectApiRoutes/workspace.ts`
  - project workspace read, save, reset
- `frontend/lib/server/projectsService.ts`
  - project record normalization and access helpers
- `frontend/lib/server/projectWorkspaceStatesService.ts`
  - workspace snapshot sanitization, validation, write/read, repair-pending outcome
- `frontend/lib/server/projectGenerationAssociationsService.ts`
  - project-owned generated-output association and reopen-time refresh

### Client identity and persistence authority

- `frontend/pages/dashboard.tsx`
  - `New Project` and `Open Projects` entrypoints
- `frontend/pages/ai-studio.tsx`
  - project route bootstrap, gating, and project-aware studio entry
- `frontend/features/ai-studio/components/ProjectsModal.tsx`
  - shared modal for create/open/delete inside AI Studio
- `frontend/features/ai-studio/hooks/useAiStudioProjectIdentity.ts`
  - resolves `projectId`, fetches owned project, updates title
- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts`
  - restore/apply and debounced autosave orchestration
- `frontend/features/ai-studio/logic/projectWorkspaceApiClient.ts`
  - client read/write/reset calls for project workspace
- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspaceRestoreCandidate.ts`
  - loads the server-canonical workspace snapshot candidate

### Project association paths

- `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
  - attaches saved media and prompts to the active project
- `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts`
  - save/autosave flows for project association without duplicate uploads

## Validation Anchors

### Targeted tests

- `frontend/features/ai-studio/hooks/__tests__/useAiStudioProjectWorkspaceRestoreCandidate.test.ts`
- `frontend/lib/server/__tests__/projectWorkspaceStatesService.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioProjectIdentity.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionIdentity.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioPageSessionPersistence.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts`
- `frontend/features/ai-studio/logic/__tests__/mediaLibraryPersistence.test.ts`
- `frontend/tests/api/projects-create.test.ts`
- `frontend/tests/api/media-list.test.ts`
- `frontend/tests/api/media-prompts-list.test.ts`

### Manual and browser checks

- production route: `https://www.shortpulse.ai`
- project persistence audit:
  - `cd frontend && PLAYWRIGHT_AUDIT_EMAIL=<audit-email> PLAYWRIGHT_AUDIT_PASSWORD=<password> npm run test:e2e:project-persistence`

## Drift Flags

Reject these stale assumptions unless a newer source of truth replaces the current contract:

- "Projects restore the whole AI Studio session."
- "Legacy `sid` durable restore still owns project routes."
- "Custom Media Library folders are isolated per project."
- "Repair pending means the save failed."
- "Project association duplicates saved assets into project-local inventory."

## Default Load Pack

For most Datserok runs, load:

- `docs/agents/datserok/README.md`
- `docs/agents/datserok/AGENTS.md`
- `docs/agents/datserok/memory.md`
- `docs/agents/datserok/standard-operating-procedure.md`
- `docs/agents/datserok/project-persistence-source-map.md`

Load conditionally:

- `docs/agents/datserok/ownership-manifest.md`
  - when the lane may cross adjacent ownership boundaries
- `docs/sops/sop_ai_studio_projects_foundation.md`
  - for current-contract explanations, audits, or implementation work
- deeper ADRs, code, and tests
  - only when the current lane needs them
- `docs/records/artifacts/agent/datserok/training-history.md`
  - for training or maintenance lanes
