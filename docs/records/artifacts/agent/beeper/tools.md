# Beeper Tools

Purpose: retain Beeper's helper inventory and future tooling needs.

## Current Tools

- local browser-driven route testing
- existing Playwright audit scripts under `frontend/tests/e2e/`
- `node docs/agents/beeper/workspace/scripts/ensure-audit-user.mjs --apply`
- `node docs/agents/beeper/workspace/scripts/ensure-audit-user.mjs --environment production --apply`
- `node docs/agents/beeper/workspace/scripts/live-product-walkthrough.mjs`
- `node docs/agents/beeper/workspace/scripts/start-training-run.mjs --slug <name>`
- `docs/agents/beeper/workspace/evidence-cache/` for ignored local raw screenshots, JSON packets, and storage-state files
- `docs/agents/beeper/workspace/evidence-manifests/` for tracked redacted evidence references
- `docs/agents/beeper/workspace/findings/` for compact cross-run product synthesis
- thread heartbeat automation: `beeper-30-minute-test-heartbeat`
- `docs/agents/d-bug/handoff-template.md` for durable debug intake when Beeper finds a real issue
- `docs/agents/beeper/workspace/action-coverage/master-coverage-log.md` for route/control/action coverage planning between runs
- `docs/agents/beeper/workspace/route-success-map.md` for defining major-route success targets
- `docs/agents/beeper/workspace/next-run-queue.md` for ranked lane selection
- `docs/agents/bopper/README.md` for the separate average-user comparison lane
- `docs/records/artifacts/agent/beeper/retest-debt.md` for retest prioritization after bug discovery
- `docs/records/artifacts/agent/beeper/performance-scorecard.md` for run scoring
- `docs/records/artifacts/agent/beeper/performance-ledger.md` for score trend review
- retained testing memory and run logging
- continuity-focused checks such as reload, reopen, and session-return validation during route bundles

## Future Tooling Needs

- richer route-specific interaction macros for AI Studio and dashboard flows
- small helper to append structured performance-ledger rows from run metadata
- optional helper to scaffold D-Bug handoffs directly from a Beeper issue packet
- optional helper to scaffold and update the action-coverage log from run metadata
- optional helper to append product scoreboards from run metadata
- small helper to generate redacted evidence manifests from local cache contents
