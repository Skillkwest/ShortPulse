# Nuclo Current Handoff

Status: active
Owner: Nuclo
Created: 2026-06-14
Source lane: async generation convergence proof / Supabase DB URL hosted diagnostics
Target environment: production only

## Objective

Resolve the production GitHub Environment `SUPABASE_DB_URL` blocker so the hosted reliability control-plane diagnostics workflow can run real SQL against the production Supabase database, then produce a decision-grade closeout for the async generation convergence proof boundary.

The current product question is whether completed async generations converge correctly into durable account/project media surfaces after the user leaves AI Studio and returns later. Gear Ball/Codex already hardened the application and diagnostics runner path. The remaining blocker belongs to Nuclo because the hosted proof path depends on production GitHub Environment secret wiring for the Supabase database URL.

Do not treat staging as production evidence for this handoff.

## Required Startup

Before action, load:

- `AGENTS.md`
- `docs/agents/nuclo/README.md`
- `docs/agents/nuclo/memory.md`
- `docs/agents/solo-owner-launch-trust-standard.md`
- `docs/deployment.md`
- `docs/sops/sop_generation_recovery_diagnostics.md`
- `docs/sops/sop_sql_migration_operations.md`
- `.github/workflows/reliability-control-plane-diagnostics.yml`
- `scripts/reliability_control_plane_diagnostics.sh`

Confirm:

- local branch is `production`
- `git config --local shortpulse.allowedBranch` is `production`
- GitHub workflow/ref target is `production`
- target app URL is `https://www.shortpulse.ai`
- target Supabase project is production, not staging or working-development
- no raw secret values are printed, copied into docs, or pasted into reports

## Current State

### Application/runtime posture already proven

Production smoke checks already completed in this lane:

- `https://www.shortpulse.ai/` returned `200`.
- Unauthenticated `POST https://www.shortpulse.ai/api/internal/generation-recovery/run` returned `401 {"error":"Unauthorized"}`.

Meaning:

- the public production app is responding
- the protected generation recovery route exists in production
- the route is guarded
- this does not prove an authenticated recovery cycle ran, because the current shell did not have the cron secret

### Relevant production commits already on `production`

The following work is already on GitHub `production`:

1. `c3e369d51 Harden generated output project convergence`
   - added paged terminal projection repair so stale terminal candidates are not starved behind healthy recent terminal projections
   - added project/media association failure visibility
   - added projection repair metrics to the control-plane cycle response
   - added/fixed convergence-defect SQL coverage
   - added `sql/check_generation_convergence_defect_classes.sql` to `scripts/reliability_control_plane_diagnostics.sh`

2. `8d13f1738 Clarify hosted Supabase diagnostics connectivity`
   - made the diagnostics runner fail fast when GitHub Actions is pointed at a Supabase `db.*.supabase.co` URL that resolves IPv6-only
   - updated `.github/workflows/reliability-control-plane-diagnostics.yml`
   - updated `docs/deployment.md`
   - updated `docs/sops/sop_generation_recovery_diagnostics.md`
   - updated `docs/sops/sop_sql_migration_operations.md`

### Hosted diagnostics run history

Run `27499672228`

- Ref: `production`
- Head SHA: `3331c4837d8001c6b7cba6178c34b3753bb73975`
- Result: warn-mode wrapper completed, but diagnostics did not produce useful SQL logs.
- Cause: older runner could exit before logging because `getent ahostsv4` returned no row under `set -euo pipefail`.

Run `27515522399`

- Ref: `production`
- Head SHA: `23a507a88ddd69e4b6f574db3f2421fb364ae5ed`
- Result: artifact contained real runner output but failed before SQL execution.
- Failure:
  - `psql: error: connection to server at "db.ftgrqgjrchpimronuhop.supabase.co" (...IPv6...), port 6543 failed: Network is unreachable`
- Interpretation:
  - runner code reached the SQL phase
  - GitHub Actions could not reach the production Supabase DB URL because it resolved IPv6-only

Run `27515598372`

- Ref: `production`
- Head SHA: `8d13f1738571be9b7065b4bb05a70d83b80f06b8`
- Result: artifact confirmed the new fast-fail blocker message.
- Artifact message:
  - `IPv4 hostaddr lookup unavailable; using normal hostname resolution.`
  - `GitHub Actions cannot reach Supabase db.* hosts when they resolve to IPv6 only.`
  - `Set the GitHub Environment SUPABASE_DB_URL to the Supavisor session pooler URL`
  - `(IPv4-compatible, port 5432), or enable the Supabase IPv4 add-on for this project.`

## Root Cause

GitHub Environment `production` currently has a `SUPABASE_DB_URL` value that resolves to a Supabase `db.<project-ref>.supabase.co` host on port `6543`.

Supabase direct/dedicated database hosts are IPv6 by default unless the project has the IPv4 add-on. GitHub Actions cannot reach IPv6-only database hosts from the hosted runner. Therefore the reliability diagnostics workflow cannot execute any production SQL until the GitHub Environment `production` `SUPABASE_DB_URL` is updated to an IPv4-compatible connection target.

