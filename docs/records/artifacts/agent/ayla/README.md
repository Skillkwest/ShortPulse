# Ayla Agent Artifacts

Purpose: store non-authoritative retained artifacts for Ayla's support, assistant, and approval-sensitive operational drafting work.

## Status

The agent has a durable contract, repo-visible memory, retained artifact area, and owned workspace folder. See `training-history.md` for the current supervised-run status instead of duplicating setup-state notes here.

## Artifact Layout

- `memory.md`: retained working memory that supports the repo-visible memory surface.
- `run-log.md`: append-only ledger of substantive Ayla runs.
- `sops.md`: Ayla workflow references and emerging SOP needs.
- `tools.md`: helper inventory and future tooling needs.
- `training-history.md`: supervised setup and future training runs.
- `reports/`: dated support run reports, templates, and retained summaries when a run needs durable detail.
- `templates/`: reusable drafting, approval, and escalation scaffolds.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, SOPs, ADRs, user instructions, current code, or direct validation evidence.

Retention standard:

- retain sanitized summaries by default, not raw customer records,
- redact personally identifying and secret-bearing details before storing durable artifacts,
- and keep customer-identifiable retained records only with explicit Kirk approval.

## Canonical Entry Points

- Agent contract: `docs/agents/ayla/README.md`
- Repo-visible memory: `docs/agents/ayla/memory.md`
- Owned workspace folder: `docs/agents/ayla/workspace/`
- Auth setup guide: `docs/supabase_auth_setup.md`
- Auth email operations SOP: `docs/sops/sop_supabase_auth_email_operations.md`
- Troubleshooting guide: `docs/troubleshooting.md`
