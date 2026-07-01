# Handoff: Supabase Egress PostgREST Optimization

Date: 2026-07-01 11:16 MST
Authoring agent: Nuclo
Target repo: `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse`
Active branch policy: pre-launch `production` only
Target environment: hosted production
Supabase project: `ShortPulse - PRODUCTION - Live`
Production project ref: `ftgrqgjrchpimronuhop`
Supabase organization: `Sleepy Sea Monster`

## Purpose

This handoff gives the next agent enough context to continue the Supabase egress optimization lane without re-auditing from scratch or making low-confidence changes.

The current evidence says the egress issue is materially improved from the earlier incident, but not fully solved. The current cycle is still PostgREST-led, so the next agent should focus on reducing repeated heavy PostgREST payload hydration paths while preserving AI Studio correctness, restore behavior, generation progress UX, and production launch posture.

## Current Ask

Continue the egress optimization lane from evidence, not guesswork.

The next agent should:

1. Reconfirm the current production evidence.
2. Audit the exact hot PostgREST query paths in repo source.
3. Identify the canonical source fix.
4. Make only high-ROI changes that reduce repeated heavy payload reads.
5. Preserve current UI/UX and AI Studio behavior.
6. Validate locally and, where possible, with production-safe diagnostics after deployment.

## Critical Operating Rules

- Work only on the local `production` branch unless the user explicitly changes pre-launch policy in the current thread.
- Do not commit, push, deploy, mutate Supabase config, or mutate Vercel config unless the user explicitly asks for that action.
- Do not edit another agent's folder.
- Do not use Supabase image transformations on any path, for any reason.
- Do not expose service-role keys, database URLs, passwords, raw SQL connection strings, signed URLs, user ids, tokens, prompts, or object paths in reports.
- Use Supabase CLI and hosted-safe SQL access only. Do not use Docker-based Supabase workflows.
- Treat local env files as convenience surfaces, not deployed source of truth.
- Treat temporary files under `/tmp` as scratch evidence only, not durable source of truth.
- Preserve AI Studio generation progress, restore/reload, project/workspace state, credit/billing behavior, and visible UI/UX unless the user explicitly approves a product behavior change.

## Source Of Truth Loaded By Nuclo

Use these first:

- `AGENTS.md`
- `docs/agents/nuclo/README.md`
- `docs/agents/nuclo/memory.md`
- `docs/agents/nuclo/CURRENT-HANDOFF.md`
- `docs/records/artifacts/agent/nuclo/reports/README.md`
- `docs/records/artifacts/agent/nuclo/reports/2026-06-20-supabase-egress-optimization-production-audit.md`

For the implementation pass, also inspect:

- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- `docs/sops/sop_sql_migration_operations.md`
- any relevant AI Studio SOPs before touching AI Studio runtime state or restore behavior

Do not bulk-load old retained reports. The relevant retained report is the 2026-06-20 egress optimization audit, especially the dashboard/service-split and PostgREST payload sections.

## Production Evidence From 2026-07-01

### Supabase Dashboard Evidence

Authenticated dashboard page:

`https://supabase.com/dashboard/org/aettteppbagwsszkrgde/usage?projectRef=ftgrqgjrchpimronuhop`

The dashboard was filtered to production project `ftgrqgjrchpimronuhop`.

Billing cycle shown:

- `25 Jun 2026 - 11 Jul 2026`

Production-filtered Usage Summary:

- Egress: `49.933 GB`
- Cached Egress: `9.718 GB`
- Storage Size: `0.41 GB`
- Monthly Active Users: `8 MAU`
- Monthly Active SSO Users: `0 MAU`
- Monthly Active Third-Party Users: `0 MAU`
- Storage Image Transformations: `0`
- Realtime Concurrent Peak Connections: `0`
- Realtime Messages: `0`
- Edge Function Invocations: `0`
- Log Drain Events: `0`
- Micro Compute Hours: `140 hours`

Important interpretation:

- The current cycle is much lower than the previously captured high-egress cycle.
- The issue is improved, but not gone.
- Supabase Image Transformations are still `0`, so the current issue is not the old image-transformation regression.
- Realtime, Edge Functions, and Log Drains are not current drivers.
- Cached egress is nonzero but lower than uncached egress.

