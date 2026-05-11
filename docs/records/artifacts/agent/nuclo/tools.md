# Nuclo Tooling Inventory

Purpose: record helper commands, scripts, checks, and future tooling needs for Nuclo.

## Current Helper Paths

- Startup contract: `skills/skill-session-startup-contract/SKILL.md`
- Deployment env contract audit: `node scripts/check_vercel_env_contract.mjs`
- Staged env-file audit: `node scripts/check_vercel_env_file.mjs --file <path> --environment <env>`
- Nuclo Vercel wrapper: `bash scripts/ops/vercel_env_audit.sh`
- GitHub Environment audit: `bash scripts/ops/github_env_audit.sh`
- Supabase schema parity: `bash scripts/ops/supabase_public_schema_parity.sh --source-label staging --target-label production`
- Supabase row-count drift: `bash scripts/ops/supabase_rowcount_diff.sh --source-label staging --target-label production`
- Supabase storage metadata parity: `bash scripts/ops/supabase_storage_parity.sh --bucket media_library --source-label staging --target-label production`
- Supabase storage bulk copy: `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode copy`
- Supabase storage bulk verify: `bash scripts/ops/supabase_storage_rclone_sync.sh --bucket media_library --mode check`
- Supabase hot-table delta sync: `bash scripts/ops/supabase_hot_table_delta_sync.sh`
- Supabase media-generation delta sync: `bash scripts/ops/supabase_media_generation_delta_sync.sh`
- Deployment route parity: `node scripts/verify_deployment_route_parity.mjs --base-url <url>` (optional `--token <token>` override; otherwise uses authenticated `vercel` CLI state)
- Secret rotation validation: `bash scripts/ops/secret_rotation_validate.sh --preview-url <staging-preview-url>`
- GitHub governance audit is now ruleset-aware and reports effective required checks per branch.
- Docs check: `npm -C frontend run docs:check`
- Supabase project inventory: `./frontend/node_modules/.bin/supabase projects list`
- Branch enforcement: `scripts/git-enforce-current-branch.sh`
- Environment ledger template: `docs/agents/nuclo/environment-ledger-template.md`
- Supabase ops scripts now auto-detect Homebrew `libpq` at `/opt/homebrew/opt/libpq/bin/psql` when `psql` is not on the non-interactive shell PATH.

## Tooling Needs

- A one-shot freeze-window wrapper that bundles final delta sync, storage parity, row-count parity, and a go/no-go summary.
- Stable required status-check mapping for `staging-preview` once that branch emits a durable CI surface.
