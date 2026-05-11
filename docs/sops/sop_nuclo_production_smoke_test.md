# Nuclo Production Smoke Test

Purpose: define the minimum manual and scripted smoke test Nuclo should use after environment, database, or production-wiring work.

## Scope

Use this SOP after:

- production Supabase rewiring,
- production Vercel env changes,
- auth-setting changes,
- storage migration/cutover,
- or database migrations that affect core user flows.

## Goal

Prove the production app is not only structurally correct, but usable by a real user.

## Prerequisites

1. Production deployment is already live.
2. Route parity passes.
3. Internal operator routes return the expected protected response (`401` or equivalent), not `404`.
4. No unresolved rollback decision remains.

## Smoke Sequence

### A. Public Reachability

1. Open `https://www.shortpulse.ai`
2. Confirm homepage loads normally.
3. Refresh once.

### B. New Account Flow

1. Create a brand new account with a fresh email.
2. If email verification is enabled, complete it.
3. Log in successfully.

### C. Persistence Flow

Create one small durable object in-app, such as:

- a project
- a character
- or one low-risk generation-related object

Then:

1. refresh the page
2. navigate away and back
3. confirm the object still exists

### D. Media / Storage Sanity

If the touched work involved media or storage:

1. upload or reference one small media item if the relevant UI is available
2. confirm it renders or is retrievable after refresh

### E. Operator Surface Sanity

Run the route parity helper:

```bash
node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai
```

Confirm protected internal routes return the expected protected response, not `404`.

## Minimum Pass Criteria

The smoke test passes only if all are true:

- homepage loads
- signup/login works
- one durable user object persists after refresh
- media access works if that lane was touched
- internal routes remain present and protected

## Failure Handling

If the smoke test fails:

1. capture the exact failing step
2. classify whether it is auth, data, storage, routing, or runtime flag related
3. decide whether the issue is hotfixable or rollback-worthy
4. update Nuclo memory only if the failure taught a durable operator lesson