### Current Daily Egress Tooltip Capture

Production-filtered daily Egress chart tooltips:

| Date        |        Auth |    PostgREST |      Storage | Main driver           |
| ----------- | ----------: | -----------: | -----------: | --------------------- |
| 25 Jun 2026 |  `1.555 MB` | `578.844 MB` | `533.829 MB` | PostgREST slight lead |
| 26 Jun 2026 |  `5.219 MB` |   `3.915 GB` |   `2.029 GB` | PostgREST             |
| 27 Jun 2026 |  `5.431 MB` |   `4.641 GB` |   `2.379 GB` | PostgREST             |
| 28 Jun 2026 | `10.641 MB` |   `5.041 GB` |   `2.531 GB` | PostgREST             |
| 29 Jun 2026 |  `5.031 MB` |   `5.478 GB` |   `1.727 GB` | PostgREST             |
| 30 Jun 2026 | `15.349 MB` |   `9.782 GB` |    `2.59 GB` | PostgREST             |
| 01 Jul 2026 |  `4.602 MB` |   `4.367 GB` | `912.295 MB` | PostgREST             |

Cached egress tooltip capture:

| Date        | Cached Egress |
| ----------- | ------------: |
| 25 Jun 2026 |   `99.829 MB` |
| 26 Jun 2026 |  `641.153 MB` |
| 27 Jun 2026 |     `1.43 GB` |
| 28 Jun 2026 |    `1.831 GB` |
| 29 Jun 2026 |    `1.664 GB` |
| 30 Jun 2026 |    `2.743 GB` |
| 01 Jul 2026 |  `674.205 MB` |

Important interpretation:

- `30 Jun 2026` is the current-cycle spike day.
- PostgREST is still the dominant egress component on every captured day.
- Storage is secondary, not zero. Do not ignore Storage forever, but do not pivot back to Storage unless refreshed dashboard proof shows Storage has become the dominant current driver.
- `01 Jul 2026` is a partial-day value as of the diagnostic time.

## Production SQL Evidence From 2026-07-01

Nuclo ran read-only production SQL diagnostics against production project `ftgrqgjrchpimronuhop`.

Raw scratch outputs were written to:

`/tmp/shortpulse-egress-diagnostic-20260701T1102MST`

Scratch files:

- `/tmp/shortpulse-egress-diagnostic-20260701T1102MST/check_database_egress_query_stats.out`
- `/tmp/shortpulse-egress-diagnostic-20260701T1102MST/check_postgrest_payload_projection_risk.out`
- `/tmp/shortpulse-egress-diagnostic-20260701T1102MST/check_scheduler_egress_activity.out`

These files are not durable source of truth. Rerun the diagnostics instead of depending on `/tmp`.

Commands used:

```bash
psql "$SHORTPULSE_PRODUCTION_DB_URL" -X -v ON_ERROR_STOP=1 \
  -f sql/check_database_egress_query_stats.sql

psql "$SHORTPULSE_PRODUCTION_DB_URL" -X -v ON_ERROR_STOP=1 \
  -f sql/check_postgrest_payload_projection_risk.sql

psql "$SHORTPULSE_PRODUCTION_DB_URL" -X -v ON_ERROR_STOP=1 \
  -f sql/check_scheduler_egress_activity.sql
```

Production DB connectivity proof:

- Production project ref from local agent env: `ftgrqgjrchpimronuhop`
- DB name: `postgres`
- DB timestamp at connectivity check: `2026-07-01 18:02:16.90474+00`

`pg_stat_statements` reset:

- `2026-06-30 23:46:16.586483+00`
- This gives a fresh-ish approximately `18.27` hour window for the SQL stats captured on 2026-07-01.

Top current query classes since reset:

| Query class                       |     Calls | Rows/call | Weighted mean |
| --------------------------------- | --------: | --------: | ------------: |
| `postgrest_session_setup`         | `102,385` |   `1.000` |    `0.030 ms` |
| `other`                           |  `57,270` |   `5.223` |    `4.931 ms` |
| `connection_transaction_overhead` |  `51,698` |   `0.000` |    `0.005 ms` |
| `public.generation_projection`    |  `35,868` |   `1.000` |    `3.386 ms` |
| `pg_net_cron_internal`            |  `22,129` |   `6.100` |    `0.480 ms` |
| `auth_internal`                   |  `19,819` |   `1.124` |    `0.056 ms` |
| `public.project_generation_items` |  `11,356` |   `1.000` |    `0.127 ms` |
| `public.ai_generations`           |   `4,511` |   `1.000` |   `30.839 ms` |
| `storage.objects`                 |   `4,247` |  `18.007` |   `11.216 ms` |
| `pooler_auth`                     |   `2,134` |   `1.000` |    `0.181 ms` |

Current approximate rates:

| Shape                                                     |              Rate |
| --------------------------------------------------------- | ----------------: |
| `postgrest_session_setup`                                 | about `93.42/min` |
| `public.generation_projection`                            | about `32.73/min` |
| `public.ai_generations`                                   |  about `4.12/min` |
| `project_generation_items`                                | about `10.36/min` |
| `storage.objects`                                         |  about `3.87/min` |
| `generation_projection_workspace_runtime_key`             |  about `7.38/min` |
| `ai_generations_request_lookup`                           |  about `3.45/min` |
| `generated_output_full_context_hydration`                 |  about `0.33/min` |
| `terminal_projection_repair_projection_by_generation_ids` |  about `0.85/min` |
| `terminal_projection_repair_generation_scan`              |  about `0.66/min` |
| `terminal_projection_repair_projection_scan`              |  about `0.07/min` |

Hot generation query shapes:

| Query shape                                   |    Calls | Rows/call | Weighted mean |
| --------------------------------------------- | -------: | --------: | ------------: |
| `project_generation_items`                    | `11,356` |   `1.000` |    `0.127 ms` |
| `generation_projection_request_lookup`        | `10,896` |   `1.000` |    `0.096 ms` |
| `generation_projection_project_scoped`        |  `9,881` |   `1.000` |    `0.677 ms` |
| `generation_projection_workspace_runtime_key` |  `8,091` |   `1.000` |   `13.909 ms` |
| `generation_projection_other`                 |  `6,421` |   `1.000` |    `0.137 ms` |
| `ai_generations_request_lookup`               |  `3,777` |   `1.000` |   `36.309 ms` |
| `ai_generations_status_or_recovery`           |    `734` |   `1.000` |    `2.693 ms` |
| `generation_projection_source_ref_lookup`     |    `579` |   `1.000` |    `0.500 ms` |

Payload-size findings:

| Table/field                               |    Rows |            Avg |           P50 |             P90 |             P99 |        Total |
| ----------------------------------------- | ------: | -------------: | ------------: | --------------: | --------------: | -----------: |
| `ai_generations._full_row`                | `8,831` | `19,707 bytes` | `1,984 bytes` |   `8,488 bytes` | `272,096 bytes` | `165.971 MB` |
| `generation_projection._full_row`         | `3,274` | `52,363 bytes` | `4,433 bytes` | `220,845 bytes` | `420,742 bytes` | `163.493 MB` |
| `ai_generations.metadata`                 | `8,831` | `18,838 bytes` | `1,097 bytes` |   `6,588 bytes` | `271,438 bytes` | `158.651 MB` |
| `generation_projection.style_context`     | `3,274` | `17,273 bytes` |     `5 bytes` |  `71,090 bytes` | `138,874 bytes` |  `53.930 MB` |
| `generation_projection.generation_replay` | `3,274` | `16,891 bytes` | `1,486 bytes` |  `73,707 bytes` | `140,319 bytes` |  `52.740 MB` |
| `generation_projection.workflow_reload`   | `3,274` | `16,249 bytes` | `1,269 bytes` |  `74,097 bytes` | `141,609 bytes` |  `50.735 MB` |

Projection-risk findings:

