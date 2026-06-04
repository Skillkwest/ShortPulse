# Large Project Persistence Implementation Checkpoint

Date: 2026-06-03

## Summary

The large-project persistence lane has moved from architecture plan to an implemented checkpoint. The shipped direction is the ADR 0089 hybrid model: a lightweight project workspace checkpoint plus project-owned output display records, with project association tables preserving media, prompt, and generated-output ownership boundaries.

This checkpoint records the implementation outcome so future Datserok runs do not have to rediscover the same seam from chat history.

## Implemented changes

- Project workspace reads now use a shared read-response path that materializes lightweight checkpoints from `project_output_display_items`, runs ownership-safe read sanitization, narrowly converges existing generated rows from durable project-scoped projection/media authority, then returns a compatibility snapshot.
- Generated-output convergence on workspace read is intentionally narrow: it does not append missing project outputs, does not reorder active outputs, and does not overwrite rows that already have durable media authority.
- Project output display writes now normalize typed database fields before upsert: invalid `createdAt`, `generationId`, and `promptId` values become `null` instead of causing typed Postgres column failures.
- Project workspace save responses now emit a specific `ai_studio_project_workspace_save_malformed_success` breadcrumb when a `200 application/json` response is missing `workspace`.

## Why this matters

The production failure shape was not missing display rows or missing storage for most saved media. The stronger root was stale or lightweight restore state plus generated rows that needed durable media authority convergence, while provider-only remote URLs remained insufficient for restored visible success media.

This implementation fixes the canonical persistence/read seam instead of adding rendering fallbacks to Reference Grid, Quick Slot Inventory, Canvas, or the Detail Modal.

## Proof captured during implementation

- `npx vitest run lib/server/__tests__/projectWorkspaceStatesService.test.ts features/ai-studio/logic/__tests__/projectWorkspaceApiClient.test.ts lib/server/__tests__/projectGenerationAssociationsService.test.ts`
  - Result: 3 test files passed, 81 tests passed.
- Targeted ESLint passed on the six changed implementation/test files.
- Targeted Prettier check passed on the six changed implementation/test files.
- `git diff --check` passed for the changed implementation/test files.

## Known validation boundary

`npm run type-check:touched` was attempted and blocked by unrelated existing dirty-worktree TypeScript errors in:

- `frontend/features/ai-studio/hooks/__tests__/usePulseChatThreads.test.ts`
- `frontend/features/ai-studio/hooks/useAiStudioCreatePanelRuntime.ts`
- `frontend/lib/server/providerIntegration/kieModelContracts.ts`

Those files were outside the large-project persistence patch and were not changed by this lane.

## Stop condition

The persistence lane should stop at this checkpoint unless fresh production evidence shows that autosave warnings, empty restored media, or project restore regressions still originate from the project workspace/display-record seam.

If remaining broken media is provider-url-only generated output with no durable storage, saved media id, or canonical publication/media delivery, that belongs to a separate Generation Settlement or media-delivery lane, not more Project Persistence patching.
