# Project Workspace Persistence Hardening Closeout

- lane id: `project-workspace-persistence-hardening`
- source handoff path: `docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md`
- execution status: `bounded persistence patch complete`
- systems touched: `Project / workspace persistence`
- files changed:
  - `frontend/lib/server/projectWorkspaceStatesService.ts`
  - `frontend/lib/server/__tests__/projectWorkspaceStatesService.test.ts`
  - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-31-project-workspace-persistence-hardening-closeout.md`

## Summary Of What Changed

- Changed `canonicalizeProjectWorkspaceSnapshotForRead(...)` to resolve media, prompt, and generation ownership independently on read instead of treating read-time ownership resolution as all-or-nothing.
- When one ownership family fails, the read path now degrades only that unresolved authority surface instead of returning the broader shape-sanitized snapshot unchanged.
- Added a hard fail-closed fallback for unexpected read-sanitization crashes by returning an ownership-safe snapshot with no verified media, prompt, or generation associations.
- Expanded focused tests to prove unresolved generated rows are dropped while unrelated media-backed rows stay restorable.

## Acceptance Criteria Reached

- One canonical persistence invariant was hardened in the owning read path.
- The result stayed inside the bounded server/test surface with no UI or UX edits.
- The read path now fails closed for unresolved generated restore authority instead of preserving those rows unchanged.

## Evidence Snapshot

- authority docs loaded:
  - `docs/systems/catalog.md`
  - `docs/sops/sop_ai_studio_projects_foundation.md`
  - `docs/adr/0062-project-identity-foundation.md`
  - `docs/adr/0063-project-workspace-authority.md`
  - `docs/adr/0070-project-workspace-conversational-runtime-exclusion.md`
- handoff + audit loaded:
  - `docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md`
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-31-project-workspace-persistence-root-seam-audit.md`
- code seam changed:
  - `frontend/lib/server/projectWorkspaceStatesService.ts`
- focused evidence added:
  - `frontend/lib/server/__tests__/projectWorkspaceStatesService.test.ts`

## Validation Run

- `npm -C frontend run test -- lib/server/__tests__/projectWorkspaceStatesService.test.ts`
- `npm -C frontend run test -- lib/server/__tests__/projectGenerationAssociationsService.test.ts`
- `npm -C frontend run docs:check`

## Validation Evidence

- `lib/server/__tests__/projectWorkspaceStatesService.test.ts`: passed (`24` tests)
- `lib/server/__tests__/projectGenerationAssociationsService.test.ts`: passed (`22` tests)
- `npm -C frontend run docs:check`: passed

## Self-Audit Findings

- The original root seam was real: read-time ownership resolution used one `Promise.all(...)` gate, so a single generation lookup failure preserved all shape-sanitized generated rows.
- A full blank-workspace fail-closed response would have been too blunt for this bounded lane because it would also discard unrelated durable rows.
- The bounded source fix is to degrade unresolved ownership families independently in the canonical read path.

## Issues Fixed During Self-Audit

- Re-sanitized the read snapshot after ownership-based output filtering so the returned project snapshot stays on the canonical project-workspace shape after degradation.
- Added a mixed-row regression test so the lane proves we preserve verified media-backed rows while dropping unresolved generated rows.

## Issues Intentionally Left Out Of Scope

- No project-system redesign beyond the read-time ownership seam.
- No UI/client behavior changes.
- No migration or cleanup pass for historic `project_generation_items` rows.
- No changes to broader generated-output hydration flows outside this canonical workspace read path.

## Blockers Encountered

- None.

## Residual Risk

- This patch hardens the live read seam, but it does not clean historic bad association rows already stored in the database.
- The fallback still preserves non-generated durable workspace content when that content does not depend on the failed ownership family; that is intentional, but it means this lane reduces trust broadness at the ownership seam rather than performing a broader data-repair pass.

## Recommended Next Step For Copperknot Review

- Review whether historic `project_generation_items` cleanup or verification should become its own follow-up lane now that the live read path no longer returns unresolved generated rows unchanged.
