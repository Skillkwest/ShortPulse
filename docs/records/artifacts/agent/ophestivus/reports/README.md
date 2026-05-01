# Ophestivus Run Reports

Purpose: local markdown reports for completed Ophestivus SOP runs.

## Use

- Write reports with `cd frontend && npm run ophestivus:run-log`.
- Keep reports concise and link them from kanban tickets when useful.
- Treat the kanban ticket and activity log as the operational source of truth; these reports are local visibility artifacts.

## Guardrails

- Do not store secrets, tokens, private customer data, or temporary environment values here.
- Prefer one report per SOP run.
- Use ticket and incident ids in filenames when available.
