## Purpose

Attempt the queued `Open Projects` trust lane and compare reopen confidence against `New Project`.

## Task

- Environment: local
- Base URL: `http://localhost:3000`
- Interaction fidelity: `mixed`
- Audit user: mixed browser state only; production dashboard available in this Chrome window was public, and local continuity came from reopened recent tabs
- Route target: signed-in saved-project reopen path

## Route Summary

- Started from stale local AI Studio browser residue rather than a fresh signed-in dashboard.
- Tried the obvious recovery moves a normal user would try:
  - browser reload,
  - local dashboard recovery,
  - production dashboard fallback,
  - recently closed tab reopen.
- Reached a believable local signed-in project-restore path, but AI Studio crashed during restore before Bopper could compare reopen trust against `New Project`.

## Findings

### Functional Result

- The intended `Open Projects` comparison did not complete.
- The run uncovered a live local regression instead:
  - local dashboard recovery surfaced `EDIT_PRESET_BASE_DEFINITIONS is not defined`
  - reopened local AI Studio project surfaced `SEEDED_EXPERT_EDIT_SYSTEM_PRESET_DEFINITIONS is not iterable`
  - dev/browser runtime also surfaced `Module not found: Can't resolve './generationCharacterModeDecision'`

### UX Read

- The visible restore-progress card is actually good UX right until the crash.
- That makes the failure feel worse, because the app strongly signals "your project is opening" before collapsing.
- Reopening saved work now feels more fragile than starting fresh, which is the wrong trust shape for this ICP.

### ICP Conclusion

- Bopper would not read this as a small bug.
- He would read it as "my saved work is not dependable."
- That is a serious value hit for a paid user trying to build repeatable output and income.

## Evidence

- Run packet: `docs/agents/bopper/workspace/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/packet.json`
- Run brief: `docs/agents/bopper/workspace/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/run-brief.md`
- Notes: `docs/agents/bopper/workspace/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/notes.md`
- Click log: `docs/agents/bopper/workspace/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/click-log.md`
- Decision log: `docs/agents/bopper/workspace/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/decision-log.md`
- Evidence manifest: `docs/agents/bopper/workspace/runs/2026-05-16-082511-open-projects-reopen-vs-new-project/evidence/README.md`
- D-Bug handoff: `docs/records/artifacts/agent/d-bug/handoffs/2026-05-16-local-ai-studio-project-reopen-runtime-regression.md`

## Outcome

- This lane should stay open as retest debt after the local AI Studio runtime regression is repaired.
- The strongest current read is not dashboard semantics. It is saved-project trust failure caused by reopen instability.
