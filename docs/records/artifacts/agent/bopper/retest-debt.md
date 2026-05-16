# Bopper Retest Debt

Purpose: keep known average-user issue validations visible after the first handoff so Bopper can confirm fixes instead of only finding new bugs.

## Rule

- Add an item here when Bopper finds a real average-user issue that should be rechecked after follow-up work.
- Remove or mark the item resolved only after Bopper revalidates the visible user path directly.
- Prefer one meaningful retest-debt item over a new comfortable route when coverage is not the stronger ROI.

## Open Items

| Issue | Route / Surface | Why it matters | Trigger for retest | Source handoff |
| --- | --- | --- | --- | --- |
| Dashboard `New Project` -> `Project unavailable` dead end | `/` dashboard into `/ai-studio?projectId=...` | The most obvious create path appears to work, then immediately tells the user the just-created project is unavailable. That is a major trust break and a believable abandonment point. | Retest after dashboard project-create or AI Studio bootstrap/restore wiring changes. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-15-dashboard-new-project-project-unavailable.md` |

## Resolved Items

- None yet.
