# AI Studio Crash / Browser Load / Reference Grid Diagnostic

Purpose: hand off the June 24 production crash diagnostic for the AI Studio project session at `https://www.shortpulse.ai/ai-studio?projectId=6c805215-340e-4353-902c-ebf46e9b811c&sid=e7003749-3310-4f55-9f58-0ff26d8327cb`.

## Executive Summary

The production project `Community skit` has a real crash and latency risk centered on the AI Studio Reference Grid and project workspace autosave path.

The strongest finding is that the project crossed the active Reference Grid workset limit in production:

- at `2026-06-24T22:13:20Z`, the persisted production workspace snapshot had `129` active visible Reference Grid rows and `0` archived rows
- current source and deployed production chunks both define the active visible cap as `128`
- production telemetry then showed high-severity `projects-workspace-save` failures carrying the same high-load shape: `129` active outputs, `0` archived outputs, `68` media ids, `96` generation ids, and a `386,514` byte request snapshot
- failures included Supabase statement timeout `57014`, Cloudflare `502`, Cloudflare `520`, and schema-cache retry errors

The best current diagnosis is not "one slow browser page." It is a coupled failure:

1. the project can persist or preserve an unsafe near-cap / over-cap Reference Grid state
2. every autosave near that state fans out into heavy server-side work: workspace row lookup/upsert, project output display-item sync, possible display cleanup, and project association backfill
3. that server-side save path is already failing in production, which can destabilize the browser through failed autosaves, retries, error handling, and continued heavy hydration/render pressure

No code edits or data repairs were made during this diagnostic.

## Scope

Inspected:

- production deployment / alias for `https://www.shortpulse.ai`
- authenticated production AI Studio load using the available Playwright audit account
- production Supabase project and workspace state using the production Supabase target
- production app error telemetry for the project owner
- current source for Reference Grid caps, project workspace snapshot creation, project workspace save route, display-item sync, and Reference Grid performance watchdogs
- deployed production JavaScript chunks for the active Reference Grid limit
- focused local Reference Grid cap tests

Not completed:

- project-owner browser visual reproduction, because the available audit account does not own `projectId=6c805215-340e-4353-902c-ebf46e9b811c`
- any data repair
- any code patch
- any production claim that the crash is fixed

## Production Surface

The production URL was inspected through Vercel:

- deployment id: `dpl_6F5XsrpCskKtHUivunsk3kzMNCsN`
- target: `production`
- status: `Ready`
- deployed URL: `https://shortpulse-7r8tdk3vq-kirk-artmans-projects.vercel.app`
- aliases included:
  - `https://www.shortpulse.ai`
  - `https://shortpulse.ai`
  - `https://shortpulse.vercel.app`
- created: `2026-06-24 13:38:49 America/Phoenix`
- Next build id observed from the page: `build-TfctsWXpff2fKS`

The signed-out page path is intentionally thin. Source shows the heavy AI Studio app is dynamically imported only after auth and media-compliance gating, and the production page script is small. That means the signed-out shell is not the crash surface. The crash surface is the authenticated project workspace hydration/autosave/runtime surface.

## Browser Load Evidence

Using the available audit account:

- route reached AI Studio protected surface
- ready text observed: `What do you want to make?`
- elapsed load time: about `6.7s`
- API fanout observed:
  - `/api/account/media-compliance`: `2` calls, average about `719ms`, max about `1057ms`
  - `/api/pricing/model-policy`: `1` call, about `361ms`
  - `/api/credits/snapshot`: `1` call, about `323ms`
  - `/api/projects/6c805215-340e-4353-902c-ebf46e9b811c/workspace`: `1` call, about `266ms`, status `404`

The `404` is expected because the audit account does not own the project. Therefore, this browser run proves the protected route shell and auth flow, but it does not prove the project owner's exact crashed grid hydration path.

The browser proof boundary is important:

- production route proof: yes
- production deployment proof: yes
- authenticated project-owner visual proof: no
- production database and telemetry proof for the actual project: yes

## Project State Evidence

The project exists in the production Supabase target:

- project id: `6c805215-340e-4353-902c-ebf46e9b811c`
- title: `Community skit`
- production Supabase host inspected: `ftgrqgjrchpimronuhop.supabase.co`
- project/workspace owner ids matched

At `2026-06-24T22:13:20Z`, the workspace snapshot had:

