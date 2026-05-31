# Copperknot May 31 Project / Workspace Persistence Closeout Review

Purpose: review the returned May 31 persistence closeout against the root-seam audit, decide whether the patch is a real source fix, and determine whether queue or score posture should move before production proof.

## Review Target

- Branch: `production`
- Worktree included: yes
- Evidence mix:
  - `repo durable`
  - `retained comparison`
- Reviewed closeout:
  - `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-31-project-workspace-persistence-hardening-closeout.md`

## What Was Reviewed

- `frontend/lib/server/projectWorkspaceStatesService.ts`
- `frontend/lib/server/__tests__/projectWorkspaceStatesService.test.ts`
- `frontend/lib/server/__tests__/projectGenerationAssociationsService.test.ts`

Authority comparison anchors:

- `docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-31-project-workspace-persistence-root-seam-audit.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-31-approved-panel-post-deploy-verification.md`

## Main Outcome

- The returned patch is real forward progress and should be accepted as a `root fix`.
- No score lift is justified yet.
- `Project / workspace persistence` stays exact next until the accepted local fix is deployed and remeasured on production.

## Why I Accepted It

The root-seam audit identified one canonical trust problem:

- `canonicalizeProjectWorkspaceSnapshotForRead(...)` could preserve unresolved generated rows when read-time ownership resolution failed.

The accepted patch fixes that source seam directly by:

- resolving media, prompt, and generation ownership independently during read sanitization
- degrading only the unresolved authority family instead of returning the broader shape-sanitized snapshot unchanged
- re-sanitizing the returned snapshot after ownership-based filtering
- failing closed to an ownership-safe snapshot if the read-time sanitization path crashes unexpectedly

This is source-level behavior in the owning read path, not a parallel workaround.

## Why I Did Not Move The Score

This is still a local accepted patch, not production proof.

The row remains `6/10` because:

- the patch reduces one meaningful restore-trust weakness
- the broader persistence row still lacks fresh production confirmation after this exact change
- historic association-row cleanliness is still an open residual risk

## Validation I Re-Ran

- `npm -C frontend run test -- lib/server/__tests__/projectWorkspaceStatesService.test.ts`
- `npm -C frontend run test -- lib/server/__tests__/projectGenerationAssociationsService.test.ts`
- `npm -C frontend run docs:check`

## Validation Results

- `projectWorkspaceStatesService.test.ts`: passed (`24` tests)
- `projectGenerationAssociationsService.test.ts`: passed (`22` tests)
- `docs:check`: passed

## Scope Judgment

Accepted with one caveat:

- the worker added a little extra focused test coverage around read/save snapshot sanitization shape, but it stayed inside the same owning test surface and did not broaden into unrelated product work

I do not see UI, UX, or intended behavior drift in the accepted diff.

## Queue Decision

Keep the exact-next order:

1. `Project / workspace persistence`
2. `Characters workflow`
3. `Elements workflow`

Why:

- the persistence lane is improved, but not yet proven on production
- that means the higher-priority persistence row should not be treated as cleared by local patch acceptance alone

## Score Posture

- `Project / workspace persistence`
  - keep `6/10`
  - reason:
    - accepted local `root fix`
    - score held pending deploy and production remeasurement

## Recommended Next Step

Do not dispatch a new product lane yet.

The next proof is:

- deploy the accepted persistence patch on `production`
- rerun focused production verification for the project/workspace restore surface
- then decide whether:
  - the row stays `6/10`
  - the row can move to floor
  - or the historic `project_generation_items` cleanup risk needs its own follow-up lane
