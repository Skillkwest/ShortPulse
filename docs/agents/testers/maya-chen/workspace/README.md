# Maya Chen Workspace

This workspace is Maya Chen's durable operating area inside the ShortPulse repo.

Use it for Maya-specific agent instructions, memory, test notes, reusable tools, and run artifacts that help Maya improve as a simulated customer tester over time.

## Load Order

Before a Maya testing run, load:

1. `docs/agents/testers/maya-chen/icp.md`
2. `docs/agents/testers/maya-chen/standard-operating-procedure.md`
3. `docs/agents/testers/maya-chen/authenticated-testing-and-reporting-sop.md`
4. `docs/agents/testers/maya-chen/workspace/AGENTS.md`
5. `docs/agents/testers/maya-chen/workspace/memory.md`
6. `docs/agents/testers/maya-chen/workspace/ugc-content-goal.md`
7. `docs/agents/testers/maya-chen/workspace/human-nuance-card.md`
8. `docs/agents/testers/maya-chen/workspace/persona-runtime-card.md`

The ICP and SOPs define Maya's customer psychology and duties. This workspace defines how Maya stores artifacts, notes, and learning between runs.

## Contents

- `AGENTS.md`: workspace-local instructions for Maya's artifacts, notes, tools, and memory.
- `memory.md`: durable Maya behavior memory and learning log.
- `ugc-content-goal.md`: Maya's durable UGC content project arc for multi-run testing.
- `human-nuance-card.md`: Maya's live inner-life, taste, contradiction, and social-stakes guide.
- `persona-runtime-card.md`: compact in-run persona card for staying embodied as Maya while clicking through the app.
- `baseline-kpi-2026-07-05.md`: frozen performance baseline for comparing future Maya runs.
- `active-next-scenarios.md`: current small scenario queue for the next natural Maya tests.
- `self-score-ledger.md`: durable post-run scoring history for Maya's tester performance.
- `training-history.md`: supervised behavior changes and training-loop notes.
- `supervised-feedback-inference-log.md`: inferred training signals from user corrections, performance reviews, and tooling questions.
- `notes/`: lightweight working notes, run prep, post-run reflections, and improvement observations.
- `tools/`: reusable Maya-specific helper scripts, payload templates, browser snippets, worksheets, prompt starters, bug-escalation checklists, or checklists. Start live runs from `tools/run-control-panel.md` after loading the governing docs.
- `artifacts/`: non-report artifacts from testing runs that should stay with Maya but do not belong in `reports/`.

## Boundaries

- Do not store secrets, passwords, cookies, auth tokens, or service-role keys here.
- Keep production test reports in `docs/agents/testers/maya-chen/reports/`; require publish readiness before a normal run, then ingest and verify both report cards in Admin Tester Reports before calling the run complete.
- Store only Maya-specific material here. Product requirements, engineering decisions, and implementation plans belong in the normal product docs or scoped agent lanes.
- If the app is clearly broken during a run, preserve Maya's customer reaction and then use `tools/clear-bug-escalation-checklist.md` to report the bug objectively.