- schema version: `2`
- checkpoint revision: `2061`
- snapshot updated at: `2026-06-24T22:13:13.959Z`
- row updated at: `2026-06-24T22:13:15.386Z`
- snapshot bytes: `244,099`
- active output rows: `129`
- active visible rows: `129`
- active hidden rows: `0`
- archived rows: `0`
- visible All Refs count: `129`
- Quick Slot visible count: `0`
- total visible right-rail count: `129`
- duplicate active ids: `0`
- stale Quick Slot ids: `0`

Mode mix at that point:

- text: `19`
- video: `47`
- image: `46`
- audio: `17`

Current task states were all `unknown` in the persisted snapshot shape.

There were `14` non-text rows that did not show obvious durable media authority fields in the inspected snapshot shape. Example ids included:

- `upload-hlo7vk103cv`
- `upload-d2s907t55d`
- `upload-c7drtvq6vn8`
- `upload-4woc8dyqjr5`
- `upload-2tte6lhsyy`
- `upload-9tqavuckrrj`
- `library-o7fxb84mmw`
- `library-qkj40qctuz`

These may still resolve through secondary projection/display state, but they are suspect as persisted active Reference Grid rows and should be audited before any broad cleanup or repair.

At `2026-06-24T22:20:50Z`, the project had changed while the audit was still running:

- checkpoint revision: `2077`
- snapshot updated at: `2026-06-24T22:18:21.073Z`
- row updated at: `2026-06-24T22:18:22.236Z`
- snapshot bytes: `243,703`
- active rows: `127`
- visible active rows: `127`
- archived rows: `0`
- display-item rows: `127`
- missing display rows for active outputs: `0`
- stale display rows: `0`
- latest display row updated at: `2026-06-24T22:18:23.424Z`
- max display-item version observed: `3044`

This movement strongly suggests an active browser tab, recovery loop, or autosave loop was still mutating this project during the audit.

## Error Telemetry Evidence

For the project owner, production `app_error_events` in the last 24 hours included:

- total event rows read: `255`
- relevant event count: `192`
- top relevant source: `api.exception`
- `api.exception` count: `154`
- recurring low-severity generation telemetry:
  - `telemetry.generation.recovery.media_visible`
  - `telemetry.generation.visibility_suppressed`
- repeated `telemetry.generation.visibility_suppressed` reason: `reference_grid_clear`

For the last 8 hours, `projects-workspace-save` exception events matched:

- rows matched: `154`
- stage count:
  - `workspace save`: `39` in the compact recent query
  - `project lookup`: `1`
- repeated failing shapes:
  - `299879b / 107 active / 107 total`: `28` events
  - `299878b / 107 active / 107 total`: `6` events
  - `386514b / 129 active / 129 total`: `5` events
  - `299875b / 107 active / 107 total`: `1` event

Recent high-signal failures:

- `2026-06-24T21:50:11.961Z`
  - stage: `workspace save`
  - snapshot bytes: `386,514`
  - active outputs: `129`
  - archived outputs: `0`
  - total outputs: `129`
  - media ids: `68`
  - generation ids: `96`
  - error: `Project workspace save failed during workspace upsert: canceling statement due to statement timeout 57014`
- `2026-06-24T21:50:11.331Z`
  - same shape and same statement timeout
- `2026-06-24T21:50:08.791Z`
  - same shape
  - error included Cloudflare `502`
- `2026-06-24T21:50:04.299Z`
  - stage: `project lookup`
  - same shape
  - message: `Failed to load project`
- `2026-06-24T21:49:21.587Z`
  - same shape
  - error included Cloudflare `502`

Earlier failures at `107` active outputs produced Cloudflare `520`, schema-cache retries (`PGRST002`), and lookup/upsert failures. That means the persistence path was already brittle before the project crossed `128`.

## Source Findings

### Reference Grid Limit

Canonical current source:

- `frontend/features/ai-studio/reference-grid/logic/referenceGridLimits.ts`

Current source defines:

- `REFERENCE_GRID_WARN_VISIBLE_ITEMS = 96`
- `REFERENCE_GRID_MAX_VISIBLE_ITEMS = 128`
- cap message: `Reference Grid is limited to 128 items...`

The cap helper:

- preserves hidden rows
- keeps only the first `128` visible rows
- returns trimmed overflow rows/ids

### Normal React State Path

Canonical current source:

- `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`

The normal active output state path calls `normalizeActiveRows(...)`, which:

- sorts by `createdAt` descending when possible
- calls `limitReferenceGridVisibleOutputs(...)`
- moves trimmed rows into overflow archive rows

`setOutputsState(...)` and `setOutputCollectionsForAuthority(...)` both use this normalization path. Focused local tests also passed for current cap behavior.

