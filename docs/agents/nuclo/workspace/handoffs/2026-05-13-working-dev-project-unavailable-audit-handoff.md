# Working-Dev `Project unavailable` Repair + Debug Handoff

Date: 2026-05-13  
Owner receiving handoff: next debugging agent  
Prepared by: Nuclo

## Scope

Audit and partially repair the new working-development Supabase setup after the user signed into localhost with a fresh dev account and hit the AI Studio error state:

- title: `Project unavailable`
- message: `Project not found.`

The goal here is to give the next agent a grounded continuation point with:

- the exact database/runtime findings,
- the fixes already applied,
- the validation already completed,
- and the remaining debug/verification work.

## Branch / Runtime Context

- Repo branch: `working-development`
- Local runtime target: `frontend/.env.local`
- Dedicated dev Supabase project ref: `bgdhqbenqltxildlgkyu`
- Staging Supabase project ref: `jwmcytzyhcvacjwqtynn`
- Production Supabase project ref: `ftgrqgjrchpimronuhop`

## What Was Audited

### Code paths

- `frontend/features/ai-studio/hooks/useAiStudioProjectIdentity.ts`
- `frontend/features/ai-studio/components/AiStudioPageShell.tsx`
- `frontend/features/ai-studio/components/AiStudioProjectEntryState.tsx`
- `frontend/features/ai-studio/components/ProjectsModal.tsx`
- `frontend/pages/ai-studio.tsx`
- `frontend/pages/dashboard.tsx`
- `frontend/features/projects/hooks/useProjectCreationDialog.ts`
- `frontend/features/projects/logic/projectCreateClient.ts`
- `frontend/lib/server/projectsService.ts`
- `frontend/lib/server/projectApiRoutes/item.ts`
- `frontend/pages/api/projects/index.ts`
- `frontend/pages/api/projects/create.ts`
- `frontend/pages/api/projects/[...projectPath].ts`

### Database checks

Targeted hosted DB inspection on the dedicated dev project and staging project:

- auth user counts
- project/workspace row presence
- billing bootstrap row presence
- `auth.users` custom trigger presence
- `projects` / `project_workspace_states` policies
- `projects` / `project_workspace_states` grants
- storage bucket presence

## Key Findings

### 1. The immediate UI failure is caused by a route-scoped project lookup, not a broken schema

`useAiStudioProjectIdentity()` only shows this exact error state when AI Studio is trying to resolve a `projectId` query param and `/api/projects/:projectId` returns `404` for the signed-in caller.

Relevant files:

- `frontend/features/ai-studio/hooks/useAiStudioProjectIdentity.ts`
- `frontend/lib/server/projectApiRoutes/item.ts`
- `frontend/lib/server/projectsService.ts`

Interpretation:

- `/ai-studio` with **no** `projectId` should not hit this error path.
- `/ai-studio?projectId=<uuid>` **will** fail closed if that project does not belong to the authenticated user.

### 2. The new working-dev account originally owned zero projects and zero workspace snapshots

Direct dev DB inspection showed:

- `auth.users`: `1`
- `public.projects`: `0`
- `public.project_workspace_states`: `0`

For the newest auth user (masked in audit output), the counts were:

- `billing_profiles`: `0`
- `active billing contracts`: `0`
- `projects`: `0`
- `workspace snapshots`: `0`

Interpretation:

- The account exists.
- There is no owned project row to satisfy a `projectId` route.
- There is no workspace snapshot row either.

### 3. Fresh-user billing bootstrap was broken on the dev project

This is a real bootstrap defect introduced by the earlier dev setup approach.

Staging has this custom trigger on `auth.users`:

- `on_auth_user_created_billing_setup`

Dev does **not**.

Staging also has the trigger function:

- `public.handle_new_user_billing_setup()`

Dev still has the function, but the trigger on `auth.users` is absent.

Interpretation:

- The earlier dev bootstrap restored the `public` schema and synced ACLs, but it did **not** recreate the auth-side trigger attachment.
- Fresh dev signups therefore skip normal post-auth billing/bootstrap setup.

### 4. The original new dev user was missing the rows that trigger should have created

For the current fresh dev user:

- no `billing_profiles` row
- no active `billing_subscription_contracts` row
- no per-user `ai_credit_balance` row
- no per-user starter `ai_credit_ledger` row

Interpretation:

- This matches the missing trigger exactly.
- It is separate from the `Project not found` error, but it is part of the same dev bootstrap quality issue and should be fixed before more user testing.

### 5. Public-schema and policy posture are not the immediate problem

Things that looked healthy:

- `public` schema parity against staging had already been restored earlier
- `projects` and `project_workspace_states` RLS policies exist on dev
- `projects` and `project_workspace_states` grant posture on dev matches staging
- `storage.buckets` contains `media_library` on dev, matching staging
- local app env still points to the dev project after normalization of the base URL form
- custom trigger parity is mostly intact; the meaningful missing trigger is on `auth.users`

More specifically:

- staging custom triggers: `41`
- dev custom triggers: `39`
- meaningful app-side missing trigger on dev:
  - `auth.users.on_auth_user_created_billing_setup`
- other missing trigger:
  - `cron.job.cron_job_cache_invalidate`

Interpretation of the `cron` difference:

- that one appears extension/platform-local and is not the likely cause of the current app failure
- the `auth.users` trigger is the one that matters for fresh-user behavior

Interpretation:

- The immediate failure is not “the dev DB is missing the projects table” or “localhost is still pointed at staging/prod”.
- The bootstrap gap is not a broad collapse of all custom trigger wiring. It is narrow and concentrated in the auth-side signup bootstrap lane.

### 6. The most likely repro path is a stale or foreign `projectId` route

Because `/ai-studio` without a `projectId` does not enter this error branch, the likely repro is:

1. user signs in with the fresh dev account
2. AI Studio is opened on a URL that still carries `?projectId=<existing-or-stale-id>`
3. project lookup runs as the new user
4. lookup returns `404`
5. page renders `Project unavailable / Project not found.`

This could happen from:

- an existing localhost AI Studio tab
- a copied/bookmarked deep link
- a route push from a prior account/session context

### 7. There was a UX recovery gap even if the database were perfect

Independent code audit conclusion at initial audit time:

- AI Studio’s error shell shows `Retry project load` and `Back to dashboard`
- it does **not** expose `ProjectsModal` or `New Project` in-place while gated on the bad route
- dashboard’s `ProjectsModal` is also mounted **without** `onCreateProject`, so a zero-project user cannot create a project from inside that modal

Relevant files:

- `frontend/features/ai-studio/components/AiStudioPageShell.tsx`
- `frontend/features/ai-studio/components/ProjectsModal.tsx`
- `frontend/pages/dashboard.tsx`

Interpretation at initial audit time:

- Fresh users could recover, but only by leaving AI Studio and then using the separate dashboard new-project path.
- That was friction, not hard corruption, but it made this issue feel worse than it was.

## What Has Been Fixed Since The Initial Audit

### 1. Dev signup bootstrap trigger was restored from canonical repo SQL

Applied on the dedicated dev project:

- `sql/migrate_new_user_plan_default_to_free.sql`

Result:

- `auth.users.on_auth_user_created_billing_setup` now exists on dev
- the trigger points to `public.handle_new_user_billing_setup()`

### 2. The already-created dev user was backfilled safely

The user created before trigger repair was backfilled with the baseline rows the signup trigger is expected to establish:

- `billing_profiles`
- `ai_credit_balance`
- `ai_credit_ledger` signup seed

Important nuance:

- this repaired user already had a prior `ai_credit_ledger` `admin_adjustment` row, so their post-backfill balance is higher than the clean fresh-signup baseline
- that is expected for that specific user and is not evidence of trigger failure

### 3. Fresh signup bootstrap now works on dev