Canonical fix options:

1. Preferred: set GitHub Environment `production` secret `SUPABASE_DB_URL` to the production Supavisor session pooler connection string, using port `5432`.
2. Acceptable but likely lower ROI: enable the Supabase IPv4 add-on for the production project and keep using the current `db.*` host.

Do not add another runner fallback, alternate SQL authority, or staging substitute. Fix the canonical environment secret or explicitly document why the IPv4 add-on was chosen.

## Approved Scope For Nuclo

In scope:

- inspect GitHub Environment `production` secret names and update timestamps without printing values
- inspect Supabase production project connection options through safe CLI/provider surfaces
- determine the correct production Supavisor session pooler URL format
- coordinate with the user if the database password or pooler URL cannot be recovered safely
- update GitHub Environment `production` `SUPABASE_DB_URL` when Nuclo has explicit current-thread approval and the correct production pooler URL/password
- rerun `.github/workflows/reliability-control-plane-diagnostics.yml` on `production` in `warn` mode
- download and inspect diagnostics artifacts
- confirm the SQL bundle actually executed, including `sql/check_generation_convergence_defect_classes.sql`
- produce the closeout artifact under `docs/records/artifacts/agent/nuclo/reports/`
- archive this handoff under `docs/agents/nuclo/previous-handoffs/` after completion
- update `docs/agents/nuclo/memory.md` only for concise durable lessons

Out of scope unless the user separately approves the exact action:

- printing, pasting, committing, or documenting raw database URLs, passwords, service-role keys, bearer tokens, or Stripe keys
- using staging as proof for production
- deleting Supabase auth users or user-owned rows/files
- running Docker-based Supabase workflows
- changing Vercel production runtime env values
- changing Stripe state
- running billing/provider/generation mutations
- changing unrelated workflows that merely happen to use `SUPABASE_DB_URL`

## Primary Task Sequence

### 1. Prove The Current Secret Posture Without Exposing Values

Run:

```bash
gh secret list --env production --repo sleepyseamonster/ShortPulse
```

Capture only:

- whether `SUPABASE_DB_URL` exists
- its update timestamp if displayed
- whether any separate pooler/IPv4 DB URL secret already exists

Do not print the secret value. GitHub does not allow reading secret values anyway; do not try to bypass that.

### 2. Identify The Correct Production Pooler URL Source

Preferred source order:

1. Supabase Dashboard/database connection panel for the production project
2. Supabase CLI/provider metadata if it exposes the connection target safely
3. User-provided production Supavisor session pooler URL

Expected URL shape:

```text
postgres://postgres.<production-project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Important:

- project ref is `ftgrqgjrchpimronuhop` based on prior production proof
- exact pooler region/host must come from Supabase, not guessing
- password must come from the existing production DB credential source or the user
- never store the raw URL in repo files or reports

If Nuclo cannot obtain the pooler URL/password safely, stop and ask the user for the exact production Supavisor session pooler connection string or approval to retrieve/reset the DB password through the proper provider path.

### 3. Update GitHub Environment Secret Only When Authorized

If Nuclo has the correct production pooler URL and current-thread approval to mutate GitHub Environment secrets, update:

```bash
gh secret set SUPABASE_DB_URL \
  --env production \
  --repo sleepyseamonster/ShortPulse
```

Paste the value through stdin/interactive prompt only. Do not echo it in shell history, docs, chat, or logs.

If Nuclo uses a temporary file for secret input, place it outside the repo, delete it immediately after use, and do not treat it as source of truth.

After update:

```bash
gh secret list --env production --repo sleepyseamonster/ShortPulse
```

Capture only existence/update timestamp.

### 4. Rerun Production Reliability Diagnostics

Dispatch:

```bash
gh workflow run reliability-control-plane-diagnostics.yml \
  --repo sleepyseamonster/ShortPulse \
  --ref production \
  -f target_environment=production \
  -f mode=warn
```

Track:

```bash
gh run list \
  --repo sleepyseamonster/ShortPulse \
  --workflow reliability-control-plane-diagnostics.yml \
  --limit 5

gh run watch <run-id> \
  --repo sleepyseamonster/ShortPulse \
  --exit-status
```

Download artifact:

```bash
rm -rf /tmp/reliability-diagnostics-prod-<run-id>
mkdir -p /tmp/reliability-diagnostics-prod-<run-id>

gh run download <run-id> \
  --repo sleepyseamonster/ShortPulse \
  --dir /tmp/reliability-diagnostics-prod-<run-id>