| Relation                   | Query path                                                | Risk                               | Filter                  |    Calls |         Mean |
| -------------------------- | --------------------------------------------------------- | ---------------------------------- | ----------------------- | -------: | -----------: |
| `project_generation_items` | `other`                                                   | `select_star_or_postgrest_wrapper` | `project_id`            | `11,356` |   `0.127 ms` |
| `generation_projection`    | `other`                                                   | `select_star_or_postgrest_wrapper` | `generation_id`         | `10,271` |   `0.099 ms` |
| `generation_projection`    | `other`                                                   | `select_star_or_postgrest_wrapper` | `request_id`            |  `9,222` |   `0.100 ms` |
| `generation_projection`    | `generated_output_lightweight_hydration`                  | `selects_heavy_payload_columns`    | `generation_id`         |  `6,747` |   `0.168 ms` |
| `generation_projection`    | `other`                                                   | `selects_heavy_payload_columns`    | `status_or_recovery`    |  `4,784` |   `0.073 ms` |
| `ai_generations`           | `other`                                                   | `select_star_or_postgrest_wrapper` | `request_id`            |  `2,669` |   `0.181 ms` |
| `generation_projection`    | `terminal_projection_repair_projection_by_generation_ids` | `selects_heavy_payload_columns`    | `generation_id`         |    `937` | `100.453 ms` |
| `ai_generations`           | `terminal_projection_repair_generation_scan`              | `selects_heavy_payload_columns`    | `request_id`            |    `723` |  `91.197 ms` |
| `generation_projection`    | `generated_output_full_context_hydration`                 | `selects_heavy_payload_columns`    | `workspace_runtime_key` |    `358` |  `49.266 ms` |
| `generation_projection`    | `terminal_projection_repair_projection_scan`              | `selects_heavy_payload_columns`    | `terminal_repair`       |     `73` |  `71.359 ms` |

Important interpretation:

- The current PostgREST problem is still one-row high-frequency reads, not obvious giant multi-row result sets.
- The dashboard says PostgREST is still the dominant billed egress component.
- The SQL says the hot repo-backed shapes are still `generation_projection`, `project_generation_items`, and `ai_generations` reads.
- The payload diagnostic says heavy fields remain expensive when selected repeatedly:
  - `generation_projection.generation_replay`
  - `generation_projection.workflow_reload`
  - `generation_projection.style_context`
  - `generation_projection.character_context`
  - `generation_projection.error_payload`
  - `ai_generations.metadata`
- The current rates are much lower than the prior high-egress incident, so do not make broad or risky changes. Make targeted payload/cadence changes only where the repo trace proves repeated heavy fields are on frequent paths.

### Scheduler Sanity Check

Active cron jobs:

- `shortpulse_generation_recovery_every_minute`
- `shortpulse_media_derivatives_every_minute`
- `shortpulse_admin_user_health_fleet_hourly`
- `shortpulse_internal_billing_renewals_hourly`
- daily pruning jobs

Last two-hour scheduler proof:

- every-minute jobs ran `120` times each across the two-hour window
- responses were mostly `200`
- only two `409` responses
- no evidence of duplicate scheduler job storm
- no evidence that scheduler is the primary current egress driver

Do not start by changing cron cadence.

## Current Diagnosis

The egress lane has improved but remains PostgREST-led.

The old high-cycle evidence showed production around `402 GB` egress with sustained daily PostgREST spikes above `50 GB` on the worst days. The current cycle is around `49.933 GB` production-filtered egress as of 2026-07-01, with the highest current day captured at `30 Jun 2026`:

- PostgREST: `9.782 GB`
- Storage: `2.59 GB`
- Auth: `15.349 MB`

This is much better, but still expensive for a tiny active user population. The next agent should treat this as an optimization/launch-risk lane, not an emergency outage lane.

Root direction:

- Keep focusing on PostgREST payload/cadence.
- Do not chase Supabase image transformations.
- Do not chase Edge Functions, Realtime, or Log Drains.
- Do not change scheduler cadence without new proof.
- Keep Storage as a secondary follow-up only if dashboard proof changes.

## Likely Repo Source Areas

Start with these files:

