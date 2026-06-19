# Gear Ball Prompt Library

Purpose: store reusable Gear Ball-owned prompts that should live with Gear Ball instead of another agent's workspace.

## Prompt Rules

- Keep prompts small, durable, and tied to a real Gear Ball workflow.
- Store Gear Ball prompts under this folder, not under Gottspan's prompt library.
- When the user asks for a saved prompt in chat, return it as a clickable file link.
- Do not load this folder by default during normal SOP runs; load it only when prompt work is the task or when the user calls a stored prompt by name.

## Prompts

- `audit-and-prune-current-agent.md`: Gear Ball-owned self-audit and pruning prompt for Gear Ball's own workspace.
- `trim-prompt.md`: stored trim prompt for Gear Ball's own workspace only.
