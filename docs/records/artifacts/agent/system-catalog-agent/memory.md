# System Catalog Agent Artifact Memory

Purpose: retain only narrow historical notes that are not worth promoting into the primary repo-visible memory surface.

## Load Rule

- Do not load this file during routine Catalog Agent runs.
- Use `docs/agents/system-catalog-agent/memory.md` for current durable behavior.
- Use dated reports or metric logs for historical evidence.

## Working Rule

When a note becomes important for current launch decisions:

- promote the concise version into `docs/agents/system-catalog-agent/memory.md`, or
- move the detail into a dated report or retained metric log

This file should stay intentionally sparse. If it starts accumulating current-state truth, prune it again.

## Retained Legacy Note

- 2026-05-10 through 2026-05-11 media-library speed planning remains historical retained context only. Use the dated reports in `docs/records/artifacts/agent/system-catalog-agent/reports/` if that lane is reopened; do not treat those notes as current launch-priority truth by default.
