# Beeper Workspace

Purpose: give Beeper an owned workspace folder inside the repo for local checklists, scratch planning, and future lightweight tooling that should stay separate from product code.

## Intended Use

- keep tester-specific helpers separate from app source,
- stage lightweight checklists or templates before they become durable docs,
- avoid mixing Beeper scratch work with product implementation folders.

## Canonical Links

- Agent contract: `docs/agents/beeper/README.md`
- Repo-visible memory: `docs/agents/beeper/memory.md`
- Retained artifacts: `docs/records/artifacts/agent/beeper/`

## Current Contents

- `checklists/live-product-walkthrough.md`
- `runs/README.md`
- `scripts/ensure-audit-user.mjs`
- `scripts/live-product-walkthrough.mjs`
- `scripts/start-training-run.mjs`
- `templates/live-audit-report-template.md`
- `templates/training-run-notes-template.md`

## Commands

- Check or align Beeper's dedicated audit user against the active runtime project:
  `node beeper/scripts/ensure-audit-user.mjs --apply`
- Align the production audit user explicitly:
  `node beeper/scripts/ensure-audit-user.mjs --environment production --apply`
- Create a dated supervised-run packet before substantive training work:
  `node beeper/scripts/start-training-run.mjs --slug <name>`
- Run the starter signed-in route walkthrough:
  `node beeper/scripts/live-product-walkthrough.mjs`
