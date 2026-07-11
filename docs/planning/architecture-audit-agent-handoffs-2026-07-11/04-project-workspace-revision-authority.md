# Next-Agent Handoff: Project Workspace Revision Authority

Lane id: `architecture-audit-04-project-workspace-revision-authority`

Status: ready after Lane 00 for any schema change and after a fresh overlap check.

## Copy/Paste Assignment

Replace browser-time workspace freshness with server-issued revision compare-and-swap. Return truthful stale/conflict/degraded outcomes and preserve existing workspace/global-right-rail behavior. Correctness comes before delta persistence or performance refactors.

## Required Context

Read first:

- `AGENTS.md`
- `docs/adr/0062-project-identity-foundation.md`
- `docs/adr/0063-project-workspace-authority.md`
- `docs/adr/0065-project-generated-output-association-and-restore-refresh.md`
- `docs/adr/0083-create-mode-global-right-rail-authority.md`
- `docs/sops/sop_ai_studio_projects_foundation.md`
- Datserok project-persistence source map if currently authoritative

Inspect first:

- `frontend/lib/server/projectWorkspaceStatesService.ts`
- project workspace API routes
- `frontend/features/ai-studio/logic/projectWorkspaceApiClient.ts`
- `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts`
- workspace snapshot validation/hydration/materialization modules and tests

## Confirmed Problems

- Client `snapshot.updatedAt` determines save freshness.
- A discarded older write can be returned as `status: saved`.
- The client can mark its local payload as saved after that response.
- Save requests do not require the base checkpoint revision.
- Restore/materialization degradation can appear as ordinary ready/empty state.
- Lifecycle keepalive only covers 60 KB while accepted snapshots can be much larger.

## Owned Write Surface

- project workspace state service and route contract
- workspace API client and persistence controller
- snapshot schema/version/CAS migration if needed
- focused project persistence, restore, and conflict tests
- relevant ADR/SOP/data dictionary updates

## Avoid Surface

- generated-media signing/deletion implementation except the minimal response contract
- global right-rail ownership changes
- Canvas or workflow redesign
- automatic whole-workspace merge
- delta persistence and full-snapshot optimization in the correctness phase

## Phase 1 Contract

1. Server issues monotonically increasing `checkpoint_revision`.
2. Client save includes `baseCheckpointRevision`.
3. Database update succeeds only when the base matches current authority.
4. Stale saves return `409` with current revision and a safe conflict payload.
5. Client does not mark stale payload as saved.
6. Browser timestamps remain diagnostic only.
7. Restore returns explicit `ready`, `degraded`, `unavailable`, or equivalent discriminated state.
8. Embedded and row schema versions converge under one documented migrator contract.

## Required Failure Tests

- Future-skewed browser clock followed by legitimate saves.
- Two tabs save from the same base revision.
- Equal timestamps with different content.
- Project switch/flush concurrent with autosave.
- Materialization failure after checkpoint read.
- Conflict response followed by retry/reload.

## Acceptance Criteria

- No stale write reports successful persistence.
- Two editors cannot silently overwrite the same base revision.
- Existing same-tab serialization/deduplication remains intact.
- Global Reference Grid, Quick Slot Inventory, and Canvas authority remains workspace-global.
- Degraded restore is visible to state machinery without clearing known-good client state.

## Later Work, Explicitly Excluded

- Delta/event-sourced workspace persistence.
- Large-snapshot exit transport.
- automatic field-level merge.
- broad snapshot decomposition.

Record these only as follow-ups after Phase 1 proof.

## Validation And Proof

- Run project workspace service/API/client/controller/hydration tests.
- Add multi-tab revision and clock-skew regressions.
- Run targeted type checking and docs checks.
- Hosted schema application follows Lane 00 and requires migration readback.
- Production closure requires an authenticated two-tab non-destructive smoke on `https://www.shortpulse.ai`; local tests alone are not production proof.

## Stop Rules

- Stop before hosted migration/apply/deploy without authority.
- Stop if another agent owns project persistence files.
- Do not hide conflict by last-writer-wins fallback.
- Do not broaden into generated-media cleanup; Lane 10 follows the response contract.
