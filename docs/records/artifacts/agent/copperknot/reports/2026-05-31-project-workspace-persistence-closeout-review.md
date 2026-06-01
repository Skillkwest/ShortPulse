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
- `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts`
- `frontend/lib/server/__tests__/projectWorkspaceStatesService.test.ts`
- `frontend/features/ai-studio/logic/__tests__/sessionSnapshot.test.ts`

Authority comparison anchors:

- `docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-31-project-workspace-persistence-root-seam-audit.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-31-approved-panel-post-deploy-verification.md`

## Main Outcome

- The returned patch and follow-up local audit/fix are real forward progress and should be accepted as a `root fix`.
- No score lift is justified yet.
- `Project / workspace persistence` stays exact next until the accepted local fixes are deployed and remeasured on production.

## Why I Accepted It

The root-seam audit identified one canonical trust problem:

- `canonicalizeProjectWorkspaceSnapshotForRead(...)` could preserve orphan generated rows that still looked shape-valid after they lost canonical association ids.

The accepted patch fixes that source seam directly by:

- reusing shared project-workspace authority helpers from `projectWorkspaceSnapshot.ts` instead of inventing a restore-only rule
- treating generated-looking rows as restore-safe only when they still have durable project-owned authority or recoverable runtime identity
- failing closed inside the shared server sanitizer when a generated-looking row has already lost `generationId`, `promptId`, and `savedMediaIds`
- adding the exact regression for the orphan generated-output row shape seen in live production evidence

Follow-up code audit found the more precise remaining source problem:

- the previous read ownership resolver only collected rows that still had `generationId`
- generated rows with recoverable runtime identity through `taskId` or `sourceRef` could therefore skip generation ownership resolution
- the current worktree now resolves ownership by `generationId`, `taskId`, and `sourceRef`
- read canonicalization now keeps runtime-identity generated rows only when that ownership lookup succeeds, and drops them when generation ownership resolution fails

This is source-level behavior in the owning read path, not a parallel workaround.

## Why I Did Not Move The Score

This is still a local accepted patch, not production proof.

The row remains `6/10` because:

- the patch reduces one meaningful restore-trust weakness
- the broader persistence row still lacks fresh production confirmation after this exact change
- historic association-row cleanliness is still an open residual risk

## Validation I Re-Ran

- `npm -C frontend run test -- lib/server/__tests__/projectWorkspaceStatesService.test.ts`
- `npm -C frontend run test -- features/ai-studio/logic/__tests__/sessionSnapshot.test.ts`
- `npm -C frontend run docs:check`

## Validation Results

- `projectWorkspaceStatesService.test.ts`: passed (`27` tests)
- `sessionSnapshot.test.ts`: passed (`41` tests)
- `docs:check`: passed

## Scope Judgment

Accepted with one caveat:

- the worker touched the shared snapshot authority helper surface to keep read/write restore rules aligned, but it stayed inside the same owning persistence contract and did not broaden into unrelated product work

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
