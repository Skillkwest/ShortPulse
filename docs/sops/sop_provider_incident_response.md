# SOP: Provider Incident Response (Fal, OpenAI, Stripe)

Purpose: operational runbook for diagnosing and mitigating provider failures that impact generation, billing, or webhook processing.

## Scope
- In scope:
  - Fal submit/status failures (`/api/fal/*`).
  - OpenAI prompt/agent failures (`/api/ai/*`).
  - Stripe webhook and billing flow failures (`/api/billing/stripe/*`).
- Out of scope:
  - Frontend-only visual regressions without provider/API failures.
  - General deployment rollback procedures (see `docs/disaster-recovery.md`).

## Prerequisites
- Admin access to `/admin` for incident triage.
- Supabase SQL access for read diagnostics.
- Access to deployment logs for API routes.
- Current env verification: `FAL_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.

## Triage workflow (first 15 minutes)
1. Confirm incident scope in `/admin`:
   - Filter `source`, `severity`, `route`, and `endpoint` in the Errors panel.
   - Capture one representative incident fingerprint and request ID.
2. Classify incident:
   - Fal generation outage.
   - OpenAI text/agent outage.
   - Stripe checkout/portal/webhook outage.
3. Check blast radius:
   - Single route/model vs all requests.
   - One user vs multi-user recurrence (`occurrences_count`, `last_seen_at`).
4. Apply immediate mitigation:
   - Hide or disable affected UI action where possible.
   - Keep unaffected generation/billing paths available.

## Provider-specific diagnostics

### Fal generation failures
Primary signals:
- `source = api.exception` with routes under `/api/fal/*`.
- User-visible generation errors or stuck pending tasks.

Checks:
```sql
select id, source, route, endpoint, message, http_status, last_seen_at, occurrences_count
from app_error_logs
where endpoint like '/api/fal/%'
order by last_seen_at desc
limit 50;
```

```sql
select user_id, model_id, status, count(*) as reservations, min(created_at) as oldest, max(created_at) as newest
from ai_credit_reservations
group by user_id, model_id, status
order by newest desc
limit 100;
```

Mitigation guidance:
1. Confirm submit path rejects are auto-refunded by checking reservation state transitions (`reserved` -> `released`).
2. Confirm completed runs capture (`reserved` -> `captured`) and create a ledger debit.
3. If one model endpoint is degraded, temporarily remove that model from UI selection until provider recovers.

### OpenAI prompt/agent failures
Primary signals:
- Errors from `/api/ai/generate-prompt`, `/api/ai/describe-image`, `/api/ai/studio-agent`.
- Large spike in failed prompt refine/describe interactions.

Checks:
```sql
select id, endpoint, message, http_status, metadata, last_seen_at, occurrences_count
from app_error_logs
where endpoint like '/api/ai/%'
order by last_seen_at desc
limit 50;
```

Mitigation guidance:
1. Verify `OPENAI_API_KEY` and model env vars are present and unchanged.
2. Fallback to manual prompt entry when agent endpoints degrade.
3. If only one endpoint fails (`describe-image` vs `studio-agent`), keep unaffected AI paths enabled.

### Stripe webhook or billing failures
Primary signals:
- Checkout/portal route failures.
- Missing credit grants after successful payments.
- Webhook failures or signature errors.

Checks:
```sql
select id, event_type, received_at
from stripe_event_log
order by received_at desc
limit 100;
```

```sql
select id, endpoint, message, http_status, metadata, last_seen_at, occurrences_count
from app_error_logs
where endpoint like '/api/billing/stripe/%'
order by last_seen_at desc
limit 50;
```

Mitigation guidance:
1. If webhook signature validation fails, verify `STRIPE_WEBHOOK_SECRET` matches the active endpoint in Stripe.
2. If duplicate grant concerns appear, confirm event IDs are recorded in `stripe_event_log` and skipped on replay.
3. If checkout/portal creation fails, verify `STRIPE_SECRET_KEY` and customer linkage in `billing_profiles`.

## Recovery validation checklist
1. Submit one generation and verify:
   - reservation created,
   - provider request id attached,
   - reservation captured or released correctly.
2. Run one prompt refine and one image describe call.
3. Trigger one billing action (checkout or portal).
4. Verify no new high-severity incidents are opening for the affected endpoints.

## Post-incident requirements
1. Record incident summary and fix in `docs/change_log.md`.
2. Add unresolved issues and temporary mitigations to `docs/known-issues.md`.
3. If the fix changes architecture or control boundaries, add/update an ADR in `docs/adr/`.
4. If any schema/migration action was required, update `docs/database-migrations.md` and `docs/data-dictionary.md`.
