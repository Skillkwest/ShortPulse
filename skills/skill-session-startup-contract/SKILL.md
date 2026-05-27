---
name: skill-session-startup-contract
description: Enforce the mandatory session startup contract for every new task/session in ShortPulse before making edits.
---

# Session Startup Contract

Purpose: enforce consistent startup behavior in every new task/session so context is loaded before execution and edits.

Prior conversation context is advisory; current repo-local instructions are authority. Keep startup fresh enough to prevent drift and bounded enough to protect the context window.

## When to use
- At the start of every new task/session in this repo.
- At the start of a new lane within an existing session.
- After commit, push, or deploy.
- After context resume or compaction.
- When instruction freshness is uncertain.
- When asked what instructions are active.
- When relevant instruction files changed.
- Before launch-relevant delegated-authority claims.

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
   - Treat prior context as advisory until this task/lane has a fresh bounded startup read.
2. **Core docs**
   - Load the root + docs core references listed above.
   - Load only the scoped AGENTS files for touched directories.
   - For named-agent work, load the active agent's contract, local AGENTS/SOP if present, and explicitly marked default-load memory.
   - Do not bulk-load historical artifacts, retained reports, training logs, archives, or old packets unless the task or default-load policy requires them.
3. **Task routing**
   - SQL/migrations: load SQL SOP + migration + security docs and touched migration files.
   - Routes/UI behavior: load route map + relevant SOPs + top-level `README.md`.
   - Pricing/credits: run `skills/skill-pricing-audit/SKILL.md`.
   - Pricing display/debit wiring: also run `skills/skill-pricing-wiring/SKILL.md`.
   - New agent creation/training/maintenance: load `agent-teaching/README.md`, the referenced foundation/setup/operations docs, and the relevant prompts.
   - System inventory/rating/workflow-boundary work: load `docs/systems/README.md`, `docs/systems/catalog.md`, `docs/systems/rating-rubric.md`, plus the relevant product/route/operator docs.
   - Docs/index drift: run `skills/skill-doc-index/SKILL.md` or `skills/skill-mvp-docs-sop-governance/SKILL.md`.
   - Audit/inspection/online research: run `skills/skill-subagent-audit-research/SKILL.md`.
4. **Web browsing decision**
   - Use local repo sources by default.
   - Browse only when requested, when recency matters, or when facts are high-stakes/unstable.
5. **Execution gate**
   - No file edits until core + task-specific context is loaded.
   - In brainstorm/no-edit mode, do not mutate files.
   - For continuous same-lane work, already-fresh loaded instructions may be reused unless relevant instruction files changed.

## Priority Rule
- If this helper ever disagrees with `AGENTS.md`, follow `AGENTS.md` and treat this helper as stale until it is updated.

## Output template (recommended)
```text
Startup summary
- Mode: <brainstorm/no-edit | implementation>
- Core docs loaded: <list>
- Task scope: <sql | routes/ui | pricing | agent-training | systems | audit/research | docs | other>
- Task-specific docs/code loaded: <list>
- Web browse required: <yes/no and why>
- Edits currently blocked: <yes/no>
```