A smoke-test auth user was created on the dev project after the trigger repair.

Verified automatically created rows:

- `billing_profiles = 1`
- `ai_credit_balance = 1`
- `ai_credit_ledger signup_seed = 1`
- `plan_id = free`
- `subscription_status = active`
- `balance_cents = 100`

Important interpretation:

- fresh signup bootstrap is now working
- fresh signup does **not** automatically create a project
- current product contract appears to be manual first-project creation, not auto-project creation

### 4. AI Studio recovery path was improved in code

Tracked UI/code fixes already applied:

- `frontend/features/ai-studio/components/AiStudioPageShell.tsx`
  - AI Studio error state now exposes `Open projects` instead of only `Retry project load`
  - `ProjectsModal` now remains mounted while project bootstrap is gated
- `frontend/pages/ai-studio.tsx`
  - passes `onOpenProjectsModal`
- `frontend/pages/dashboard.tsx`
  - dashboard `ProjectsModal` now receives `onCreateProject={openProject}`

Interpretation:

- zero-project users should now have an in-flow recovery path instead of a harder dead end
- this still needs browser-level confirmation against the actual localhost experience

### 5. Regression coverage was added for the new recovery behavior

Added/updated tests:

- `frontend/features/ai-studio/components/__tests__/AiStudioPageShell.test.tsx`
- `frontend/tests/pages/ai-studio.project-modal-boundary.test.ts`

Targeted validation already passed from the `frontend/` workspace:

- `npm exec vitest run --environment jsdom features/ai-studio/components/__tests__/AiStudioPageShell.test.tsx features/ai-studio/components/__tests__/ProjectsModal.test.tsx`
- `npm exec vitest run tests/pages/ai-studio.project-modal-boundary.test.ts`

## Current Best Explanation

There were two stacked issues:

1. **Broken dev signup bootstrap**
   - fixed now by restoring `auth.users.on_auth_user_created_billing_setup`
2. **Poor stale-project recovery UX**
   - partially fixed in code by exposing `ProjectsModal` + create flow in the recovery path

The exact screenshot error is still best explained by:

- a user with zero owned projects
- landing on `/ai-studio?projectId=<stale-or-foreign-id>`
- getting the correct caller-owned `404`

The difference now is that the environment bootstrap defect is fixed and the recovery UI is materially better.

## Most Likely Root-Cause Chain

There are **two** real problems here:

1. **Immediate route/data mismatch**
   - the new dev user has no projects
   - AI Studio is opening with a `projectId`
   - route lookup 404s correctly

2. **Dev bootstrap incompleteness**
   - the dedicated dev project was bootstrapped from `public` schema parity only
   - auth-side signup trigger wiring did not come across
   - fresh users therefore miss the normal billing/bootstrap rows

The screenshot’s exact `Project not found` message is explained by problem `1`.

The larger quality issue in the working-dev setup is problem `2`.

## What Not To Conclude

- Do **not** conclude that the dev database is generically broken.
- Do **not** conclude that the local runtime is still pointed at the wrong Supabase project.
- Do **not** conclude that project creation is impossible.
- Do **not** conclude that fresh signup is still missing billing bootstrap rows; that defect has been repaired and smoke-tested.
- Do **not** delete users or user-owned data while debugging this.

## Remaining Debug / Verification Work

### Priority 1: browser-level verification of the repaired flow

Use the actual localhost session and confirm the repaired UX end to end:

1. sign in as the repaired or a fresh dev user
2. open plain `/ai-studio`
3. open `/ai-studio?projectId=<bad-or-foreign-id>`
4. verify the error state now exposes `Open projects`
5. verify `ProjectsModal` opens from that state
6. verify project creation works from the modal or the dashboard path
7. verify the new owned project opens successfully in AI Studio

Important local-runtime note:

- there was already another local Next dev server on port `3000` during this run
- a fresh `npm run dev` attempt started on `3001`, then stopped because another Next dev server was already active on `3000`
- do not assume a second server instance is required; verify which local server is actually serving the current localhost tab before drawing conclusions

