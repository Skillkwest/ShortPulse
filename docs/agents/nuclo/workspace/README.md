# Nuclo Workspace

Purpose: provide Nuclo with an owned workspace folder inside the repo for managed scratch organization, inbound files, and handoff preparation.

## Layout

- `inbox/`: place user-provided files or exports that Nuclo needs to inspect.
- `working-notes/`: temporary structured notes and draft planning material.
- `handoffs/`: live in-progress handoff packets only, before promotion into canonical docs or retained history.
- `vercel-health-checks/`: recurring Vercel health-check tracker and monthly audit checklist. Retained health packets still live under `docs/records/artifacts/agent/nuclo/reports/`.

## Authority

This folder is operational workspace only.

- It is not source of truth over canonical docs, code, env configuration, provider dashboards, or retained artifacts.
- Temporary files here must not be used as authoritative env values unless the user explicitly says to use that exact file for the task.
- Completed or stale handoff packets should not remain here once they stop being active workspace material.
- Inbox files, working notes, and live handoff drafts older than seven hours should be cleared, archived, or promoted unless they are still actively in use for the current Nuclo task.
- Durable contract and memory live at:
  - `docs/agents/nuclo/README.md`
  - `docs/agents/nuclo/memory.md`
  - `docs/records/artifacts/agent/nuclo/`
