# Copperknot May 31 Project / Workspace Production Verification Failure

Purpose: record the first live production verification result for the accepted May 31 local persistence root fix and decide whether `Project / workspace persistence` remains the exact next lane.

## Verification Target

- Branch expectation: `production`
- Production URL:
  - `https://www.shortpulse.ai`
- System:
  - `Project / workspace persistence`
- Current score before verification:
  - `6/10`
- Ship floor:
  - `7/10`

## Verification Command

```bash
cd frontend
PLAYWRIGHT_PROJECT_BASE_URL=https://www.shortpulse.ai \
PLAYWRIGHT_AUDIT_EMAIL=<audit-email> \
PLAYWRIGHT_AUDIT_PASSWORD=<audit-password> \
npm run test:e2e:project-persistence
```

## Result

- status: `failed`
- evidence class:
  - `production durable`

## Main Failure

The production audit failed before the UI orphan-render check because the live project workspace read still returned the orphan generated output in the canonicalized snapshot.

Exact failure:

- `Canonicalized project workspace still exposed persisted outputs`

The returned production snapshot still contained:

- one active generated row with:
  - `id: "legacy-orphan-output"`
  - orphan preview URL
  - orphan prompt label

That means the live restore contract still preserves the orphan generated output class on production.

## What This Proves

- The accepted local root fix is not yet proven on production.
- Same-day deployment inspection later showed the live `www.shortpulse.ai` deployment was created after the accepted persistence-fix commit, so stale alias drift is no longer the leading explanation.
- The strongest remaining source seam is now the generated-output restore filter in:
  - `frontend/lib/server/projectWorkspaceStatesService.ts`
  - `sanitizeProjectWorkspaceOutputs(...)`
  - inner `sanitizeRows(...)`
- Generated rows that have lost canonical association ids can still survive read canonicalization when they remain shape-valid.
- More precisely:
  - `collectSnapshotGenerationIds(...)` only resolves ownership for rows that still carry a `generationId`
  - `sanitizeProjectWorkspaceOutputs(...)` only drops rows when a disallowed `generationId` is still present
  - a row can therefore survive if it still presents as generated output but has already lost `generationId`, `promptId`, and `savedMediaIds`
  - the repo already has a stricter write-time project workspace keep/drop contract in `shouldPersistOutputInProjectWorkspaceSnapshot(...)`, so the likely source fix is to align read canonicalization with that existing authority instead of introducing a new looser restore-only rule

## Queue Decision

Keep the exact-next order:

1. `Project / workspace persistence`
2. `Characters workflow`
3. `Elements workflow`

Why:

- the live restore contract still fails the exact orphan-output class the May 31 local root fix was supposed to harden
- that means persistence remains the highest-ROI unresolved production-readiness lane

## Score Posture

- `Project / workspace persistence`
  - keep `6/10`
  - reason:
    - fresh production failure confirms the row stays below floor
    - the local root fix cannot be treated as a maturity lift yet

No other score moves are justified from this proof.

## Recommended Next Step

Do not open a new adjacent lane.

The next exact move is:

1. narrow the persistence handoff to the orphan generated-output fail-closed predicate inside the generated-output restore filter
2. dispatch that bounded follow-up only if approved
3. rerun the same project persistence production audit after the returned fix lands

## Related Evidence

- `docs/records/artifacts/agent/copperknot/reports/2026-05-31-project-workspace-persistence-root-seam-audit.md`
- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-31-project-workspace-persistence-hardening-closeout.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-31-project-workspace-persistence-closeout-review.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-31-project-workspace-production-verification-packet.md`
