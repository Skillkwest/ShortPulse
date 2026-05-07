# Seedream Shadow Operator Handoff Checklist

Date: 2026-05-06  
Owner: AI Studio Engineering  
Program: 1 (Runtime And Money)  
Status: ready for operator handoff

## Purpose
Provide one short execution checklist for the live Seedream Runtime V2 staging shadow run.

Use this after reading:
- `docs/planning/evidence/runtime-v2/2026-05-06-seedream-shadow-parity-report.md`
- `docs/planning/evidence/runtime-v2/2026-05-06-seedream-shadow-staging-preflight-env-check.md`

## Plan Status
The plan is not done.

This checklist exists because:
- the Seedream shadow parity report is published
- the repo-backed runtime/doc/test readiness work is done
- the next missing proof is live staging shadow execution

## Branch Constraint
- Do not execute this checklist while the work is intentionally limited to the current branch only.
- Use this checklist after the branch is pushed, merged, and promoted into the environment where staging execution is intended.

## Preconditions
1. Confirm the missing Preview / `staging-preview` env names are present:
   - `SHORTPULSE_FAL_INTEGRATION_MODE=shadow`
   - `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST=fal-ai/bytedance/seedream/*`
   - `SHORTPULSE_FAL_WEBHOOK_ENABLED=true`
   - `SHORTPULSE_FAL_WEBHOOK_JWKS_URL=https://rest.alpha.fal.ai/.well-known/jwks.json`
   - `SHORTPULSE_PUBLIC_API_BASE_URL=<staging-origin>`
   - `SHORTPULSE_FAL_RECONCILER_ENABLED=true`
   - `SHORTPULSE_FAL_RECONCILER_CRON_SECRET=<secret>`
   - `SHORTPULSE_FAL_RECONCILER_BATCH_SIZE=25`
   - `SHORTPULSE_FAL_RECONCILER_MAX_ATTEMPTS=5`
   - `SHORTPULSE_FAL_RECONCILER_MIN_AGE_SECONDS=120`
   - `SHORTPULSE_FAL_RECONCILER_LEASE_SECONDS=120`
2. Keep the model allowlist Seedream-only for this window.
3. Do not begin the 72-hour canary yet.

## Local Sanity Gate
Run before touching staging:

```bash
cd frontend
npm run test:phase11:fal-regression
npm run docs:check
```

Expected:
- Fal regression suite passes
- docs gate passes

## Staging Smoke 1: Webhook-First Seedream Run
1. Submit one Seedream generation in staging UI.
2. In staging SQL editor, capture the latest generation row:

```sql
select
  id,
  request_id,
  model_id,
  status,
  recovery_state,
  failure_reason_code,
  metadata ->> 'submit_webhook_registered' as submit_webhook_registered,
  created_at,
  updated_at
from ai_generations
where provider = 'fal'
order by created_at desc
limit 10;
```

3. Using that `request_id`, capture webhook ingress:

```sql
select
  event_id,
  request_id,
  verification_method,
  processing_status,
  received_at,
  processed_at
from fal_webhook_events
where request_id = '<REQUEST_ID>'
order by received_at desc
limit 20;
```

4. Capture persisted media linkage:

```sql
select
  m.id,
  m.source_ref,
  m.source,
  m.metadata ->> 'generation_output_index' as generation_output_index,
  m.created_at
from media_files m
join ai_generations g
  on g.id::text = m.source_ref
where g.request_id = '<REQUEST_ID>'
order by m.created_at desc;
```

Pass expectation:
- webhook row exists
- verification path is Fal JWKS/Ed25519
- media persists once per generation output index

## Staging Smoke 2: Reconciler Route
Run:

```bash
export STAGING_BASE_URL="https://<your-staging-domain>"
export CRON_SECRET="<SHORTPULSE_FAL_RECONCILER_CRON_SECRET>"

curl -sS -X POST "${STAGING_BASE_URL}/api/internal/generation-recovery/run" \
  -H "x-shortpulse-cron-secret: ${CRON_SECRET}" \
  -H "content-type: application/json" \
  -d '{}' | jq
```

Capture the response.

Expected fields:
- `claimed`
- `processed`
- `recovered`
- `requeued`
- `exhausted`
- `duplicates`
- `errors`
- `skipped`

Pass expectation:
- route authenticates successfully
- response shape is valid
- no unexpected hard failure

## Shadow Window SQL Capture
Run these during the shadow window and save the results in a follow-up evidence note:

```sql
select provider_request_id, count(*) as captured_count
from ai_credit_reservations
where status = 'captured'
  and provider_request_id is not null
group by provider_request_id
having count(*) > 1;
```

```sql
select
  source_ref,
  metadata ->> 'generation_output_index' as generation_output_index,
  count(*) as duplicate_count
from media_files
where source = 'ai_studio'
  and source_ref is not null
  and metadata ->> 'generation_output_index' is not null
group by source_ref, metadata ->> 'generation_output_index'
having count(*) > 1;
```

```sql
select count(*) as stuck_running_30m
from ai_generations
where provider = 'fal'
  and lower(status) = 'running'
  and created_at <= now() - interval '30 minutes';
```

```sql
select count(*) as unresolved_terminal_success_no_media_30m
from ai_generations
where provider = 'fal'
  and lower(coalesce(failure_reason_code, '')) = 'terminal_success_no_media'
  and lower(coalesce(recovery_state, 'none')) not in ('recovered', 'exhausted')
  and created_at <= now() - interval '30 minutes';
```

Pass expectation:
- duplicate settlement rows: `0`
- duplicate persistence rows: `0`
- stuck-running does not regress materially
- unresolved `terminal_success_no_media` backlog stays bounded

## Evidence To Produce
Create one dated follow-up packet in `docs/planning/evidence/runtime-v2/` containing:
1. env confirmation note
2. webhook-first smoke outputs
3. reconciler route response
4. shadow SQL outputs
5. pass/hold decision

## Decision Rule
1. If smokes and shadow SQL are clean, move to Seedream-only canary-on.
2. If duplicates appear, stop immediately and treat as a hard gate failure.
3. If backlog/latency drifts, hold the lane and attach raw outputs before changing runtime flags.

## Next Plan Step After This Checklist
If this checklist passes, the next plan item is still open:
- `AI Studio runtime V2 closeout: pass Seedream canary gates for 72h with no duplicate settlement or persistence regressions`
