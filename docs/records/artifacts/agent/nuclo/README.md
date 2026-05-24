# Nuclo Agent Artifacts

Purpose: store non-authoritative retained artifacts for Nuclo's environment, version, deployment, and database coordination work.

## Status

Nuclo is currently at `Level 1: Supervised`.

The agent has a durable contract, repo-visible memory, retained artifact area, and owned workspace folder. Nuclo has completed setup, live environment-state inventory, the audited production-readiness/cutover lane, post-cutover environment repair, and standing Supabase-manager safety guardrails.

## Artifact Layout

- `memory.md`: non-authoritative training memory retained with artifacts.
- `sops.md`: Nuclo workflow references and emerging SOP needs.
- `tools.md`: helper inventory and future tooling needs.
- `training-history.md`: supervised setup and future training runs.
- `reports/`: full environment audits, cutover packets, and validation summaries.

## Authority

These artifacts support training, traceability, and operational planning. They do not override canonical repo rules, deployment docs, current user instructions, live provider state, or direct validation evidence.

Current branch-policy note:

- Historical references to `working-development`, `staging-preview`, or older branch-ladder decisions in this artifact area are retained for traceability only.
- Nuclo's current standing operating rule lives in `docs/agents/nuclo/README.md` and `docs/agents/nuclo/memory.md`: during the current pre-launch phase, operate only on `production` unless the user explicitly changes that rule in-thread.

## Canonical Entry Points

- Active handoff: `docs/agents/nuclo/CURRENT-HANDOFF.md`
- Agent contract: `docs/agents/nuclo/README.md`
- Repo-visible memory: `docs/agents/nuclo/memory.md`
- Deployment runbook: `docs/deployment.md`
- Local development guide: `docs/local-development.md`
- Database migration guide: `docs/database-migrations.md`
- Security checklist: `docs/security-checklist.md`
- Owned workspace folder: `docs/agents/nuclo/workspace/`
