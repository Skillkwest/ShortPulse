# Project Workspace Persistence Hardening Closeout

- lane id: `project-workspace-persistence-hardening`
- source handoff path: `docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md`
- execution status: `bounded persistence patch complete`
- systems touched: `Project / workspace persistence`
- files changed:
  - `frontend/lib/server/projectWorkspaceStatesService.ts`
  - `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts`
  - `frontend/lib/server/__tests__/projectWorkspaceStatesService.test.ts`
  - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-31-project-workspace-persistence-hardening-closeout.md`

## Summary Of What Changed

- Tightened `sanitizeProjectWorkspaceOutputs(...)` so rows that still present as generated output now fail closed when they no longer have any durable project-owned authority or recoverable runtime identity.
- Reused shared project-workspace authority helpers from `projectWorkspaceSnapshot.ts` instead of inventing a separate restore-only definition of generated-output validity.
- Added the exact missing regression for the production failure class: a shape-valid generated row that already lost `generationId`, `promptId`, and `savedMediaIds`.

## Acceptance Criteria Reached

- One canonical persistence invariant was hardened in the owning server sanitizer used by both write preparation and read canonicalization.
- The result stayed inside the bounded server/test surface with no UI or UX edits.
- Orphan generated rows now fail closed once they no longer have any durable project-owned authority or recoverable runtime identity.

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
  - `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts`
- focused evidence added:
  - `frontend/lib/server/__tests__/projectWorkspaceStatesService.test.ts`

## Validation Run

- `npm -C frontend run test -- lib/server/__tests__/projectWorkspaceStatesService.test.ts`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/sessionSnapshot.test.ts`
- `npm -C frontend run docs:check`

## Validation Evidence

- `lib/server/__tests__/projectWorkspaceStatesService.test.ts`: passed (`25` tests)
- `features/ai-studio/logic/__tests__/sessionSnapshot.test.ts`: passed (`41` tests)
- `npm -C frontend run docs:check`: passed

## Self-Audit Findings

- The original orphan-row seam was real: a generated-looking row could survive once `generationId`, `promptId`, and `savedMediaIds` had already been stripped away.
- The better source fix was not a UI-level generated-row rule. It was to reuse the stricter project-workspace authority concepts already present in the canonical snapshot layer.
- A broad blank-workspace fail-closed response would have been too blunt for this lane because unrelated durable rows should still survive.

## Issues Fixed During Self-Audit

- Moved the read-path decision onto shared project-workspace authority helpers instead of leaving it as an ad hoc local rule.
- Added the exact orphan generated-row regression so the lane now proves the production failure class is filtered out.

## Issues Intentionally Left Out Of Scope

- No project-system redesign beyond the shared sanitize/read-write authority seam.
- No UI/client behavior changes.
- No migration or cleanup pass for historic `project_generation_items` rows.
- No changes to broader generated-output hydration flows outside this canonical workspace read path.

## Blockers Encountered

- None.

## Residual Risk

- This patch hardens the shared server-side sanitize seam locally, but it does not prove production is clean until the deployed restore path is rechecked.
- Historic bad association rows may still deserve their own cleanup lane if production proof shows more than the orphan generated-row class.

## Recommended Next Step For Copperknot Review

- Treat this as an accepted local `root fix`, hold the score, and rerun the existing project-persistence production audit after the patch is deployed.