Interpretation:

- the current isolated React state cap is not the likely broken helper
- if over-cap state persists, the likely issue is a bypass, stale tab, persistence sanitizer gap, or ordering/timing issue around project snapshot restore/save

### Project Workspace Snapshot Build

Canonical current source:

- `frontend/features/ai-studio/hooks/useAiStudioSessionSnapshotController.ts`

`buildProjectWorkspaceSnapshot(...)` intentionally writes:

- `outputs`
- `archivedOutputs: []`
- `curatedReferenceIds`
- `removedFromAllRefsIds`

This means project workspace persistence does not preserve the active in-memory archived Reference Grid rows in the durable project snapshot.

That design may be intentional as a lightweight project snapshot model, but it creates a bad failure mode near the cap:

- if active outputs are already over-cap or otherwise unsafe, the project save can persist the unsafe active set
- archived overflow is not available as a durable recovery buffer
- old/stale clients or restore paths can keep reintroducing the same active-heavy shape

### Server Snapshot Sanitizer

Canonical current source:

- `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts`

`createAiStudioProjectWorkspaceSnapshot(...)` calls `stripFailedOutputsFromProjectWorkspaceOutputs(...)` and normalizes project workspace state. It does not independently enforce the visible Reference Grid cap.

This is the likely missing production guardrail. A server-side canonical sanitizer should be able to reject, cap, archive, or safely drop over-cap active visible rows regardless of what any client sends.

### Project Workspace Save Route

Canonical current sources:

- `frontend/pages/api/projects/[...projectPath].ts`
- `frontend/lib/server/projectApiRoutes/workspace.ts`
- `frontend/lib/server/projectWorkspaceStatesService.ts`
- `frontend/lib/server/projectOutputDisplayItemsService.ts`

The client save uses:

- `PUT /api/projects/:projectId/workspace`
- `Prefer: return=minimal`
- one network retry

The server route:

- parses and summarizes the incoming request body
- authenticates user
- checks project ownership
- calls `upsertProjectWorkspaceStateForUser(...)`
- logs failures with snapshot counts and bytes

`upsertProjectWorkspaceStateForUser(...)` does more than write one row:

1. parses and shape-validates the snapshot
2. preserves canvas storage authority
3. sanitizes the project workspace snapshot
4. resolves owned media/prompt/generation ids
5. reads the existing `project_workspace_states` row
6. computes a lightweight checkpoint snapshot
7. upserts the workspace row if needed
8. syncs `project_output_display_items`
9. may run display cleanup
10. backfills project asset associations
11. may materialize a save response snapshot

Several follow-up stages are best-effort with a `12,000ms` budget, but the observed production failures show the overall route can still fail under database/provider pressure before or during critical save stages.

### Display-Item Sync Load

Canonical current source:

- `frontend/lib/server/projectOutputDisplayItemsService.ts`

`syncProjectOutputDisplayItemsForSnapshot(...)`:

- loads all existing display rows for the project
- maps every active output to a display candidate
- compares candidates with existing rows via JSON serialization of display values
- upserts changed rows in chunks
- deletes stale rows unless deletions are deferred

At `107` to `129` active outputs, this is a meaningful amount of work for every autosave. It is not a browser-only cost; it becomes server/database load and can cascade back to the browser through failed saves and retries.

## Deployed Chunk Findings

The deployed production chunks for deployment `dpl_6F5XsrpCskKtHUivunsk3kzMNCsN` were scanned.

Important deployed chunk:

- `static/chunks/7608.2fec295dc98a62ac.js`

Observed deployed behavior:

- `aH=128`
- Reference Grid limit copy says `Reference Grid is limited to ${aH} items...`
- All Refs header renders `Media: count / aH`
- density pressure uses `>=128` and `>=96`
- no deployed reference to `NEXT_PUBLIC_REFERENCE_GRID_ACTIVE_LIMIT`

Interpretation:

- the deployed production bundle is aligned with the current hard-coded `128` limit
- a local Vercel env snapshot contained `NEXT_PUBLIC_REFERENCE_GRID_ACTIVE_LIMIT=500`, but current source and deployed chunks do not use it
- the env value should still be cleaned up or documented later because it is misleading, but it does not appear to control the deployed Reference Grid limit

## Validation

Focused local tests were run with the bundled Node runtime and local Vitest binary:

```bash
PATH="/Users/worldbuilder/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
  node_modules/.bin/vitest --run \
  features/ai-studio/hooks/__tests__/useAiStudioOutputCollectionState.test.ts \
  features/ai-studio/hooks/__tests__/useAiStudioReferenceGridStateActions.test.ts \
  features/ai-studio/reference-grid/components/__tests__/ReferenceGridArchiveControls.test.ts
```

