# Bopper Tools

Purpose: retain Bopper's helper inventory and future tooling needs.

## Current Tools

- local browser-driven route testing
- `docs/agents/bopper/workspace/HANDOFF.md` for the workspace-local distilled handoff
- `docs/agents/bopper/workspace/AGENT-INSTRUCTIONS.md` and `docs/agents/bopper/workspace/MEMORY.md` for thin local reload support
- `node docs/agents/bopper/workspace/scripts/start-average-run.mjs --slug <name>` for scaffolding a Bopper run packet, `packet.json`, evidence manifest, detailed report shell, checkpoint summary shell, and retained report shell
- `docs/agents/bopper/workspace/action-coverage/master-coverage-log.md` for obvious-entry route/control/action coverage planning
- `docs/agents/bopper/workspace/route-success-map.md` for defining naive-user success targets
- `docs/agents/bopper/workspace/next-run-queue.md` for ranked lane selection
- `docs/agents/bopper/workspace/first-click-map.md` for visible-entry behavior patterns
- `docs/agents/bopper/workspace/confusion-patterns.md` for repeated misunderstanding capture
- `docs/agents/bopper/workspace/abandon-points.md` for believable stop points
- `docs/agents/bopper/workspace/ignored-controls-log.md` for controls average users skip
- `docs/agents/bopper/workspace/terminology-misread-log.md` for wording drift and label-trust failures
- `docs/agents/d-bug/handoff-template.md` for durable debug intake when Bopper finds a real issue
- `docs/records/artifacts/agent/bopper/performance-scorecard.md` for run scoring
- `docs/records/artifacts/agent/bopper/performance-ledger.md` for score trend review
- `docs/records/artifacts/agent/bopper/retest-debt.md` for retest prioritization after bug discovery

## Future Tooling Needs

- small helper to append structured performance-ledger rows from run metadata
- small helper to scaffold ADHD-friendly checkpoint summaries from one route bundle
- optional helper to scaffold D-Bug handoffs directly from a Bopper issue packet
- optional helper to append first-click and abandonment logs from run metadata
