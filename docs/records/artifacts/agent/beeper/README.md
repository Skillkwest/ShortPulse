# Beeper Agent Artifacts

Purpose: store non-authoritative retained artifacts for Beeper's live product testing, UX audits, and functionality walkthroughs.

## Status

Beeper is currently at `Level 1: Supervised`.

The agent has a durable contract, repo-visible memory, retained artifact area, owned workspace folder, standing SOP, and training packet flow. Beeper is ready for supervised live-product testing runs.
Real issues that merit engineering follow-up should also produce a D-Bug handoff packet in `docs/records/artifacts/agent/d-bug/handoffs/`.
User-facing checkpoint summaries live in `beeper/checkpoint-summaries/` so the human trainer can scan each checkpoint quickly.
Route/control/action coverage history lives in `beeper/action-coverage/` so Beeper can expand functional coverage over time.
The ranked next-lane queue lives in `beeper/next-run-queue.md` so Beeper can resume with less planning churn.

## Artifact Layout

- `memory.md`: retained working memory that supports the repo-visible memory surface.
- `baseline-kpi.md`: frozen quality targets Beeper should improve against over time.
- `performance-scorecard.md`: durable scoring rubric for rating each substantive run out of 10.
- `performance-ledger.md`: append-only ledger showing how Beeper earns a stronger score over time.
- `run-log.md`: append-only ledger of substantive Beeper runs.
- `sops.md`: Beeper workflow references and emerging SOP needs.
- `tools.md`: helper inventory and future tooling needs.
- `trainer-directives-log.md`: durable log of the trainer's standing instructions and prompt patterns.
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
