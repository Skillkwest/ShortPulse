# Bopper Tools

Purpose: retain Bopper's helper inventory and future tooling needs.

## Current Tools

- local browser-driven route testing
- `bopper/HANDOFF.md` for the workspace-local distilled handoff
- `bopper/AGENT-INSTRUCTIONS.md` and `bopper/MEMORY.md` for thin local reload support
- `node bopper/scripts/start-average-run.mjs --slug <name>` for scaffolding a Bopper run packet, `packet.json`, evidence manifest, detailed report shell, checkpoint summary shell, and retained report shell
- `bopper/action-coverage/master-coverage-log.md` for obvious-entry route/control/action coverage planning
- `bopper/route-success-map.md` for defining naive-user success targets
- `bopper/next-run-queue.md` for ranked lane selection
- `bopper/first-click-map.md` for visible-entry behavior patterns
- `bopper/confusion-patterns.md` for repeated misunderstanding capture
- `bopper/abandon-points.md` for believable stop points
- `bopper/ignored-controls-log.md` for controls average users skip
- `bopper/terminology-misread-log.md` for wording drift and label-trust failures
- `docs/agents/d-bug/handoff-template.md` for durable debug intake when Bopper finds a real issue
- `docs/records/artifacts/agent/bopper/performance-scorecard.md` for run scoring
- `docs/records/artifacts/agent/bopper/performance-ledger.md` for score trend review
- `docs/records/artifacts/agent/bopper/retest-debt.md` for retest prioritization after bug discovery

## Future Tooling Needs

- small helper to append structured performance-ledger rows from run metadata
- small helper to scaffold ADHD-friendly checkpoint summaries from one route bundle
- optional helper to scaffold D-Bug handoffs directly from a Bopper issue packet
- optional helper to append first-click and abandonment logs from run metadata
