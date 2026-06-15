# 2026-06-14 Production Security And Billing Proof Closeout

Status: completed with explicit deferrals
Owner: Nuclo
Environment: production only
Production URL: `https://www.shortpulse.ai`
Production Supabase project: `ftgrqgjrchpimronuhop`
Git branch/ref checked locally: `production`
Evidence time: 2026-06-15T01:24Z-01:26Z UTC

## Claim

The production hosted SQL/security and signup-billing bootstrap proof boundary is decision-grade for the checked surfaces:

- production runtime SQL security audit passed with `failing_checks = 0`
- production signup billing bootstrap function and auth trigger exist
- production billing launch readiness passed all DB-related checks
- production Vercel env contract, route parity, auth callback origin, public pricing catalog, production Supabase billing catalog, and billing renewal fail-closed checks passed through the launch-readiness script

Remaining proof is explicitly deferred:

- Stripe webhook provider event posture is unproven locally because `STRIPE_SECRET_KEY` is not available to Nuclo in this shell.
- Two-account non-admin production isolation proof is deferred because only one production audit credential pair is locally available, and the handoff notes that available account is admin.
- GitHub reliability diagnostics workflow is not acceptable proof yet because the current runner bundle references a missing SQL file before it reaches the runtime SQL audit.

## Evidence

### Startup And Target Confirmation

Commands:

```bash
git branch --show-current
git config --local --get shortpulse.allowedBranch
supabase projects list
cat supabase/.temp/project-ref
```

Results:

- local branch: `production`
- local branch guard: `production`
- production Supabase project present: `ftgrqgjrchpimronuhop` (`ShortPulse - PRODUCTION - Live`)
- local Supabase CLI linked project remains development: `bgdhqbenqltxildlgkyu`
- production DB access used explicit `SHORTPULSE_PRODUCTION_DB_URL`; staging was not used as evidence

### Production Runtime SQL Security Audit

Command:

```bash
/opt/homebrew/opt/libpq/bin/psql "$SHORTPULSE_PRODUCTION_DB_URL" \
  -v ON_ERROR_STOP=1 \
  -f sql/check_runtime_sql_security_audit.sql
```

Result:

```text
total_checks | passing_checks | failing_checks
353          | 353            | 0
```

Interpretation:

- The hosted production runtime SQL security audit passed for the checked RPC, role/grant, table/sequence canary, and policy posture.
- This is direct production DB evidence, not staging or local-only inspection.

### Production Billing Launch Readiness

Command:

```bash
PATH="/opt/homebrew/opt/libpq/bin:$PATH" \
SUPABASE_DB_URL="$SHORTPULSE_PRODUCTION_DB_URL" \
node scripts/check_billing_launch_readiness.mjs --base-url https://www.shortpulse.ai
```

Result:

```text
summary pass=8 warn=1 fail=0 loaded_env_files=3
```

Passed:

- production URL target
- production Vercel env contract
- billing-critical route parity
- signup callback URL resolves to production and preserves selected-plan intent
- public pricing catalog exposes monthly and annual paid offers with Stripe price IDs
- production Supabase billing catalog and runtime billing tables are queryable with required Stripe linkage
- production auth signup billing bootstrap function and trigger are present
- billing renewal worker is deployed, enabled, and fail-closed against unauthenticated execution

Warning:

- `stripe_webhook_endpoint` is unproven because `STRIPE_SECRET_KEY` is unavailable locally.

### Signup Billing Bootstrap Direct DB Probe

Command:

```sql
select 'function' as object_type,
       n.nspname || '.' || p.proname as object_name,
       true as present
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'handle_new_user_billing_setup'
union all
select 'trigger' as object_type,
       event_object_schema || '.' || event_object_table || '.' || trigger_name as object_name,
       true as present
from information_schema.triggers
where event_object_schema = 'auth'
  and event_object_table = 'users'
  and trigger_name = 'on_auth_user_created_billing_setup';
```

Result:

```text
function | public.handle_new_user_billing_setup          | t
trigger  | auth.users.on_auth_user_created_billing_setup | t
```

### Reliability Diagnostics Workflow Disposition

Local direct runner command:

```bash
RELIABILITY_DIAGNOSTICS_MODE=warn \
SUPABASE_DB_URL="$SHORTPULSE_PRODUCTION_DB_URL" \
scripts/reliability_control_plane_diagnostics.sh
```

Observed result:

- scheduler health query ran and showed the three expected jobs active and healthy
- pg_net taxonomy query ran and showed `pending_http_request_count = 0`
- runner then stopped at missing file:
  - `sql/check_generation_queue_dispatch_latency.sql`

Repo-source finding:

- `scripts/reliability_control_plane_diagnostics.sh` references `sql/check_generation_queue_dispatch_latency.sql`
- that SQL file is absent on the checked production branch
- therefore the GitHub workflow should not be treated as SQL security proof until the runner bundle is repaired and rerun

Disposition:

- direct `psql` proof is sufficient for the runtime SQL security gate in this handoff
- reliability workflow repair should be handled as a follow-up repo fix or Gear Ball handoff before using the workflow as release evidence

## Unknowns And Deferrals

- Stripe webhook provider event posture remains unproven from Nuclo because local `STRIPE_SECRET_KEY` is unavailable. Hand this to Money Stuff or the user with Stripe provider access.
- Two-account non-admin production isolation remains unproven in this Nuclo pass. Nuclo did not create/delete production auth users and did not inspect customer-private data. Provide two safe non-admin production test accounts before running that matrix.
- The available production audit credential pair was not used to assert non-admin admin denial because the handoff says that account is admin.
- The GitHub reliability diagnostics workflow remains unproven as a complete SQL bundle because current repo source references a missing SQL script.

## Decision Impact

The production hosted SQL/security/billing DB proof boundary is no longer blocked by missing local DB access. The remaining launch-risk proof should be handled as narrower follow-ups:

- Stripe webhook provider event posture: Money Stuff or user/provider-console proof.
- Two-account non-admin production isolation: Nuclo only after safe test accounts are provided or explicitly approved.
- Reliability diagnostics workflow: Gear Ball/repo fix, then rerun GitHub workflow.

## Change Trigger

Re-run this proof if any of these change:

- production Supabase project/database target
- billing migrations or signup bootstrap trigger/function
- runtime SQL security audit script
- GitHub reliability diagnostics runner bundle
- Vercel production env contract
- Stripe webhook endpoint configuration
- production auth/admin test-account posture

