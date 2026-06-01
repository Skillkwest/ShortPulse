# Copperknot May 31 Project / Workspace Production Verification Pass

Purpose: record the production proof for the accepted project workspace persistence root fix and decide the current launch posture for `Project / workspace persistence`.

## Verification Target

- Runtime surface: `https://www.shortpulse.ai`
- System: `Project / workspace persistence`
- Previous score: `6/10`
- Ship floor: `7/10`
- Evidence class: `production durable`

## Verification Command

```bash
cd frontend
PLAYWRIGHT_PROJECT_BASE_URL=https://www.shortpulse.ai \
PLAYWRIGHT_AUDIT_EMAIL=<audit-email> \
PLAYWRIGHT_AUDIT_PASSWORD=<audit-password> \
npm run test:e2e:project-persistence
```

## Result

- status: `passed`
- project id created by audit: `c0901a1b-25d0-4d77-81ce-3279ef080985`
- persisted workspace readback:
  - `activeCount: 0`
  - `archivedCount: 0`
- reopened UI:
  - orphan image sources: none
  - orphan video sources: none
  - orphan text visible: `false`
  - reference card count: `0`
- severe console/page signals: none
- severe production-origin failed responses: none

## Decision

`Project / workspace persistence` now reaches ship floor at `7/10`.

Why:

- the main known production restore defect no longer reproduces
- read canonicalization now resolves generated restore authority through `generationId`, `taskId`, and `sourceRef`
- unresolved generated ownership now fails closed instead of preserving orphan restore state
- focused local regression coverage exists for the orphan row and runtime-identity row shapes
- the same class passed on the production URL after deployment

## Residual Risk

- This is not a `10/10` maturity claim.
- Broader project workspace evolution still includes migration and association-cleanup risk.
- No fresh evidence currently proves an open ship-blocking persistence defect.

## Queue Impact

- Move `Project / workspace persistence` out of exact-next execution.
- Make `Characters workflow` the exact next launch-readiness lane.
- Keep `Project / workspace persistence` available for follow-up only if fresh production evidence reopens it.
