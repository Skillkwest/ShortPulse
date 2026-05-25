# Ophestivus Ownership Manifest

Purpose: define which repo surfaces belong to Ophestivus's local folder, which shared surfaces Ophestivus depends on, and which nearby files should stay outside Ophestivus ownership.

## Directly Owned By Ophestivus

These are Ophestivus's canonical local identity, instruction, memory, and retained artifact surfaces:

- `docs/records/artifacts/agent/ophestivus/README.md`
- `docs/records/artifacts/agent/ophestivus/contract.md`
- `docs/records/artifacts/agent/ophestivus/AGENTS.md`
- `docs/records/artifacts/agent/ophestivus/ownership-manifest.md`
- `docs/records/artifacts/agent/ophestivus/memory.md`
- `docs/records/artifacts/agent/ophestivus/sops.md`
- `docs/records/artifacts/agent/ophestivus/tools.md`
- `docs/records/artifacts/agent/ophestivus/training-history.md`
- `docs/records/artifacts/agent/ophestivus/baseline-kpi.md`
- `docs/records/artifacts/agent/ophestivus/error-ledger.md`
- `docs/records/artifacts/agent/ophestivus/error-capability-map.md`
- `docs/records/artifacts/agent/ophestivus/post-run-performance-analysis-interview.md`
- `docs/records/artifacts/agent/ophestivus/sop-docs/*`
- `docs/records/artifacts/agent/ophestivus/tools/*`
- `docs/records/artifacts/agent/ophestivus/reports/*`

## Shared But Not Ophestivus-Owned

These are repo or product surfaces Ophestivus uses, but should not absorb into the local Ophestivus folder by default:

- root `AGENTS.md`
- `docs/README.md`
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- `docs/agents/ophestivus/README.md` as a compatibility pointer only
- `docs/sops/sop_admin_error_to_ophestivus_resolution.md`
- `docs/sops/sop_admin_ophestivus_board_operations.md`
- `docs/sops/sop_admin_ophestivus_review_to_complete.md`
- `docs/sops/sop_admin_ophestivus_complete_regression_audit.md`
- `docs/sops/sop_admin_ophestivus_post_run_training_audit.md`
- shared product code and tests under `frontend/`
- shared package wiring in `frontend/package.json`

## Explicitly Not Ophestivus-Owned

These may mention Ophestivus, but they belong somewhere else and should stay there:

- other agent folders under `docs/agents/*`
- other agent artifact folders under `docs/records/artifacts/agent/*`
- shared indexes such as `docs/agents/README.md`, `docs/README.md`, and `docs/records/artifacts/agent/README.md`
- shared admin product surfaces under `frontend/pages/admin/*`, `frontend/features/admin/*`, and `frontend/lib/server/*`
- shared validation surfaces such as `frontend/scripts/__tests__/ophestivus_*.test.mjs` and `frontend/tests/scripts/ophestivus-*.test.mjs`

## Move Rule

Move or create a file in Ophestivus space only when all of the following are true:

1. it defines Ophestivus-local behavior, memory, retained training, or Ophestivus-only operating instructions,
2. it is not the canonical home for shared repo policy or shared product behavior,
3. it is not owned by another agent's contract or artifact history,
4. keeping it outside Ophestivus space would create ambiguity about Ophestivus's own operating package.

## Do Not Recreate

Do not recreate a second assistant-local package for Ophestivus under another generic folder name.
