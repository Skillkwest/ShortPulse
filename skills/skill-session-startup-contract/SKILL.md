---
name: skill-session-startup-contract
description: Enforce the mandatory session startup contract for every new task/session in ShortPulse before making edits.
---

# Session Startup Contract

Purpose: enforce consistent startup behavior in every new task/session so context is loaded before execution and edits.

## When to use
- At the start of every new task/session in this repo.

## Sources of truth
- `AGENTS.md`
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- `docs/README.md`
- `docs/troubleshooting.md`
- `docs/glossary.md`
- `frontend/AGENTS.md`
- `docs/AGENTS.md`

## Workflow
1. **Preflight**
   - Confirm mode: `brainstorm/no-edit` vs implementation.
   - Run workspace safety check before broad/repo-wide commands.
2. **Core docs**
   - Load the root + docs core references listed above.
   - Load scoped AGENTS files for touched directories.
3. **Task routing**
   - SQL/migrations: load SQL SOP + migration + security docs and touched migration files.
   - Routes/UI behavior: load route map + relevant SOPs + top-level `README.md`.
   - Pricing/credits: run `skills/skill-pricing-audit/SKILL.md`.
   - Pricing display/debit wiring: also run `skills/skill-pricing-wiring/SKILL.md`.
   - Docs/index drift: run `skills/skill-doc-index/SKILL.md` or `skills/skill-mvp-docs-sop-governance/SKILL.md`.
4. **Web browsing decision**
   - Use local repo sources by default.
   - Browse only when requested, when recency matters, or when facts are high-stakes/unstable.
5. **Execution gate**
   - No file edits until core + task-specific context is loaded.
   - In brainstorm/no-edit mode, do not mutate files.

## Output template (recommended)
```text
Startup summary
- Mode: <brainstorm/no-edit | implementation>
- Core docs loaded: <list>
- Task scope: <sql | routes/ui | pricing | docs | other>
- Task-specific docs/code loaded: <list>
- Web browse required: <yes/no and why>
- Edits currently blocked: <yes/no>
```