```

Required artifact files:

- `reliability_control_plane_diagnostics.log`
- `reliability_control_plane_diagnostics/combined.log`
- per-SQL logs for every bundled SQL file

Required SQL files to confirm in logs:

- `sql/check_control_plane_scheduler_health.sql`
- `sql/check_pg_net_failure_taxonomy.sql`
- `sql/check_generation_queue_dispatch_latency.sql`
- `sql/check_generation_recovery_media_visible_latency.sql`
- `sql/check_generation_convergence_defect_classes.sql`
- `sql/check_runtime_sql_security_audit.sql`
- `sql/check_generation_settlement_integrity.sql`
- `sql/check_control_plane_enforce_gate.sql`

If the workflow wrapper reports success but the artifact does not show these SQL files actually ran, do not treat the workflow as proof.

### 5. Interpret Async Generation Convergence Evidence

From `check_generation_convergence_defect_classes.sql`, report the metric rows for:

- `success_with_outputs_total`
- `outputs_without_publications`
- `partial_publication_coverage`
- `published_without_projection`
- `terminal_success_outputs_missing_projection`
- `published_with_nonterminal_projection`
- `terminal_observation_with_nonterminal_projection`
- `project_metadata_missing_projection_project_scope`
- `project_projection_missing_generation_association`
- `project_owned_media_missing_project_media_association`
- `ignored_missing_generation_observations`
- `ignored_other_observations`
- `failed_observations`

Expected launch-safe direction:

- terminal/project/media convergence defect counts should be `0`, or every nonzero count must have a concrete, bounded explanation and repair owner
- detail rows should not show current completed generations with durable output media missing publication/projection/project/media association

If any defect class is nonzero:

- identify the defect class
- count affected rows
- include only non-sensitive identifiers needed for repair triage
- do not print user private prompts/media contents/secrets
- decide whether the defect belongs to:
  - environment/DB ownership (Nuclo)
  - runtime recovery/control-plane code (Gear Ball/Codex)
  - billing/provider/account posture (Money Stuff/user)

### 6. Confirm Runtime SQL Security And Scheduler Gates

From `check_runtime_sql_security_audit.sql`:

- report `failing_checks`
- expected: `0`

From `check_control_plane_enforce_gate.sql`:

- report failing check count if present
- expected: `0`

From scheduler/latency checks:

- report whether scheduler health SQL completed
- report any recovery/media visible latency outliers that would affect async user-return reliability

Do not overclaim if diagnostics run in `warn` mode. Treat `warn` as evidence collection; use the SQL values and logs for the actual conclusion.

## Closeout Nuclo Must Produce

Create a retained report:

```text
docs/records/artifacts/agent/nuclo/reports/2026-06-14-production-supabase-db-url-reliability-diagnostics-closeout.md
```

The report must include:

- status: pass, partial, or blocked
- production URL: `https://www.shortpulse.ai`
- production Supabase project ref: `ftgrqgjrchpimronuhop`
- GitHub branch/ref and commit SHA used
- GitHub diagnostics run ID and URL
- whether GitHub Environment `SUPABASE_DB_URL` was updated, without exposing the value
- source used for the pooler URL, without exposing the raw secret
- artifact files inspected
- SQL files confirmed executed
- convergence defect metrics
- runtime SQL security result, including `failing_checks`
- scheduler/enforce-gate result
- remaining unknowns and owners
- explicit statement whether this proves the async generation background-completion/convergence proof boundary

If complete, archive this handoff to:

```text
docs/agents/nuclo/previous-handoffs/2026-06-14-production-supabase-db-url-reliability-diagnostics.md
```

Then reset `docs/agents/nuclo/CURRENT-HANDOFF.md` to the no-active-handoff placeholder.

If blocked, leave this handoff active and update the report with the exact blocker and required user/provider action.

## Stop Conditions

Stop and close as pass when:

- GitHub Environment `production` `SUPABASE_DB_URL` is IPv4-compatible
- production reliability diagnostics run from GitHub Actions executes the full SQL bundle
- `check_generation_convergence_defect_classes.sql` results are captured and interpreted
- runtime SQL security audit reports no failing checks
- control-plane enforce gate reports no failing checks
- remaining async generation/media/project convergence unknowns are either zero or routed to the correct owner with exact evidence
- closeout report and archived handoff are created

Stop and close as blocked when:

- the correct production Supavisor session pooler URL/password is unavailable
- the user has not approved the required GitHub Environment secret mutation
- Supabase requires an IPv4 add-on decision that Nuclo cannot make without user approval
- the hosted workflow still cannot connect after the secret is corrected
- SQL runs but exposes nonzero convergence/security defects that require code/data changes outside Nuclo's lane

## Do Not Do These Things

- Do not use staging evidence for production.
- Do not print raw DB URLs, passwords, service-role keys, anon keys, bearer tokens, Stripe keys, or customer data.
- Do not inspect or expose customer-private media/prompt contents.
- Do not delete auth users, storage objects, project rows, generation rows, media rows, or billing rows.
- Do not run Docker-based Supabase commands.
- Do not treat a warn-mode GitHub wrapper success as proof unless the SQL logs executed.
- Do not create fallback diagnostics paths or duplicate SQL authorities.
- Do not change UI/UX/runtime behavior for this handoff.