Result:

- test files: `3 passed`
- tests: `12 passed`

Proof boundary:

- proves current isolated cap/archive controls pass local focused tests
- does not prove project workspace restore/save cannot bypass or preserve over-cap state
- does not prove the crash is fixed

## Working Theory

The best current working theory:

1. A project-owner session accumulated a very large active Reference Grid workset.
2. At least one client/save path persisted `129` active visible rows with `0` archived rows even though current cap logic is `128`.
3. Project autosave near that shape repeatedly invoked the heavyweight workspace save path.
4. Production database/API layers began failing with statement timeouts, Cloudflare errors, and schema-cache retry failures.
5. The browser then experienced compounded pressure:
   - heavy Reference Grid hydration/rendering
   - many mixed media cards, including `47` videos and `17` audio rows
   - suspect rows with missing immediate durable authority
   - repeated autosaves
   - failed autosave retries/error handling
   - possible active tab/recovery loop continuing to mutate the project

This is consistent with the user's report that the session crashed and that browser load/lag is the highest priority.

## Most Likely Root Seams

### P0: Server-Side Cap Missing From Project Workspace Persistence

Current source enforces the cap in UI state helpers but not as an independent server-side save sanitizer.

The server should not trust incoming project workspace snapshots to already be capped. It should enforce the active visible Reference Grid cap at the canonical project workspace boundary.

Candidate owner files:

- `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts`
- `frontend/lib/server/projectWorkspaceStatesService.ts`
- relevant tests under:
  - `frontend/features/ai-studio/logic/__tests__/sessionSnapshot.test.ts`
  - `frontend/lib/server/__tests__/projectWorkspaceStatesService.test.ts`

### P0: Project Workspace Save Does Too Much Work In The Critical Path

The route writes the checkpoint and then performs display sync and association backfill around the same request lifecycle. Production failures show this path is brittle at `107` outputs and worse at `129`.

Candidate owner files:

- `frontend/lib/server/projectWorkspaceStatesService.ts`
- `frontend/lib/server/projectOutputDisplayItemsService.ts`
- `frontend/features/ai-studio/logic/projectWorkspaceApiClient.ts`

High-ROI direction:

- keep the canonical workspace checkpoint write small and reliable
- avoid repeated display sync when structure has not meaningfully changed
- move heavy repair/backfill work out of the critical autosave response path where safe
- preserve telemetry for skipped/deferred repair

### P1: Durable Archive Semantics Are Ambiguous For Project Workspace

`buildProjectWorkspaceSnapshot(...)` passes `archivedOutputs: []`.

If this is intentional, the project workspace system needs an explicit durable decision for overflow:

- archive overflow somewhere durable
- hide overflow safely
- drop overflow with telemetry and user-facing recovery path
- or rehydrate from Media Library as the archive authority

The current state is risky because the system can have zero durable overflow while still carrying a large active set.

### P1: Suspect Active Rows With Missing Authority

There were `14` active non-text rows without obvious durable authority in the snapshot shape.

These should be inspected before repair:

- determine whether they resolve through `project_output_display_items`, media rows, generation rows, or fallback URLs
- classify whether they are safe active refs, blank cards, or stale orphan rows
- do not blindly delete until owner/snapshot/display authority is reconciled

### P2: Duplicate Media Compliance Call

The audit account trace observed two `/api/account/media-compliance` calls during route load. One took just over `1s`.

This is not the likely crash root, but it is a browser-load cleanup candidate after the P0 save/grid issues.

## Recommended Next Agent Plan

### Step 1: Freeze The Problem Shape

Before editing, re-query production:

- project workspace active/visible/archived counts
- checkpoint revision
- snapshot bytes
- `project_output_display_items` count
- recent `projects-workspace-save` errors
- recent `reference_grid_clear` telemetry

Reason: the project mutated from `129` to `127` during the audit, so the next agent must treat this as live state, not a static dump.

### Step 2: Add Server-Side Cap Test First

Add a failing test showing that a project workspace snapshot with `129+` visible active rows cannot be persisted/returned as `129+` visible active rows.

The test should cover:

- active visible rows over `128`
- archived overflow behavior, or explicit safe-drop behavior if archive is not durable by design
- preservation of hidden rows
- no duplicate ids
- deterministic ordering

### Step 3: Patch The Canonical Sanitizer

