# Copperknot External Lane Closeout

## lane id
`project-workspace-persistence-hardening`

## source handoff path
`docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md`

## execution status
`bounded persistence patch complete`

## systems touched
- `project-workspace-persistence`

## files changed
- `frontend/lib/server/projectGenerationAssociationsService.ts`
- `frontend/lib/server/__tests__/projectGenerationAssociationsService.test.ts`

## summary of what changed
- Hardened `associateGenerationWithProjectForUser` so eager project-generation association now verifies the referenced `ai_generations` row is owned by the caller before inserting `project_generation_items`.
- Added a unit test that proves foreign generation ids fail closed and do not create project associations.

## acceptance criteria reached
- One project workspace restore/persistence invariant is now more explicit and fail-closed.
- The patch stayed inside the owned persistence surface and did not broaden into canvas/runtime redesign work.
- Directly related tests cover the new ownership gate.

## evidence snapshot
- Before the patch, eager project-generation association only verified project ownership, so a caller could silently attach an unowned generation id to a project association row.
- After the patch, eager association matches the stricter ownership behavior already used by snapshot backfill and restore canonicalization.

## validation run
- `npm run test -- lib/server/__tests__/projectGenerationAssociationsService.test.ts`
- `npm run test -- lib/server/__tests__/projectWorkspaceStatesService.test.ts`

## validation evidence
- `lib/server/__tests__/projectGenerationAssociationsService.test.ts`: 10 tests passed.
- `lib/server/__tests__/projectWorkspaceStatesService.test.ts`: 11 tests passed.

## self-audit findings
- The invariant gap was isolated to eager generation association; media association already enforced owned-id filtering and workspace snapshot backfill already enforced owned generation filtering.
- No adjacent owned-surface change had better ROI than stopping after this fix.

## issues fixed during self-audit
- None beyond the bounded ownership hardening patch.

## issues intentionally left out of scope
- Broader project workspace composition behavior in `projectWorkspaceSnapshot.ts`.
- Any non-project runtime/session persistence behavior.
- General AI Studio workflow or Media Library surface changes.

## blockers encountered
- None.

## residual risk
- Existing bad `project_generation_items` rows, if any were already written before this patch, are not cleaned up by this lane.
- Other restore behavior still depends on broader project-generation projection integrity, but this lane removes one path that could silently widen that trust boundary.

## recommended next step for Copperknot review
- Audit whether historic `project_generation_items` rows need a one-time cleanup pass for unowned generation ids before final ship evaluation.
