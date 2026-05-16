# AGENTS.md - System Catalog Agent

Scope: `docs/agents/system-catalog-agent/`

Use this folder as the canonical operating surface for the Catalog Agent.

## Load Order

For normal Catalog Agent execution, load in this order:

1. `README.md`
2. `standard-operating-procedure.md`
3. `prioritized-handoff-queue-2026-07-02.md`
4. latest launch-state truth:
   - `docs/records/artifacts/agent/system-catalog-agent/reports/2026-05-06-dispatch-log.md`
   - or the latest dated launch-state refresh report when needed
5. the system-specific docs in scope

Load these only when the task explicitly requires them:

- `catalog-tool-health-metrics.md`
- `measurement-and-learning.md`
- `production-readiness-plan-2026-07-02.md`
- `dispatch-ready-audit-output-template.md`
- `operator-brief-template.md`
- `handoff-template.md`
- `handoffs/`

Do not load the full retained artifact history for routine work.

## Operator Brief Rule

- After every meaningful Catalog Agent run, create both operator brief artifacts:
  - rich-format HTML brief
  - Markdown source brief
- In user-facing closeout, surface the HTML brief as the primary operator brief and include the Markdown source as secondary traceability.
- Inside the artifacts themselves, the HTML brief is the canonical user-facing brief. The Markdown file is source-only.

## Authority Rules

- The dated queue is the authority for exact next-work order.
- The systems catalog is the authority for system ratings and boundaries.
- This folder defines Catalog Agent operating behavior.
- Retained artifacts under `docs/records/artifacts/agent/system-catalog-agent/` support memory and traceability, but they do not override current repo truth.

## Editing Rules

- Keep this folder operational and current.
- Prefer tightening the current system over adding more process.
- Remove duplicate priority or launch-state truth instead of maintaining it in multiple places.
- If the ship bar no longer supports the active target date, say so explicitly.

## Validation

After edits that affect this folder or linked systems docs, run:

```bash
npm -C frontend run docs:check
```