Patch the project workspace snapshot/sanitizer boundary so all project workspace writes are capped regardless of client state.

Do not add a parallel client-only patch as the main fix. Client cap behavior already exists and passed focused tests.

### Step 4: Make Save Path Less Fragile

Audit and patch the autosave route so display sync/backfill does not keep causing request failure when the checkpoint itself is valid.

Candidate directions:

- stricter minimal response path
- skip display sync when active output structure/checkpoint did not change
- async/deferred display repair marker
- shorter and more isolated best-effort stages
- improved telemetry distinguishing checkpoint write success from display/backfill repair failure

### Step 5: Repair This Project

After code protection exists, run a deliberate production repair for `Community skit`:

- cap active visible rows to <= `128`
- preserve or explicitly archive/drop overflow according to the canonical fix
- reconcile `project_output_display_items`
- verify no stale display rows
- verify no active suspect rows are blank/broken unless intentionally retained

Do not run ad-hoc data cleanup before the canonical guard exists unless the user explicitly approves an emergency manual repair.

### Step 6: Production Browser Proof

With project-owner auth:

- open the exact URL on `https://www.shortpulse.ai`
- record initial load time
- record Reference Grid `Media: x/128`
- inspect `data-grid-*` attributes on the Reference Grid root:
  - rendered item count
  - image hydration queue size
  - image decode inflight count
  - perf degrade level
  - density pressure level
  - watchdog long-task p95
  - max input stall
  - background visual work suspended
- watch network for workspace save failures
- verify no browser crash

## Suggested Acceptance Criteria

The lane should not claim fixed until all are true:

- production project workspace writes cannot persist more than `128` visible active Reference Grid rows
- over-cap incoming snapshots are handled deterministically and telemetry records the correction
- the `Community skit` project is repaired or confirmed already safe
- workspace autosave no longer fails on the repaired project under production owner auth
- owner-auth production browser load of the exact URL does not crash
- Reference Grid count is visible and <= `128`
- production telemetry shows no new high-severity `projects-workspace-save` failures for this project during verification

## Commands / Evidence Sources Used

Production deployment:

```bash
PATH="/Users/worldbuilder/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
  /Users/worldbuilder/.nvm/versions/node/v22.16.0/bin/vercel inspect https://www.shortpulse.ai
```

Production browser trace:

```bash
set -a
source frontend/.env.local
set +a
/Users/worldbuilder/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  scripts/capture_ai_studio_production_trace.mjs \
  --project-id 6c805215-340e-4353-902c-ebf46e9b811c \
  --sid e7003749-3310-4f55-9f58-0ff26d8327cb \
  --email "$PLAYWRIGHT_AUDIT_EMAIL" \
  --password "$PLAYWRIGHT_AUDIT_PASSWORD" \
  --timeout-ms 90000
```

Focused local tests:

```bash
PATH="/Users/worldbuilder/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" \
  node_modules/.bin/vitest --run \
  features/ai-studio/hooks/__tests__/useAiStudioOutputCollectionState.test.ts \
  features/ai-studio/hooks/__tests__/useAiStudioReferenceGridStateActions.test.ts \
  features/ai-studio/reference-grid/components/__tests__/ReferenceGridArchiveControls.test.ts
```

Key inspected files:

- `frontend/features/ai-studio/reference-grid/logic/referenceGridLimits.ts`
- `frontend/features/ai-studio/hooks/useAiStudioOutputCollectionState.ts`
- `frontend/features/ai-studio/hooks/useAiStudioSessionSnapshotController.ts`
- `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
- `frontend/lib/ai-studio-session/projectWorkspaceSnapshot.ts`
- `frontend/lib/server/projectApiRoutes/workspace.ts`
- `frontend/pages/api/projects/[...projectPath].ts`
- `frontend/lib/server/projectWorkspaceStatesService.ts`
- `frontend/lib/server/projectOutputDisplayItemsService.ts`
- `frontend/features/ai-studio/logic/projectWorkspaceApiClient.ts`
- `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- `frontend/features/ai-studio/hooks/useReferenceGridPerfWatchdog.ts`
- `docs/monitoring.md`

## Stop Condition For This Report

This report is diagnostic-only. It is sufficient to hand off to an implementation agent.

The next agent should not continue as a generic latency lane. The concrete repo-backed problem statement is:

> Project workspace persistence can accept or preserve a near-cap / over-cap active Reference Grid state, and production autosave/display-sync work is failing under that shape. Add a canonical server-side cap/overflow contract and reduce the autosave critical path enough that this project can load and save on production without crashing.