- `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
- `frontend/features/ai-studio/hooks/useAiStudioGeneratedOutputMaintenance.ts`
- `frontend/lib/server/api/falStatusProxy.ts`
- `frontend/lib/server/api/generationReconcile.ts`
- `frontend/pages/api/*generation*`
- `frontend/pages/api/*fal*`
- `frontend/pages/api/*project*`

Also inspect any functions that call:

- `listVisibleGeneratedOutputs`
- `toHydratedGeneratedOutput`
- `toProjectionDelivery`
- `GENERATION_PROJECTION_DELIVERY_SELECT_COLUMN_LIST`
- request-id lookup against `ai_generations`
- request-id lookup against `generation_projection`
- project-generation hydration
- terminal projection repair
- status/reconcile polling

The prior Nuclo source trace specifically identified:

- `GENERATION_PROJECTION_DELIVERY_SELECT_COLUMN_LIST` includes heavy columns:
  - `generation_replay`
  - `workflow_reload`
  - `character_context`
  - `style_context`
  - `error_payload`
- Frequent delivery/display hydration may not need all heavy restore/replay fields.
- Heavy fields have valid uses for workflow reload, style context, character context, audio/music restore, and replay metadata.
- The correct shape is not "delete heavy fields." The likely correct shape is "split frequent lightweight display/status hydration from on-demand heavy restore/reload hydration."

## Recommended Implementation Strategy

### Phase 1: Reconfirm Current Evidence

Before editing:

1. Confirm branch:

```bash
git branch --show-current
git config --local shortpulse.allowedBranch
```

Both should be `production`.

2. Confirm no conflicting dirty files in the target seam:

```bash
git status --short
```

If another owner has dirty changes in the exact files you need, stop and ask the user whether to wait for that owner.

3. Rerun production-safe SQL diagnostics:

```bash
psql "$SHORTPULSE_PRODUCTION_DB_URL" -X -v ON_ERROR_STOP=1 \
  -f sql/check_database_egress_query_stats.sql

psql "$SHORTPULSE_PRODUCTION_DB_URL" -X -v ON_ERROR_STOP=1 \
  -f sql/check_postgrest_payload_projection_risk.sql
```

4. Refresh Supabase Usage dashboard if available:

`https://supabase.com/dashboard/org/aettteppbagwsszkrgde/usage?projectRef=ftgrqgjrchpimronuhop`

Capture:

- Egress total
- Cached egress total
- Storage Image Transformations
- Daily Egress chart tooltip split for the most recent full day and current partial day

### Phase 2: Trace Hot Paths

Trace source from query shapes to API/client paths.

Questions to answer before editing:

- Which runtime path produces the `generation_projection` `select_star_or_postgrest_wrapper` by `generation_id`?
- Which runtime path produces the `generation_projection` `select_star_or_postgrest_wrapper` by `request_id`?
- Which path uses `generated_output_lightweight_hydration` but still selects heavy payload columns?
- Which path selects `ai_generations.metadata` by `request_id`?
- Which terminal projection repair path still selects heavy fields, and how often does it run?
- Is the `30 Jun` PostgREST spike explainable by app polling, production operator usage, generation recovery, project restore, AI Studio reload, or a recently deployed loop?

Do not patch until each candidate path has an owner and a current reason it appears in the hot query classes.

### Phase 3: Preferred Source Fix Shape

Preferred fix:

- Create or use a lightweight select list for frequent display/status/delivery hydration.
- Keep heavy fields out of frequent paths unless directly required.
- Fetch heavy restore/replay/style payloads on demand, only when:
  - workflow reload is requested,
  - a project/workspace restore path needs it,
  - a detail panel/action explicitly needs it,
  - terminal repair actually needs it to reconcile state.

Likely source-level changes:

- Split `GENERATION_PROJECTION_DELIVERY_SELECT_COLUMN_LIST` into:
  - lightweight display/status/delivery columns
  - heavy restore/reload/context columns
- Ensure `listVisibleGeneratedOutputs` uses the lightweight list when only rendering output cards or resolving delivery state.
- Introduce a narrowly named heavy fetch helper for restore/reload operations if one does not already exist.
- Avoid broad fallback logic that silently re-fetches heavy payloads after every lightweight call.
- Avoid global polling slowdown unless request-cadence proof says cadence, not payload, is the dominant cost.

Bad fixes:

- Removing restore metadata entirely.
- Breaking workflow reload.
- Breaking audio/music/companion-art restore semantics.
- Slowing all generation progress polling without proving polling is the actual driver.
- Adding indexes blindly.
- Adding duplicate APIs or parallel authorities.
- Caching user-owned results in a way that weakens RLS/privacy.
- Moving payload state into localStorage or browser-only memory as a persistence substitute.

### Phase 4: Validation

Minimum local validation:

```bash
cd frontend
npm run test -- <targeted tests>
npm run type-check
```

Prefer targeted tests around:

- generated media authority mapping
- AI Studio output restore
- workflow reload
- project generation hydration
- active generation/status polling
- terminal repair/reconcile behavior

If touching Generate CTAs or generation active-state behavior, also run the Generate CTA contract check.

Minimum self-audit:

- Inspect diff for broad behavior changes.
- Confirm no UI copy/layout changes unless explicitly intended.
- Confirm no billing/credit changes.
- Confirm no Supabase image transformation usage.
- Confirm no service-role exposure.
- Confirm no destructive SQL.

Production-safe post-deploy proof:

After the user deploys or explicitly asks for deployment validation:

1. Rerun:

```bash
psql "$SHORTPULSE_PRODUCTION_DB_URL" -X -v ON_ERROR_STOP=1 \
  -f sql/check_database_egress_query_stats.sql

psql "$SHORTPULSE_PRODUCTION_DB_URL" -X -v ON_ERROR_STOP=1 \
  -f sql/check_postgrest_payload_projection_risk.sql
```

2. Refresh Supabase dashboard after data refresh delay.

3. Compare:

- `generation_projection` call rate
- `ai_generations` call rate
- heavy payload query classes
- latest full-day PostgREST egress
- current partial-day PostgREST slope

## Decision Rules

Proceed with code changes only if:

- The hot path is repo-owned.
- The fix is canonical, not a workaround.
- The fix does not change product behavior except reducing unnecessary payload reads.
- The fix has focused tests or a clear validation path.
- The expected impact is reduction in frequent PostgREST payload size or duplicate cadence.

Stop and ask the user if:

- The fix would alter visible AI Studio UX.
- The fix could break workspace/project restore.
- The fix could change billing/credit semantics.
- The fix requires deleting or mutating production data.
- The fix crosses into another agent's owned dirty files.
- The evidence points away from PostgREST and back toward Storage.
- The next step is deployment, commit, push, or remote config mutation without explicit user approval.

## Suggested Next Agent Prompt

Copy/paste this into the next agent:

```text
You are picking up Nuclo's Supabase egress PostgREST optimization handoff.

Read:
- AGENTS.md
- docs/dev-ground-rules.md
- docs/conventions.md
- docs/agent-playbook.md
- docs/agents/nuclo/README.md
- docs/agents/nuclo/memory.md
- docs/agents/nuclo/workspace/handoffs/2026-07-01-supabase-egress-postgrest-optimization-handoff.md

Task:
Audit the current production Supabase egress evidence and implement the highest-ROI canonical source fix only if the repo trace proves it. Current evidence says the active current-cycle egress is improved but still PostgREST-led. Do not chase Supabase image transformations, Edge Functions, Realtime, Log Drains, or scheduler cadence unless refreshed evidence changes the diagnosis.

Before editing:
- Confirm local branch is production and allowedBranch is production.
- Check git status and stop if target files have unrelated dirty owner changes.
- Rerun the production-safe SQL diagnostics if credentials are available:
  - sql/check_database_egress_query_stats.sql
  - sql/check_postgrest_payload_projection_risk.sql
- Refresh the Supabase Usage dashboard if authenticated access is available.

Implementation direction:
Trace frequent generation_projection and ai_generations PostgREST reads. Prefer splitting frequent lightweight display/status/delivery hydration from heavy restore/reload/style metadata hydration. Preserve AI Studio restore, workflow reload, generation progress, project/workspace state, billing/credits, RLS/privacy, and current UI/UX.

Stop if the correct fix would materially alter UI/UX, production data, security/privacy, billing/credits, deployment/branch state, or another owner lane.

Close out with:
- evidence used,
- source path fixed or blocker,
- tests run,
- residual risk,
- exact post-deploy diagnostic to run next.
```

## Bottom Line

Do not treat the current egress issue as solved. It is improved, but the current production dashboard still shows PostgREST as the primary driver. The next agent should make a narrow, source-backed payload/cadence optimization in the AI Studio generation/projection hydration path, then prove the effect with the same SQL diagnostics and Supabase Usage dashboard service split after deployment.
