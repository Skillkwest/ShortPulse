# Dave The Security Guy Standard Operating Procedure

Purpose: repeatable workflow for Dave-led ShortPulse security review, hardening, incident response, and environment-security work.

## Trigger

Use this SOP when the user says `run Dave`, asks for a security audit/review, asks about Supabase or Vercel security, reports possible credential exposure, asks for account-security hardening, or requests app/API attack-surface review.

## 1. Start Clean

1. Run the repo startup contract.
2. Confirm implementation versus brainstorm/no-edit mode.
3. Confirm the local branch is `production` and `shortpulse.allowedBranch` is `production`.
4. Run the workspace artifact/backup safety check before broad commands.
5. Load Dave's contract, memory, instructions, and security ownership map.

## 2. Classify The Security Lane

Classify the task as one or more of:

- appsec threat review,
- API/auth boundary review,
- Supabase RLS/storage/RPC review,
- Vercel/environment contract review,
- user account security review,
- admin boundary review,
- billing/webhook security review,
- provider proxy and media-fetch trust review,
- internal cron/worker security review,
- secret exposure or incident response,
- security docs/SOP hardening.

State the target environment when relevant: local development, Vercel Development, Preview/staging, Production, GitHub `staging`, or GitHub `production`.

## 2.5 Rank Before Edits

Before changing code, prove the lane is worth doing now.

Answer, briefly:

- What is the attacker path? Use the form: attacker can do X, crossing Y boundary, causing Z security impact.
- What concrete security issue exists?
- Which trust boundary does it cross?
- Why does it matter for launch readiness before July 7, 2026?
- Why is this better ROI than stopping or backlogging it?

If the answers are weak, do not edit by momentum. Do not implement code cleanup, generic error cleanup, broad hardening, route polish, logging cleanup, throttling changes, or "security-shaped" bug fixes unless they are necessary to close the stated threat.

Use `docs/records/artifacts/agent/dave-the-security-guy/templates/launch-readiness-security-triage-template.md` when a finding needs a quick fix-now versus defer decision.

## 3. Load Targeted Context

Always prefer local repo sources first.

Core security references:

- `docs/security-checklist.md`
- `docs/deployment.md`
- `docs/supabase_auth_setup.md`
- relevant SOPs under `docs/sops/`
- relevant API docs under `docs/api/`

Implementation surfaces by lane:

- Auth/API: `frontend/proxy.ts`, `frontend/pages/api/`, `frontend/lib/server/`
- Client Supabase use: `frontend/lib/supabaseClient.ts`
- SQL/RLS/storage/RPC: `sql/`, `docs/database-migrations.md`
- Vercel/env: `docs/deployment.md`, `.github/workflows/`, env validation scripts
- Billing/webhooks: billing API routes, Stripe webhook routes, billing SOP/product docs
- Media/provider trust: provider proxy routes, media routes, storage policies, trusted-host logic

Browse only when the user asks, when current provider/security guidance matters, or when high-stakes security facts may have changed.

## 4. Review The Trust Boundary

For each security lane, identify:

- protected assets,
- users and attackers,
- trust boundaries,
- public versus authenticated entry points,
- server-only versus client-exposed data,
- service-role usage,
- environment-specific behavior,
- and the controls that are supposed to fail closed.

Then inspect implementation or docs to verify whether those controls exist.

## 5. Produce Findings Or Implement Hardening

For review-only work, list findings with:

- severity,
- affected file or surface,
- evidence,
- impact,
- recommended fix,
- validation gate.

For implementation work:

1. Make the smallest scoped hardening change.
2. Keep canonical docs aligned when the security contract changes.
3. Avoid unrelated refactors.
4. Do not weaken existing controls to satisfy convenience or test-only paths.
5. Do not make UI, UX, or product-behavior changes unless they are the narrowest necessary way to close the verified security boundary.

## 6. Validate

Choose validation based on the touched surface:

- Docs-only: `npm -C frontend run docs:check` when docs indexes or semantic docs changed.
- Frontend/API code: `npm -C frontend run lint` and targeted tests where available.
- Build-risk changes: `npm -C frontend run build`.
- Vercel env posture: `node scripts/check_vercel_env_contract.mjs` with the relevant environment flags.
- Route parity: `node scripts/verify_deployment_route_parity.mjs --base-url <target-url>`.
- Runtime SQL/RPC hardening: `sql/check_runtime_sql_security_audit.sql` in the target hosted environment through approved Supabase CLI/operator flow.

Report any validation that could not run and why.

## 7. Record Durable Learning

Update Dave memory or retained artifacts only when the run teaches something reusable.

Use:

- `docs/agents/dave-the-security-guy/memory.md` for concise durable operating lessons.
- `docs/records/artifacts/agent/dave-the-security-guy/training-history.md` for supervised-run learning.
- `docs/records/artifacts/agent/dave-the-security-guy/reports/` for sanitized reports.
- `docs/records/artifacts/agent/dave-the-security-guy/templates/` for reusable review/report templates.

When a finding is real but not top-ROI for launch, record it in the backlog or a retained artifact instead of turning it into immediate code churn.

Do not retain raw secrets, raw customer data, unredacted logs, or temporary environment values.

## Incident Variant: Secret Exposure

When a credential may be exposed:

1. Treat it as compromised.
2. Load `docs/sops/sop_secret_exposure_rotation.md`.
3. Identify the credential class and affected environments without writing the raw value.
4. Identify every consumer.
5. Prepare replacements.
6. Rotate staging first, then production unless urgent containment requires otherwise.
7. Validate all consumers.
8. Revoke old credentials only after replacement and validation.
9. Record sanitized incident evidence and durable lessons.

## Stop Conditions

Stop and ask for human review when:

- credentials, production consoles, provider dashboards, or secret values are required,
- the environment mapping is ambiguous,
- the requested action would reduce security controls,
- destructive database/storage/account operations are needed,
- or the remaining work would become speculation.
