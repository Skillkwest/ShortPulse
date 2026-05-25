# Ophestivus Agent Folder

Purpose: local home base for Ophestivus repo-working artifacts, indexes, and stable operational memory.

## Authority

- This folder is non-authoritative working memory.
- This folder is Ophestivus's canonical local working home for agent-specific instructions, retained memory, artifact indexes, and run reports.
- Ophestivus-owned SOP source docs live in `sop-docs/`.
- Ophestivus-owned runtime helper scripts live in `tools/`.
- Compatibility pointers remain in `docs/sops/`.
- Frontend command wiring remains in `frontend/package.json`.
- This folder links and summarizes those assets so Ophestivus can find them quickly.
- Nothing in this folder overrides system, developer, user, repo, branch, security, or Supabase rules.

## Contents

- `contract.md`: active Ophestivus contract kept inside the canonical local workspace folder.
- `AGENTS.md`: folder-scoped Ophestivus working instructions and context-load rules.
- `ownership-manifest.md`: map of what belongs in Ophestivus local space versus shared repo surfaces.
- `memory.md`: local retained memory for the Ophestivus working identity and stable repo workflow facts.
- `baseline-kpi.md`: frozen historical KPI baseline for measuring future Ophestivus workflow performance.
- `error-capability-map.md`: pattern-level capability map showing what incident classes I can handle, which need guardrails, and which remain human-first.
- `error-ledger.md`: cross-run incident ledger with fixed classifications, board ids, outcomes, and report links.
- `post-run-performance-analysis-interview.md`: tailored post-run interview prompts for evaluating workflow quality and identifying needed tools or doc changes.
- `training-rubric.md`: reusable per-run scoring rubric for judging workflow quality and identifying what to train next.
- `sops.md`: Ophestivus SOP index and trigger phrases.
- `tools.md`: Ophestivus helper command inventory.
- `sop-docs/`: Ophestivus-owned SOP source documents.
- `tools/`: Ophestivus-owned runtime helper scripts.
- `training-history.md`: narrative record of how Ophestivus was created, trained, prompted, and improved.
- `reports/`: local markdown reports for completed SOP runs.

## Canonical Workflows

- Error intake and resolution: `docs/records/artifacts/agent/ophestivus/sop-docs/sop_admin_error_to_ophestivus_resolution.md`
- Review approval: `docs/records/artifacts/agent/ophestivus/sop-docs/sop_admin_ophestivus_review_to_complete.md`
- Board operations: `docs/records/artifacts/agent/ophestivus/sop-docs/sop_admin_ophestivus_board_operations.md`
- SQL/migration work: `docs/sops/sop_sql_migration_operations.md`

## Local Contract

- Active contract: `docs/records/artifacts/agent/ophestivus/contract.md`
- Compatibility pointer only: `docs/agents/ophestivus/README.md`

## Maintenance

- Put future Ophestivus-only instructions, memory, retained SOP indexes, and artifact summaries in this folder by default.
- Update this folder when Ophestivus gains a durable helper, SOP, trigger phrase, or operating constraint.
- Keep secrets, tokens, customer private data, and temporary env values out of this folder.
- Prefer links and concise summaries over duplicating full canonical SOP text.
