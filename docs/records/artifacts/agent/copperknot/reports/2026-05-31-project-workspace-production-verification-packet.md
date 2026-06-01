# Copperknot May 31 Project / Workspace Production Verification Packet

Purpose: define the exact next production proof for the accepted May 31 local persistence root fix so Copperknot can decide whether `Project / workspace persistence` stays below floor, reaches floor, or opens a narrower cleanup follow-up.

## Verification Target

- Branch expectation: `production`
- Runtime surface:
  - `https://www.shortpulse.ai`
- System:
  - `Project / workspace persistence`
- Current score:
  - `6/10`
- Ship floor:
  - `7/10`
- Current status:
  - accepted local `root fix`
  - score held pending deploy and production remeasurement

## Why This Proof Exists

The accepted May 31 patch hardened the canonical read seam in:

- `frontend/lib/server/projectWorkspaceStatesService.ts`

It now degrades unresolved generation ownership during restore instead of returning the broader shape-sanitized snapshot unchanged.

Copperknot still needs production proof before treating that as launch-readiness progress beyond `repo durable`.

## Canonical Verification Command

Run this against production:

```bash
cd frontend
PLAYWRIGHT_PROJECT_BASE_URL=https://www.shortpulse.ai \
PLAYWRIGHT_AUDIT_EMAIL=<audit-email> \
PLAYWRIGHT_AUDIT_PASSWORD=<audit-password> \
npm run test:e2e:project-persistence
```

## Required Environment

- `PLAYWRIGHT_PROJECT_BASE_URL=https://www.shortpulse.ai`
- `PLAYWRIGHT_AUDIT_EMAIL=<real audit account>`
- `PLAYWRIGHT_AUDIT_PASSWORD=<audit password>`

Do not use localhost for this proof unless the user explicitly asks for a local dry run. The script defaults to `http://localhost:3000`, so the base URL override is required for launch-readiness verification.

## What This Audit Actually Verifies

The browser audit in:

- `frontend/tests/e2e/project-persistence.audit.js`

checks all of these on the live production surface:

1. Signs in with a real audit account.
2. Creates a real project through `POST /api/projects/create`.
3. Confirms project list/read contracts still work.
4. Confirms invalid project and route cases still fail with the expected API statuses.
5. Confirms global Media Library folder CRUD still works and remains independent from project-local persistence.
6. Saves a legacy-style orphan workspace snapshot directly through the real project workspace API.
7. Reads that workspace back and requires server canonicalization to strip the orphan generated output.
8. Reopens the live `/ai-studio?projectId=<uuid>` route and requires the UI to avoid rendering the orphan preview media or orphan text.
9. Fails on severe console/page/runtime signals or severe production-origin failed responses.
10. Deletes the audit project in cleanup.

## Pass Criteria

Treat the proof as passed only when all of these are true:

- the audit exits successfully
- the persisted workspace readback shows:
  - `activeCount: 0`
  - `archivedCount: 0`
- the persisted workspace snapshot does not contain the orphan preview URL
- the reopened UI does not render:
  - orphan image sources
  - orphan video sources
  - orphan label text
- severe console/page signals are empty
- severe production-origin failed responses are empty

## Failure Interpretation

If the audit fails:

- `persisted workspace still exposed outputs`
  - the server-side canonical read or save contract is still leaking orphan restore state
- `orphan preview URL still present`
  - the canonicalized snapshot still preserves bad generated-output state
- `UI still renders orphan media/text`
  - the live restore surface still leaks unresolved generated output after reopen
- severe console/page/runtime signals
  - treat as runtime instability or contract regression, not just a persistence miss
- severe production-origin failed responses
  - treat as a real production blocker until triaged

## Queue Decision Rules After This Proof

- If the audit passes cleanly:
  - keep `Project / workspace persistence` at `6/10` only if broader row confidence is still too thin
  - otherwise consider whether the row can move to ship floor
- If the audit fails in the exact orphan-restore class:
  - keep `Project / workspace persistence` exact next
  - do not open a new adjacent lane
- If the audit passes but historic association-row cleanup still looks risky:
  - package a narrower cleanup or verification follow-up on `project_generation_items`
  - do not pretend the cleanup need is proven before the runtime proof exists

## Evidence Classification

- current patch state:
  - `repo durable`
- this packet after a passing live rerun:
  - `production durable`

## Related Evidence

- `docs/records/artifacts/agent/copperknot/reports/2026-05-31-project-workspace-persistence-root-seam-audit.md`
- `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/2026-05-31-project-workspace-persistence-hardening-closeout.md`
- `docs/records/artifacts/agent/copperknot/reports/2026-05-31-project-workspace-persistence-closeout-review.md`
