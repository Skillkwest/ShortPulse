# Large Project Persistence Autosave And Create Recovery Plan

> Archive note, 2026-06-04: moved from active planning to archive after the large-project autosave persistence and new-project create recovery buildout completed, with focused tests, repo-wide type-check, and docs validation passing.

## Status

Archived after implementation.

## Date

2026-06-04

## Problem Statement

After the large-project persistence migration was applied and deployed, production still shows project autosave warnings:

`Project autosave is retrying in the background: Failed to save project workspace snapshot: Internal Server Error`

The app can also become stuck on the new-project modal with `Creating...`, leaving the project creation flow unrecoverable from the user's point of view.

This plan is limited to the persistence and project-create seams that can produce those symptoms. It does not open a broader media rendering, reference-grid, pricing, adaptive-media, or UI redesign lane.

## Source Of Truth

- Migration `145` is treated as applied before the last deploy.
- Runtime schema visibility for `project_workspace_states.checkpoint_revision` and `project_output_display_items` is treated as confirmed.
- ADR 0089 remains the architecture target: lightweight project checkpoint plus project-owned output display records.
- Production telemetry showed workspace save failures in these categories:
  - large-project owned-ID resolution failures, including upstream request timeout and Supabase 520/521-style responses,
  - workspace upsert failures reported as `Unknown error`,
  - client-side `Failed to fetch` workspace save failures.
- Project-create telemetry did not show clear `/api/projects/create` route failures in the checked window, so the stuck `Creating...` state is most likely an unbounded client request or post-create handoff wait.

## Root-Cause Model

The remaining autosave issue is not explained by missing SQL. The stronger root-cause model is:

1. The save hot path still performs expensive ownership and display synchronization work before the durable checkpoint is safely landed.
2. Large projects magnify that cost because one autosave can include hundreds of output, media, prompt, and generation identities.
3. Recoverable follow-up failures are currently able to become autosave-fatal 500s instead of `saved_with_repair_pending`.
4. Some Supabase/PostgREST errors are plain objects, not `Error` instances, and the current formatter can collapse them to `Unknown error`.
5. The new-project modal can wait indefinitely because create and post-create handoff do not have a hard recovery deadline.

## Implementation Plan

### Phase 1: Improve Error Fidelity

- Replace workspace persistence `toErrorMessage` behavior with a canonical error normalizer that handles:
  - `Error.message`,
  - Supabase/PostgREST `message`,
  - `details`,
  - `hint`,
  - `code`,
  - safe JSON fallback for plain objects.
- Use the same normalization for workspace lookup, workspace upsert, owned-ID resolution, display sync, repair-pending logs, and best-effort warnings.
- Preserve existing user-facing copy unless the real error is already intentionally exposed by the current API contract.

### Phase 2: Make Checkpoint Save The First Durable Success

- Keep request parsing and snapshot shape validation fail-closed.
- Build a sanitized checkpoint that is safe to write even if expensive authority lookups degrade.
- Move the workspace checkpoint upsert ahead of recoverable output display sync and association backfill.
- Return `saved` when checkpoint plus follow-up work succeeds.
- Return `saved_with_repair_pending` when the checkpoint lands but display sync, association backfill, or partial authority resolution needs repair.
- Continue returning 400/500 only for invalid snapshots, auth/project lookup failures, unsafe snapshots, or actual checkpoint write failure.

### Phase 3: Make Save-Side Authority Resolution Partial-Tolerant

- Change owned media, prompt, and generation resolution from all-or-nothing to per-authority settled results.
- When one authority source fails:
  - preserve safe shape-level workspace state,
  - strip unverified associations that cannot be trusted,
  - preserve only safe durable output identity already allowed by the existing project persistence contract,
  - report `saved_with_repair_pending` with the failed authority names and normalized messages.
- Do not trust arbitrary client-provided foreign IDs just to avoid losing data.

### Phase 4: Harden Output Display Sync

- Keep `project_output_display_items` as the heavy-output read model from ADR 0089.
- Ensure display rows are integer-safe for integer DB columns such as width, height, and duration.
- Keep upserts chunked and idempotent.
- Prevent display sync failure from failing the whole autosave after the checkpoint has landed.
- Log and return repair-pending when display sync cannot finish.
- Do not introduce Supabase image transformations or new media delivery paths.

### Phase 5: Fix New-Project Create Recovery

- Add a bounded request deadline to project creation so the modal can recover from stalled network/auth/request states.
- Add a bounded post-create handoff deadline for AI Studio project navigation/bootstrap.
- Preserve current UI/UX behavior:
  - same modal,
  - same button states during normal creation,
  - same close behavior on success,
  - same error display surface on failure.
- The only intended behavior change is that indefinite `Creating...` becomes a recoverable error state.

### Phase 6: Tests And Validation

Add focused tests for:

- plain-object Supabase/PostgREST errors preserving useful message/detail/code context,
- owned-ID resolution failures returning `saved_with_repair_pending` after a checkpoint write,
- display sync failures returning `saved_with_repair_pending` after a checkpoint write,
- checkpoint write failures still failing the save,
- invalid/unsafe snapshots still failing closed,
- new-project request timeout resetting `isCreating` and surfacing an error,
- post-create handoff timeout resetting `isCreating` and surfacing an error.

Run targeted validation first:

```bash
cd frontend
npx vitest run lib/server/__tests__/projectWorkspaceStatesService.test.ts features/ai-studio/logic/__tests__/projectWorkspaceApiClient.test.ts features/projects features/ai-studio/components/__tests__/ProjectsModal.test.tsx features/ai-studio/hooks/__tests__/useAiStudioShellRuntime.test.ts
```

Then run type-check if shared client/server contracts are touched:

```bash
cd frontend
npm run type-check
```

Run docs validation after this plan document/index change:

```bash
cd frontend
npm run docs:check
```

## Non-Goals

- Do not change right-rail UI/UX behavior.
- Do not redesign the media detail modal.
- Do not modify pricing, billing, or concurrency lanes.
- Do not change Supabase migration state unless fresh implementation evidence proves a real schema defect.
- Do not add parallel persistence systems, backup tables, hidden fallbacks, or legacy bypass paths.
- Do not treat local validation as proof of deployed production behavior.

## Stop Condition

Implementation is complete when:

- large-project autosave can persist a safe lightweight checkpoint even when recoverable display or association work degrades,
- recoverable follow-up failures return `saved_with_repair_pending` instead of surfacing as `Failed to save project workspace snapshot: Internal Server Error`,
- true checkpoint/auth/project/validation failures still fail closed,
- new-project creation cannot remain indefinitely stuck on `Creating...`,
- targeted tests pass,
- type-check passes if shared contracts are touched,
- and no unrelated dirty worktree files are modified.

Stop at that point. Do not continue into adjacent media rendering, restore semantics, reference-grid, modal metadata, pricing, or adaptive-media work without a new repo-backed problem statement.
