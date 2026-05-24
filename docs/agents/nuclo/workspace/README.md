# Nuclo Workspace

Purpose: provide Nuclo with an owned workspace folder inside the repo for managed scratch organization, inbound files, and handoff preparation.

## Layout

- `inbox/`: place user-provided files or exports that Nuclo needs to inspect.
- `working-notes/`: temporary structured notes and draft planning material.
- `handoffs/`: prepared matrices, cutover checklists, and operator handoff packets before they are promoted into canonical docs.

## Authority

This folder is operational workspace only.

- It is not source of truth over canonical docs, code, env configuration, provider dashboards, or retained artifacts.
- Temporary files here must not be used as authoritative env values unless the user explicitly says to use that exact file for the task.
- Durable contract and memory live at:
  - `docs/agents/nuclo/README.md`
  - `docs/agents/nuclo/memory.md`
  - `docs/records/artifacts/agent/nuclo/`