### Priority 2: confirm the manual first-project contract in the browser, not just from SQL/code

Current evidence strongly suggests:

- fresh users are expected to create their first project manually
- project creation is not part of signup bootstrap

The next agent should confirm the real browser journey aligns with that contract.

### Priority 3: decide whether any additional UX cleanup is still worth doing

If browser verification still feels clunky after the current fixes, inspect whether any of these remain useful:

- further copy/CTA improvements on the `Project unavailable` state
- auto-opening the projects modal when the route fails
- stronger zero-project guidance on plain `/ai-studio`

### Priority 4: leave unrelated build-red alone unless you explicitly take it on

`npm -C frontend run build` is still red on an unrelated pre-existing TypeScript issue:

- `frontend/features/ai-studio/components/create/PulseCreatePropertiesPanel.tsx`
- branch around line `124`
- `PromptStepPulseLoadingState.message` receives `null` where `string` is expected

This is not part of the dev-bootstrap/project-recovery lane.

## Validation Already Completed

Completed successfully:

 - dev trigger restored on `auth.users`
 - repaired existing dev user has baseline billing/credit bootstrap rows
 - fresh smoke-test signup now gets the expected bootstrap baseline automatically
 - targeted Vitest coverage for the AI Studio recovery path passes
 - `npm -C frontend run docs:check` passes

Not yet completed in this lane:

- browser-level end-to-end confirmation of the repaired localhost recovery flow

## Safety Constraints

- Dev-only mutation scope for this lane
- Do not mutate staging or production while continuing this issue
- Do not delete auth users or user-owned data
- Prefer canonical repo SQL over ad hoc bootstrap logic when touching auth-side setup
- bad route reproduces current error
- plain route should not hit `Project not found`

### Priority 4: verify project creation works for the dev user after billing bootstrap is repaired

Use either:

- dashboard `New Project`
- AI Studio `ProjectsModal` when accessible

Then confirm:

- a `public.projects` row is created for the user
- navigating to `/ai-studio?projectId=<new-id>` succeeds
- a `project_workspace_states` row is created once workspace persistence runs

### Priority 5: consider a product fix for stale-link recovery

High-value UI fix candidates:

- expose `New Project` directly on AI Studio’s `Project unavailable` state
- allow `ProjectsModal` recovery from the gated error shell
- wire dashboard `ProjectsModal` with `onCreateProject` so zero-project users can recover in one place

## Safe Workarounds For The User Right Now

Until the next agent fixes the bootstrap gaps:

1. leave the failing AI Studio tab
2. go to `/dashboard`
3. use `New Project`
4. let the app route back to `/ai-studio?projectId=<new-project-id>`

If the user is still stuck on a stale deep link, clearing the `projectId` route by opening plain `/ai-studio` or returning through `/dashboard` should avoid the immediate 404 path.

## Evidence Summary

### Code evidence

- AI Studio project error requires project route lookup failure:
  - `frontend/features/ai-studio/hooks/useAiStudioProjectIdentity.ts`
  - `frontend/features/ai-studio/components/AiStudioPageShell.tsx`
- Project lookup is caller-owned:
  - `frontend/lib/server/projectApiRoutes/item.ts`
  - `frontend/lib/server/projectsService.ts`
- Project creation is explicit/manual:
  - `frontend/features/projects/logic/projectCreateClient.ts`
  - `frontend/pages/api/projects/create.ts`
  - `frontend/pages/dashboard.tsx`

### Database evidence

- dev has `1` auth user and `0` project/workspace rows
- staging has `on_auth_user_created_billing_setup` on `auth.users`
- dev does not
- dev user has `0` billing bootstrap rows

## Constraints

- Do not delete auth users.
- Do not delete user-owned data.
- Do not rotate secrets during this debugging lane.
- Keep raw secrets out of tracked docs and handoffs.
