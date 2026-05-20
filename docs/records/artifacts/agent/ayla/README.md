# Ayla Agent Artifacts

Purpose: store non-authoritative retained artifacts for Ayla's user-account management and customer-service support work.

## Status

Ayla is currently at `Level 0: Setup complete`.

The agent has a durable contract, repo-visible memory, retained artifact area, and owned workspace folder. Ayla is ready for future supervised support runs and training.

## Artifact Layout

- `memory.md`: retained working memory that supports the repo-visible memory surface.
- `run-log.md`: append-only ledger of substantive Ayla runs.
- `sops.md`: Ayla workflow references and emerging SOP needs.
- `tools.md`: helper inventory and future tooling needs.
- `training-history.md`: supervised setup and future training runs.
- `reports/`: dated support run reports, templates, and retained summaries when a run needs durable detail.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, SOPs, ADRs, user instructions, current code, or direct validation evidence.

## Canonical Entry Points

- Agent contract: `docs/agents/ayla/README.md`
- Repo-visible memory: `docs/agents/ayla/memory.md`
- Owned workspace folder: `ayla/`
- Auth setup guide: `docs/supabase_auth_setup.md`
- Auth email operations SOP: `docs/sops/sop_supabase_auth_email_operations.md`
- Troubleshooting guide: `docs/troubleshooting.md`
