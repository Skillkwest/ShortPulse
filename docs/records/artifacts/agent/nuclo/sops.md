# Nuclo SOP Notes

Purpose: track Nuclo's current workflow references and emerging SOP needs during training.

## Active References

- `agent-teaching/README.md`
- `agent-teaching/operations/post-run-performance-analysis-interview.md`
- `docs/deployment.md`
- `docs/local-development.md`
- `docs/database-migrations.md`
- `docs/security-checklist.md`
- `docs/sops/sop_nuclo_supabase_storage_migration.md`
- `docs/agents/gear-ball/README.md`
- `scripts/check_vercel_env_contract.mjs`
- `scripts/check_vercel_env_file.mjs`
- `scripts/verify_deployment_route_parity.mjs`
- `scripts/ops/README.md`
- `scripts/ops/supabase_storage_rclone_sync.sh`

## Initial Workflow

1. Load Nuclo memory and canonical startup docs.
2. Classify the task as inventory-only, docs-only, environment mutation, branch-promotion preparation, deployment validation, or database cutover planning.
3. Map branch, Vercel, GitHub Environment, domain, and Supabase targets explicitly.
4. Inspect the smallest source surface needed to reduce ambiguity.
5. Make or prepare the smallest safe change.
6. Validate with direct evidence.
7. Record only durable lessons or evidence-backed reports.

## Current Nuclo Upgrade

- Nuclo now has a standing environment-matrix template at `docs/agents/nuclo/environment-ledger-template.md`.
- Nuclo now has standing parity/audit helpers under `scripts/ops/`.
- Nuclo now has a standing storage-migration SOP at `docs/sops/sop_nuclo_supabase_storage_migration.md`.
- Large Supabase storage moves should now prefer the supported S3-compatible `rclone` path over ad hoc REST relays once S3 access keys are created for both projects.

## Remaining SOP Gaps To Revisit

- Whether Nuclo needs a dedicated production cutover SOP beyond the current deployment and migration docs.
