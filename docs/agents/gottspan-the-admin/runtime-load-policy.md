# Gottspan Runtime Load Policy

Purpose: define the minimum runtime context Gottspan should load by default so repo-steward work stays fast, lean, and reliable.

## Always Load

These are the default Gottspan runtime surfaces:

- `AGENTS.md`
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- `docs/README.md`
- `docs/troubleshooting.md`
- `docs/glossary.md`
- `frontend/AGENTS.md`
- `docs/AGENTS.md`
- `docs/agents/gottspan-the-admin/README.md`
- `docs/agents/gottspan-the-admin/memory.md`
- this file

## Load Conditionally

Load these only when the lane requires them:

- `docs/agents/gottspan-the-admin/standard-operating-procedure.md`
  - when doing substantive repo-steward execution, governance updates, or route/authority decisions
- `docs/agents/gottspan-the-admin/repo-state-audit-checklist.md`
  - when doing a repo-state audit
- `docs/agents/gottspan-the-admin/weekly-repo-steward-run.md`
  - when running the recurring weekly audit flow
- `docs/agents/gottspan-the-admin/ux-playbook.md`
  - when the task is about admin trust, hesitation, clarity, or operator UX
- `docs/agents/gottspan-the-admin/prompts/README.md`
  - when the user asks for saved prompts or prompt-library maintenance
- individual prompt files under `docs/agents/gottspan-the-admin/prompts/`
  - only when the user asks to use, save, rewrite, or inspect a specific prompt
- `docs/agents/gottspan-the-admin/reports/README.md`
  - when reviewing report history or filing a new report
- `docs/agents/gottspan-the-admin/reports/weekly-repo-state-report-template.md`
  - when drafting a weekly report
- `docs/agents/gottspan-the-admin/reports/run-report-template.md`
  - when drafting a non-weekly role-owned report
- dated reports under `docs/agents/gottspan-the-admin/reports/`
  - only when historical evidence is needed
- `docs/records/artifacts/agent/gottspan-the-admin/README.md`
  - when artifact governance itself is part of the task
- `docs/records/artifacts/agent/gottspan-the-admin/baseline-kpi.md`
  - when scoring a run against the baseline
- `docs/records/artifacts/agent/gottspan-the-admin/training-history.md`
  - when training continuity or retained learning is directly relevant

## Do Not Load By Default

These are useful retained surfaces, but they should stay out of normal runtime context unless explicitly needed:

- dated Gottspan reports
- training history
- baseline KPI
- prompt library index
- saved prompt files

## Practical Rule

When in doubt:

1. load the core repo rules
2. load Gottspan contract + memory + this policy
3. load one additional Gottspan surface only if the current lane truly needs it

Do not load retained history just because it exists.
