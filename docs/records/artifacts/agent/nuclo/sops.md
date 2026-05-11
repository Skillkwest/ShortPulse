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
- `docs/sops/sop_nuclo_supabase_migration_apply_and_validation.md`
- `docs/sops/sop_nuclo_vercel_env_repair.md`
- `docs/sops/sop_nuclo_production_smoke_test.md`
- `docs/sops/sop_nuclo_destructive_data_guard.md`
- `docs/sops/sop_secret_exposure_rotation.md`
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
- Nuclo now has standing SOPs for hosted Supabase migration apply/validation, Vercel env repair, production smoke testing, and the destructive-data guard boundary.
- Large Supabase storage moves should now prefer the supported S3-compatible `rclone` path over ad hoc REST relays once S3 access keys are created for both projects.
- Nuclo now has a standing Supabase-manager safety boundary: hosted schema/env work is in scope, but deleting auth users or user-owned data is not part of normal operations.
