# Beeper Agent Artifacts

Purpose: store non-authoritative retained artifacts for Beeper's live product alpha-testing, UX audits, continuity checks, and functionality walkthroughs.

## Status

Beeper is currently at `Level 1: Supervised`.

The agent has a durable contract, repo-visible memory, retained artifact area, owned workspace folder, standing SOP, and training packet flow. Beeper is ready for supervised live-product alpha-testing runs.
Real issues that merit engineering follow-up should also produce a D-Bug handoff packet in `docs/records/artifacts/agent/d-bug/handoffs/`.
User-facing checkpoint summaries live in `beeper/checkpoint-summaries/` so the human trainer can scan each checkpoint quickly.
Cross-run product syntheses live in `beeper/findings/` so future sessions can load compact truth before raw packet archaeology.
Tracked redacted evidence references live in `beeper/evidence-manifests/` or per-run `evidence-manifest.md` files.
Local raw screenshots and JSON packets live only in the ignored cache at `beeper/evidence-cache/`.
Route/control/action coverage history lives in `beeper/action-coverage/` so Beeper can expand functional coverage over time.
The ranked next-lane queue lives in `beeper/next-run-queue.md` so Beeper can resume with less planning churn.
Major-route success targets live in `beeper/route-success-map.md` so coverage depth is judged against real user outcomes.
Open retest debt lives in `docs/records/artifacts/agent/beeper/retest-debt.md` so known bugs stay visible until Beeper revalidates them.

## Artifact Layout

- `memory.md`: retained working memory that supports the repo-visible memory surface.
- `baseline-kpi.md`: frozen quality targets Beeper should improve against over time.
- `performance-scorecard.md`: durable scoring rubric for rating each substantive run out of 10.
- `performance-ledger.md`: append-only ledger showing how Beeper earns a stronger score over time.
- `campaign-scorecard.md`: campaign-level Coverage Score and Impact Score across multiple runs.
- `retest-debt.md`: open bug retests and validation debt that should be revisited after fixes.
- `run-log.md`: append-only ledger of substantive Beeper runs.
- `sops.md`: Beeper workflow references and emerging SOP needs.
- `tools.md`: helper inventory and future tooling needs.
- `trainer-directives-log.md`: durable log of the trainer's standing instructions and prompt patterns.
- `training-history.md`: supervised setup and future training runs.
- `dual-evaluation-framework.md`: shared architecture for agent-performance scoring plus product-quality scoring.
- `agent-capability-matrix.md`: current map of what Beeper can reliably do.
- `agent-readiness-ladder.md`: progression model for giving Beeper harder work over time.
- `trainer-feedback-log.md`: durable trainer corrections that should shape future behavior.
- `mistake-patterns.md`: repeatable Beeper failure modes and their corrections.
- `reports/`: dated audit reports, templates, and retained summaries when a run needs durable detail.
- `product-scorecards/`: route, workflow, trust, and fix-retest product quality ledgers.

## Alpha Focus

- Beeper is the professional alpha tester by default.
- Strong Beeper runs should usually validate a real route bundle plus one continuity, persistence, or reentry truth.
- Bopper remains the better lane for first-impression confusion and abandonment-only reads.

## Authority

These artifacts support training, traceability, and workflow continuity. They do not override canonical repo rules, SOPs, ADRs, user instructions, current code, or direct validation evidence.

## Canonical Entry Points

- Agent contract: `docs/agents/beeper/README.md`
- Repo-visible memory: `docs/agents/beeper/memory.md`
- Owned workspace folder: `beeper/`
- Findings folder: `beeper/findings/`
- Evidence manifest folder: `beeper/evidence-manifests/`
- Routes map: `docs/routes.md`
- Testing guide: `docs/testing-guide.md`
- Local development guide: `docs/local-development.md`
- Beeper workspace run packets: `beeper/runs/`
