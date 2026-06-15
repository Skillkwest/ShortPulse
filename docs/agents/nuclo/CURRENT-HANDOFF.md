# Nuclo Current Handoff

Status: active
Owner: Nuclo
Created: 2026-06-14
Source lane: Dave/security + billing proof boundary
Target environment: production only

## Objective

Complete the hosted production proof boundary for the current launch-security and billing-readiness audit.

The user wants decision-grade proof that ShortPulse production prevents cross-user access and cross-account billing/media/credit use. Dave has already completed the repo/source/local-test portion and a production API-boundary smoke pass. The remaining work belongs to Nuclo because it requires production Supabase DB URL access, hosted SQL execution, GitHub Environment/Vercel/Supabase source-of-truth checks, and possibly production-safe environment repair.

Do not treat staging as a substitute for production for this handoff.

## Scope

In scope:

- Run the production hosted SQL security audit and prove `failing_checks = 0`.
- Prove production signup billing bootstrap DB objects exist.
- Re-run billing launch readiness with production DB URL available.
- Verify the production Stripe webhook endpoint event posture if Nuclo has the live Stripe secret or can inspect provider state safely.
- Decide whether the GitHub reliability diagnostics workflow needs an environment/runner fix, a repo fix, or a Gear Ball handoff.
- If safe test accounts already exist, complete non-destructive two-account production isolation probes.

Out of scope unless the user separately approves the exact action:

- Deleting Supabase auth users or user-owned rows/files.
- Creating/deleting short-lived production users.
- Charging cards, creating Stripe checkout sessions for real purchases, mutating customer subscriptions, or adding/removing real storage add-ons.
- Pushing/committing/deploying; hand to Gear Ball if GitHub production branch execution is needed.
- Using staging as evidence for production.

## Required Startup

Before action, load:

- `AGENTS.md`
- `docs/agents/nuclo/README.md`
- `docs/agents/nuclo/memory.md`
- `docs/agents/solo-owner-launch-trust-standard.md`
- `docs/security-checklist.md`
- `docs/sops/sop_sql_migration_operations.md`
- `docs/sops/sop_nuclo_supabase_migration_apply_and_validation.md`
- `docs/sops/sop_nuclo_destructive_data_guard.md`
- `docs/sops/sop_nuclo_production_smoke_test.md`

Confirm:

- local branch is `production`
- `git config --local shortpulse.allowedBranch` is `production`
- target Supabase project is production, not working-development or staging
- target app URL is `https://www.shortpulse.ai`
- no raw secret values are printed, copied into docs, or pasted into reports

## Evidence Already Collected

Dave completed these production-safe checks on 2026-06-14:

1. Billing launch readiness:

```bash
node scripts/check_billing_launch_readiness.mjs --base-url https://www.shortpulse.ai
```

Result:

- `pass=7 warn=2 fail=0 loaded_env_files=3`
- Passed production URL, Vercel env contract, billing route parity, signup callback URL, public pricing catalog, production Supabase billing catalog, and internal billing renewal fail-closed.
- Warnings:
  - `signup_billing_trigger` unproven because no local production DB URL was available.
  - `stripe_webhook_endpoint` unproven because no local `STRIPE_SECRET_KEY` was available.

2. Production unauthenticated fail-closed probe:

- Credits snapshot, media list, media sign-batch, Stripe checkout, Stripe portal, subscription change, storage add-on change, admin access, and internal billing renewal all returned `401`.
- Summary: `pass=9 fail=0`

3. Production authenticated boundary probe:

- First attempt minted a token against the wrong Supabase host and correctly got `401` from production.
- Correct production host was verified from Vercel production env as `ftgrqgjrchpimronuhop.supabase.co`.
- With a token minted against production Supabase:
  - credits snapshot returned `200`
  - credit packages returned `200`
  - media list returned `200`
  - in-scope nonexistent media sign returned `200` with null URL
  - out-of-scope media sign returned `403`
  - unknown/unowned Fal provider request status returned `403`
  - ElevenLabs voices returned `200`
  - admin access returned `200` because the available audit account is admin
