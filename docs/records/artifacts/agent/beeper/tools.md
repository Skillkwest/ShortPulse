# Beeper Tools

Purpose: retain Beeper's helper inventory and future tooling needs.

## Current Tools

- local browser-driven route testing
- existing Playwright audit scripts under `frontend/tests/e2e/`
- `node beeper/scripts/ensure-audit-user.mjs --apply`
- `node beeper/scripts/ensure-audit-user.mjs --environment production --apply`
- `node beeper/scripts/live-product-walkthrough.mjs`
- `node beeper/scripts/start-training-run.mjs --slug <name>`
- thread heartbeat automation: `beeper-30-minute-test-heartbeat`
- `docs/agents/d-bug/handoff-template.md` for durable debug intake when Beeper finds a real issue
- `beeper/action-coverage/master-coverage-log.md` for route/control/action coverage planning between runs
- `beeper/route-success-map.md` for defining major-route success targets
- `beeper/next-run-queue.md` for ranked lane selection
- `docs/records/artifacts/agent/beeper/retest-debt.md` for retest prioritization after bug discovery
- `docs/records/artifacts/agent/beeper/performance-scorecard.md` for run scoring
- `docs/records/artifacts/agent/beeper/performance-ledger.md` for score trend review
- retained testing memory and run logging

## Future Tooling Needs

- richer route-specific interaction macros for AI Studio and dashboard flows
- small helper to append structured performance-ledger rows from run metadata
- optional helper to scaffold D-Bug handoffs directly from a Beeper issue packet
- optional helper to scaffold and update the action-coverage log from run metadata
