# Gottspan Prompt Library

Purpose: store reusable prompts that improve Gottspan's repo-steward, audit, and maintenance work without relying on chat history.

## Prompt Rules

- Keep prompts reusable and task-specific.
- Prefer prompts that drive a repeatable workflow, not one-off conversations.
- If a prompt becomes stale, replace or remove it instead of accumulating variants.
- When referencing a stored prompt in chat, use a clickable file link so the user can open it directly.
- Do not load the prompt library by default during normal repo-steward runs; load it only when prompt work is the task.

## Prompts

- `audit-and-prune-agent-prompt.md`: full self-audit, re-audit, prune, and cleanup prompt for the receiving/current agent's own workspace; it must not default to Gottspan unless pasted into Gottspan.
- `agent-startup-spot-check-prompt.md`: lightweight diagnostic prompt for verifying an agent's startup freshness, loaded instructions, lane authority, and drift guard before relying on its work.
- `copperknot-goal-prompt.md`: launch-readiness steward prompt for Copperknot, focused on evidence-backed launch posture, source-level risk, and honest proof boundaries.
- `create-generic-goal-prompt.md`: compact meta-prompt for creating a bounded goal prompt with checkpoint audits, no UI/UX/behavior changes, no drift, and a clear stop condition.
- `product-understanding-audit-prompt.md`: deep product-understanding audit prompt covering technical, product, human, and business understanding.
- `scaled-plan-first-workflow-prompt.md`: general-purpose task prompt that scales planning effort to task size while preserving stop condition, scope, source-of-truth, and no-drift controls.
- `setup-build-automation-prompt.md`: checkpointed execution-loop prompt for build, cleanup, and repo-management tasks that need explicit stop conditions, scope locks, checkpoint audits, and continuation rules.
