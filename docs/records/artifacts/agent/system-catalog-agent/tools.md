# System Catalog Agent Tooling Inventory

Purpose: record helper commands, scripts, and future tooling needs for the System Catalog Agent.

## Current Helper Paths

- Startup contract: `skills/skill-session-startup-contract/SKILL.md`
- Systems catalog: `docs/systems/catalog.md`
- Rating rubric: `docs/systems/rating-rubric.md`
- Operator map: `docs/operator-map.md`
- Route map: `docs/routes.md`
- Docs check: `npm -C frontend run docs:check`

## Useful Inspection Commands

- `rg '^\\| ' docs/systems/catalog.md`
- `find frontend/pages/api -maxdepth 4 -type f | sort`
- `find frontend/lib/server -maxdepth 4 -type f | sort`
- `wc -l <key-file>` for hotspot sizing

## Tooling Needs

- A reusable closeout diff summarizer if repeated report-intake runs prove too slow or inconsistent.
- A lightweight metrics updater or snapshot helper if the launch-metrics, score-movement, and decision-outcome logs become too manual to maintain consistently.
- A lane cycle-time helper if dispatch, completion, and review timestamps start getting noisy across many concurrent agents.
