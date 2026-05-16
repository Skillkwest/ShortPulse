# Bopper Retest Debt

Purpose: keep known average-user issue validations visible after the first handoff so Bopper can confirm fixes instead of only finding new bugs.

## Rule

- Add an item here when Bopper finds a real average-user issue that should be rechecked after follow-up work.
- Remove or mark the item resolved only after Bopper revalidates the visible user path directly.
- Prefer one meaningful retest-debt item over a new comfortable route when coverage is not the stronger ROI.

## Open Items

| Issue | Route / Surface | Why it matters | Trigger for retest | Source handoff |
| --- | --- | --- | --- | --- |
| Saved project reopen runtime regression | local reopened `AI Studio` project / dashboard recovery | Bopper now reads reopen as less trustworthy than create, which directly harms saved-work confidence for a paying user. | Retest after the local AI Studio preset/runtime regression is repaired. | `docs/records/artifacts/agent/d-bug/handoffs/2026-05-16-local-ai-studio-project-reopen-runtime-regression.md` |

## Resolved Items

- Dashboard `New Project` -> `Project unavailable` dead end
  - Route / surface: signed-in dashboard into `/ai-studio?projectId=...`
  - Resolution evidence: `docs/records/artifacts/agent/bopper/reports/2026-05-15-local-dashboard-new-project-fix-retest.md`
  - Resolution note: the signed-in dashboard `New Project` path and the adjacent project-library `New Project` path now both land in usable AI Studio without reproducing the old contradiction.
