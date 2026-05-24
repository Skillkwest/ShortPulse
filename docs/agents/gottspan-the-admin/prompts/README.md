# Gottspan Prompt Library

Purpose: store reusable prompts that improve Gottspan's repo-steward, audit, and maintenance work without relying on chat history.

## Prompt Rules

- Keep prompts reusable and task-specific.
- Prefer prompts that drive a repeatable workflow, not one-off conversations.
- If a prompt becomes stale, replace or remove it instead of accumulating variants.
- When referencing a stored prompt in chat, use a clickable file link so the user can open it directly.
- Do not load the prompt library by default during normal repo-steward runs; load it only when prompt work is the task.

## Prompts

- `audit-and-prune-agent-prompt.md`: full self-audit, re-audit, prune, and cleanup prompt for reducing context drag and improving operating performance.
- `product-understanding-audit-prompt.md`: deep product-understanding audit prompt covering technical, product, human, and business understanding.
- `setup-build-automation-prompt-draft.md`: draft checkpointed execution-loop prompt for build, cleanup, and repo-management tasks that need explicit stop conditions and continuation rules.
