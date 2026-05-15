# Beeper Agent Artifacts

Purpose: store non-authoritative retained artifacts for Beeper's live product testing, UX audits, and functionality walkthroughs.

## Status

Beeper is currently at `Level 0: Setup complete`.

The agent has a durable contract, repo-visible memory, retained artifact area, and owned workspace folder. Beeper is ready for supervised live-product testing runs.

## Artifact Layout

- `memory.md`: retained working memory that supports the repo-visible memory surface.
- `baseline-kpi.md`: frozen quality targets Beeper should improve against over time.
- `run-log.md`: append-only ledger of substantive Beeper runs.
- `sops.md`: Beeper workflow references and emerging SOP needs.
- `tools.md`: helper inventory and future tooling needs.
- `training-history.md`: supervised setup and future training runs.
- `reports/`: dated audit reports, templates, and retained summaries when a run needs durable detail.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, SOPs, ADRs, user instructions, current code, or direct validation evidence.

## Canonical Entry Points

- Agent contract: `docs/agents/beeper/README.md`
- Repo-visible memory: `docs/agents/beeper/memory.md`
- Owned workspace folder: `beeper/`
- Routes map: `docs/routes.md`
- Testing guide: `docs/testing-guide.md`
- Local development guide: `docs/local-development.md`
- Beeper workspace run packets: `beeper/runs/`
