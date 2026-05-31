# Datserok Project Persistence Authority Audit

Date: 2026-05-31

Purpose: retain a decision-grade summary of the first substantive Datserok audit of ShortPulse project persistence, save/restore behavior, project associations, and the boundary between project-owned and global state.

## Claim

Datserok can act as the bounded authority surface for ShortPulse project persistence because the current shipped contract is coherent across docs, server authority, client restore/autosave wiring, database schema, and targeted tests.

That authority is strongest for:

- project identity and project-title authority,
- project workspace save/restore behavior,
- project asset and generation association behavior,
- project reopen generated-output refresh behavior,
- and the boundary between project-owned workspace state and global Media Library folder state.

## Evidence

### Source-of-truth docs

- `docs/sops/sop_ai_studio_projects_foundation.md`
- `docs/adr/0062-project-identity-foundation.md`
- `docs/adr/0063-project-workspace-authority.md`
- `docs/adr/0064-project-asset-association-foundation.md`
- `docs/adr/0065-project-generated-output-association-and-restore-refresh.md`
- `docs/adr/0070-project-workspace-conversational-runtime-exclusion.md`
- `docs/adr/0085-global-media-library-folder-authority.md`
- `README.md`
- `docs/routes.md`

### Code-backed authority seams

- project creation and route dispatch:
  - `frontend/pages/api/projects/create.ts`
  - `frontend/pages/api/projects/[...projectPath].ts`
  - `frontend/lib/server/projectApiRoutes/workspace.ts`
  - `frontend/lib/server/projectsService.ts`
- project workspace write/read canonicalization:
  - `frontend/lib/server/projectWorkspaceStatesService.ts`
  - `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts`
- project-generated-output association and reopen refresh:
  - `frontend/lib/server/projectGenerationAssociationsService.ts`
  - `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioGeneratedOutputMaintenance.ts`
- client restore/autosave orchestration:
  - `frontend/features/ai-studio/hooks/useAiStudioProjectIdentity.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspaceRestoreCandidate.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspaceRestoreHydration.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPageProjectSessionRuntime.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPageSessionPersistence.ts`
- project association from save flows:
  - `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioOutputSaveShortCircuitRuntime.ts`

### Database-backed authority

- `sql/migrations/089_add_projects_foundation.sql`
- `sql/migrations/091_add_project_workspace_states.sql`
- `sql/migrations/092_add_project_asset_associations.sql`
- `sql/migrations/093_add_project_generation_associations.sql`
- `sql/migrations/103_sanitize_project_workspace_conversational_runtime.sql`
- `sql/migrations/136_restore_global_media_folder_authority.sql`

### Test-backed evidence

Targeted unit slice run on 2026-05-31:

```bash
cd frontend
npm test -- lib/server/__tests__/projectWorkspaceStatesService.test.ts \
  lib/server/__tests__/projectGenerationAssociationsService.test.ts \
  features/ai-studio/hooks/__tests__/useAiStudioProjectWorkspaceRestoreCandidate.test.ts \
  features/ai-studio/hooks/__tests__/useAiStudioProjectWorkspaceRestoreHydration.test.ts \
  features/ai-studio/hooks/__tests__/useAiStudioProjectWorkspacePersistenceController.test.ts
```

Result: 5 test files passed, 69/69 tests passed.

High-signal supporting tests also inspected:

- `frontend/features/ai-studio/logic/__tests__/generatedMediaAuthority.test.ts`
- `frontend/features/ai-studio/logic/__tests__/mediaLibraryPersistence.test.ts`
- `frontend/features/ai-studio/logic/__tests__/mediaLibraryPanelApi.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts`
- `frontend/features/ai-studio/hooks/__tests__/useAiStudioCharacterModeLifecycle.test.ts`
- `frontend/tests/api/projects-create.test.ts`
- `frontend/tests/pages/ai-studio.project-modal-boundary.test.ts`

### Retained executable audit path

- `frontend/tests/e2e/project-persistence.audit.js`

This audit creates a real project, writes a legacy-style orphan snapshot, verifies server canonicalization, checks project/global folder behavior, and confirms the orphan preview does not survive reopen.

## Freshness

- Repo docs, code, SQL, and tests were inspected directly on 2026-05-31.
- The targeted persistence unit slice was executed on 2026-05-31.
- This evidence is current for the local repository state on branch `production`.

## Confidence level

Partial, close to decision-grade for local code-contract authority.

Reason:

- doc-backed, code-backed, SQL-backed, and test-backed evidence all align,
- but no authenticated production browser audit was run in this environment during this audit.

## Directly verified

- `projectId` is the top-level durable identity and `sid` is runtime-only for project routes.
- durable restore authority for project routes is `/api/projects/:projectId/workspace`.
- project workspace writes are sanitized before persistence.
- project workspace restore intentionally excludes workflow-shell replay and visible conversation replay.
- project route entry fails closed to an empty shell before async restore finishes.
- project asset and generation association are additive membership layers, not duplicate inventory.
- project reopen generated-output maintenance is project-scoped and does not intentionally scan user-global generated outputs.
- provider-url-only success rows without durable media authority are filtered out of visible restore/reconcile paths.
- Media Library folders and folder canvas remain global even when `projectId` is present.

## Unknowns

- No authenticated production check against `https://www.shortpulse.ai` was possible because `PLAYWRIGHT_AUDIT_EMAIL` and `PLAYWRIGHT_AUDIT_PASSWORD` were not present in this environment.
- No claim is made here about current production data cleanliness, migration completeness in production, or live environment drift after this audit moment.
- No cross-agent signoff was sought for adjacent owner lanes such as Holomony media-display performance or Nuclo environment posture.

## Decision impact

Datserok can now make bounded project-persistence decisions with high confidence from repo evidence:

- explain whether a user-visible behavior is project-owned, global, or runtime-only;
- decide whether a persistence bug belongs to the workspace seam, project association seam, or a non-Datserok adjacent lane;
- reject stale assumptions such as “projects save everything” or “folders are project-local”;
- and direct fixes toward the canonical project persistence path rather than compatibility folklore.

## Change trigger

Re-check this audit if any of the following change:

- `/api/projects/:projectId/workspace` contract,
- `projectWorkspaceSnapshot.ts` field-reset rules,
- project generated-output authority or `generatedMediaAuthority.ts`,
- Media Library folder authority,
- or the production environment/migration posture for project tables and folder cutover.

## Next proof

Smallest high-value next proof:

1. run `frontend/tests/e2e/project-persistence.audit.js` against `https://www.shortpulse.ai` with a dedicated audit account,
2. capture whether production still matches the local canonicalization and global-folder contract,
3. then promote this audit from partial to decision-grade for launch-relevant deployed-behavior claims.