- Summary: `pass=8 fail=0`
- Caveat: this did not prove non-admin admin denial because the available audit account is admin.

4. GitHub production reliability diagnostics workflow:

Triggered:

```bash
gh workflow run "Reliability Control-Plane Diagnostics" \
  --repo sleepyseamonster/ShortPulse \
  --ref production \
  -f target_environment=production \
  -f mode=warn
```

Run:

- `27499752066`

Result:

- GitHub job completed successfully as a warn-mode wrapper.
- Annotation: `reliability_control_plane_diagnostics failed in warn mode.`
- SQL diagnostics did not reach `sql/check_runtime_sql_security_audit.sql`.
- Artifact uploaded only an empty `reliability_control_plane_diagnostics.log`.

Likely cause:

- The committed production-branch version of `scripts/reliability_control_plane_diagnostics.sh` can exit silently during IPv4 host lookup when `getent ahostsv4` returns no row under `set -euo pipefail`.
- The local worktree already contains an uncommitted change to add `|| true` to that lookup and print a fallback message, plus an added generation convergence diagnostic. Do not assume the GitHub workflow proves SQL health until this runner issue is resolved or the SQL is run directly with `psql`.

## Primary Nuclo Tasks

### 1. Run Production Runtime SQL Security Audit

Preferred direct proof when Nuclo has the production DB URL:

```bash
psql "$SHORTPULSE_PRODUCTION_DB_URL" -v ON_ERROR_STOP=1 -f sql/check_runtime_sql_security_audit.sql
```

or, if Nuclo uses the generic variable:

```bash
SUPABASE_DB_URL="$SHORTPULSE_PRODUCTION_DB_URL" \
  scripts/reliability_control_plane_diagnostics.sh
```

Expected:

- detail rows all pass
- summary reports `failing_checks = 0`

If any check fails:

- report the exact check name, object name, role/grant/policy/function involved, and severity
- do not paste raw connection strings or secrets
- do not apply a repair until the root cause is mapped and the user approves production mutation if needed

If local `psql` is unavailable:

- Nuclo memory says Homebrew `libpq` is approved for hosted proof work.
- Known expected client path: `/opt/homebrew/opt/libpq/bin/psql`
- Installing/restoring the local client is acceptable for Nuclo proof work, but do not use Docker-based Supabase workflows.

### 2. Prove Signup Billing Bootstrap DB Objects

With `SHORTPULSE_PRODUCTION_DB_URL` available, re-run:

```bash
node scripts/check_billing_launch_readiness.mjs --base-url https://www.shortpulse.ai
```

Expected improvement:

- `signup_billing_trigger` should pass.

The script checks:

- function `public.handle_new_user_billing_setup`
- trigger `auth.users.on_auth_user_created_billing_setup`

If this still warns or fails, run the targeted SQL from `scripts/check_billing_launch_readiness.mjs` manually and report which object is missing. Do not repair until the target production DB and migration source are confirmed.

### 3. Decide The Reliability Workflow Repair Path

The GitHub workflow is useful only if it can run the SQL scripts. Current run `27499752066` did not.

Nuclo should decide one of:

1. Direct proof is enough for this launch gate:
   - run the SQL locally with production DB URL and record results.
2. Workflow proof is required:
   - coordinate with Gear Ball for commit/push of the runner fix on `production`.
   - after the fix is on GitHub `production`, rerun workflow in `warn` or `enforce` mode.
3. GitHub Environment secret posture is wrong:
   - inspect GitHub Environment `production` secret mapping for `SUPABASE_DB_URL`.
   - logs show the env was masked as present, so this is less likely than runner-host lookup failure.

Do not claim the workflow proved SQL posture until logs show the SQL files actually ran.

### 4. Verify Stripe Webhook Endpoint Event Posture

If Nuclo has safe access to the live Stripe secret or Stripe provider console:

```bash
node scripts/check_billing_launch_readiness.mjs --base-url https://www.shortpulse.ai
```

Expected improvement:

- `stripe_webhook_endpoint` should pass.

Required endpoint:

- `https://www.shortpulse.ai/api/billing/stripe/webhook`

Required events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`

If Nuclo does not own Stripe provider access, hand that sub-proof to Money Stuff or the user instead of guessing from repo code.

### 5. Complete Two-Account Production Isolation Proof Only If Safe Accounts Exist

Dave did not create/delete production users because Nuclo's destructive-data guard and Dave's safety rules require explicit approval for auth-user lifecycle mutations.

If Nuclo already has two safe non-admin production test accounts, run a non-destructive two-account matrix:

- User A token can read User A protected basics:
  - `GET /api/credits/snapshot` -> `200`
  - `GET /api/billing/credit-packages` -> `200`
  - `POST /api/media/list` with a valid body -> `200`
- User A token cannot sign a path under User B's UUID:
  - `POST /api/media/sign-batch` -> `403`
- User B token cannot sign a path under User A's UUID:
  - `POST /api/media/sign-batch` -> `403`
- Non-admin user token cannot access admin:
  - `GET /api/admin/access` -> `403`
- Unknown/unowned provider request IDs fail closed:
  - `POST /api/fal/seedream-status` with fake `requestId` -> `403`

Only test real cross-user project/media/provider IDs if they belong to dedicated test accounts or the user explicitly approves that access pattern. Do not inspect or print customer-private rows.

Avoid:

- checkout session creation
- Stripe portal session creation
- subscription change
- storage add-on mutation
- generation submit
- credit-consuming provider calls

Those require separate explicit approval because they create billing/provider/customer state.

## Decision-Grade Closeout Required From Nuclo

Close with:

- Claim:
  - whether the production hosted SQL/security/billing proof boundary is pass, partial, or blocked
- Environment:
  - production URL
  - production Supabase project ref
  - GitHub branch/ref used
  - whether evidence came from direct DB, GitHub workflow, Vercel, Stripe, production API, or local source
- Evidence:
  - exact command(s)
  - run IDs if GitHub was used
  - summary counts
  - `failing_checks` value from runtime SQL audit
  - billing readiness pass/warn/fail counts
- Unknowns:
  - any skipped Stripe or two-user proof
  - any account-class caveats such as admin-only audit account
- Stop condition:
  - stop when production SQL audit reports `failing_checks = 0`, signup trigger proof passes, billing readiness has no DB-related warnings, and remaining two-user/Stripe/purchase proof is either passed or explicitly deferred to the right owner with approval requirements.

## Do Not Do These Things

- Do not use staging as production evidence.
- Do not print `SUPABASE_DB_URL`, service-role keys, anon keys, bearer tokens, Stripe keys, or customer data.
- Do not delete auth users or user-owned rows/files.
- Do not run Docker-based Supabase commands.
- Do not commit, push, deploy, or mutate GitHub/Vercel/Supabase/Stripe state without explicit current-thread approval.
- Do not convert temporary env files into source of truth.

## Suggested First Command Sequence

```bash
git branch --show-current
git config --local --get shortpulse.allowedBranch

# Confirm psql exists; if not, restore Homebrew libpq per Nuclo memory.
which psql || test -x /opt/homebrew/opt/libpq/bin/psql

# Direct SQL gate.
psql "$SHORTPULSE_PRODUCTION_DB_URL" -v ON_ERROR_STOP=1 -f sql/check_runtime_sql_security_audit.sql

# Billing/signup proof with DB URL available.
node scripts/check_billing_launch_readiness.mjs --base-url https://www.shortpulse.ai
```

If `psql` is only available at the Homebrew libpq path:

```bash
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
```

If using the GitHub workflow after runner fix:

```bash
gh workflow run "Reliability Control-Plane Diagnostics" \
  --repo sleepyseamonster/ShortPulse \
  --ref production \
  -f target_environment=production \
  -f mode=warn

gh run watch <run-id> --repo sleepyseamonster/ShortPulse --exit-status
gh run view <run-id> --repo sleepyseamonster/ShortPulse --log
```
