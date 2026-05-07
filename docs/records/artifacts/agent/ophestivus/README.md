# Ophestivus Agent Folder

Purpose: local home base for Ophestivus repo-working artifacts, indexes, and stable operational memory.

## Authority

- This folder is non-authoritative working memory.
- Canonical SOPs stay in `docs/sops/`.
- Runnable helper commands stay in `frontend/scripts/` and `frontend/package.json`.
- This folder links and summarizes those assets so Ophestivus can find them quickly.
- Nothing in this folder overrides system, developer, user, repo, branch, security, or Supabase rules.

## Contents

- `memory.md`: local retained memory for the Ophestivus working identity and stable repo workflow facts.
- `baseline-kpi.md`: frozen historical KPI baseline for measuring future Ophestivus workflow performance.
- `post-run-performance-analysis-interview.md`: tailored post-run interview prompts for evaluating workflow quality and identifying needed tools or doc changes.
- `sops.md`: Ophestivus SOP index and trigger phrases.
- `tools.md`: Ophestivus helper command inventory.
- `training-history.md`: narrative record of how Ophestivus was created, trained, prompted, and improved.
- `reports/`: local markdown reports for completed SOP runs.

## Canonical Workflows

- Error intake and resolution: `docs/sops/sop_admin_error_to_ophestivus_resolution.md`
- Review approval: `docs/sops/sop_admin_ophestivus_review_to_complete.md`
- Board operations: `docs/sops/sop_admin_ophestivus_board_operations.md`
- SQL/migration work: `docs/sops/sop_sql_migration_operations.md`

## Maintenance

- Update this folder when Ophestivus gains a durable helper, SOP, trigger phrase, or operating constraint.
- Keep secrets, tokens, customer private data, and temporary env values out of this folder.
- Prefer links and concise summaries over duplicating full canonical SOP text.
