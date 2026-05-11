# Nuclo Vercel Environment Repair

Purpose: give Nuclo a safe, repeatable workflow for Vercel environment rewiring, env-scope repair, and post-change validation.

## Scope

Use this SOP when the task involves:

- fixing branch/runtime/database mapping,
- repairing shared Vercel env rows that should be environment-specific,
- removing stale rollout flags from Vercel,
- or validating that development, preview, and production resolve to the intended values.

## Hard Safety Rules

- Never assume Vercel env rows are isolated just because the CLI command names one target.
- Treat these as environment-specific contract keys:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `APP_BASE_URL`
  - `SHORTPULSE_PUBLIC_API_BASE_URL`
- Do not use temporary text exports as the source of truth for env values.
- Validate with live `vercel env pull` or the audited wrapper after every mutation set.

## Prerequisites

1. Load startup docs and Nuclo memory.
2. Confirm authenticated `vercel` CLI access or an explicit token.
3. Confirm the intended mapping:
   - `Development` -> current development backend
   - `Preview` / `staging-preview` -> current staging backend
   - `Production` -> current production backend
4. Read:
   - `docs/deployment.md`
   - `docs/local-development.md`
   - `scripts/ops/README.md`

## Standard Workflow

### 1. Inventory First

Run:

```bash
vercel env ls --format json
bash scripts/ops/vercel_env_audit.sh --environment development --environment preview --environment production
```

Confirm:

- which keys exist
- which targets they apply to
- whether any key is shared across all three environments
- whether branch-scoped preview rows exist for `staging-preview`

### 2. Repair Canonical Keys First

Fix the highest-risk keys before any secondary cleanup:

1. Supabase runtime keys
2. base URL keys
3. other route-critical server/runtime keys

Do not start by deleting old rollout flags if the canonical routing keys are still wrong.

### 3. Handle Shared-Row Quirks Carefully

Vercel may store one row covering multiple targets. Removing one target can sometimes remove the whole row.

Safe pattern:

1. enumerate current rows
2. mutate one key family at a time
3. re-enumerate after each batch
4. re-pull live envs immediately

### 4. Remove Stale Contract-Noise Rows

Only after the runtime mapping is correct:

1. identify undeclared warning-only rows from the contract audit
2. confirm they are not used by current repo code or active docs contracts
3. remove them from Vercel rather than adding dead flags back into `.env.example`

## Validation Ladder

1. `bash scripts/ops/vercel_env_audit.sh --environment development --environment preview --environment production`
2. live `vercel env pull` spot checks for the changed scopes
3. route parity for affected hosted aliases:
   ```bash
   node scripts/verify_deployment_route_parity.mjs --base-url <url>
   ```
4. docs validation if docs or contract files changed

## When To Update Repo Docs

Update repo-visible docs when the contract changed, not for every routine env edit.

Typical durable surfaces:

- `docs/deployment.md`
- `docs/local-development.md`
- `docs/agents/nuclo/memory.md`
- `docs/change_log.md`

## Stop Conditions

Stop and reassess if:

- preview and production still resolve to the same critical values after one repair pass
- Vercel row behavior is ambiguous after two evidence-backed attempts
- the intended environment mapping is itself unclear
- the task expands into a production cutover rather than a local repair
