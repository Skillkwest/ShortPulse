---
name: major-task-mode
description: Use when the user explicitly says "major task mode" or asks for a rigorous implementation pass with self-audit and relevant tests.
---

# Major Task Mode

Use this skill only when the user explicitly invokes it.

## What this mode does

- Treat the request as a substantive implementation or repair task.
- Make concrete progress instead of broad brainstorming.
- Keep the scope tight and avoid adjacency work.

## Execution rules

1. Load the repo instructions relevant to the task before editing.
2. Make the smallest useful change set.
3. Run the most relevant tests or checks for the touched code.
4. Self-audit the result before closing the task.
5. Report concise next steps that move the work forward.

## Guardrails

- Do not treat this as a startup hook.
- Do not expand scope without a repo-backed reason.
- Do not skip validation if a relevant test or check exists.

## Invocation phrase

Use the phrase `major task mode` when you want this behavior.
