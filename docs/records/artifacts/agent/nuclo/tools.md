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
- Deployment route parity: `node scripts/verify_deployment_route_parity.mjs --base-url <url> --token <token>`
- Docs check: `npm -C frontend run docs:check`
- Supabase project inventory: `./frontend/node_modules/.bin/supabase projects list`
- Branch enforcement: `scripts/git-enforce-current-branch.sh`
- Environment ledger template: `docs/agents/nuclo/environment-ledger-template.md`

## Tooling Needs

- Vercel credential availability in the shell or a standard operator token handoff path for live environment audits.
- S3 access keys for both Supabase projects so the new `rclone` wrapper can replace ad hoc REST relays for large object migration.
