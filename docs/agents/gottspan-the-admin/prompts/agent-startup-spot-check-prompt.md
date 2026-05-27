# Agent Startup Spot Check Prompt

Purpose: reusable prompt for checking whether an agent is starting from current repo-local instructions, staying inside its lane, and making decision-grade claims without forcing a full governance audit.

## Prompt

```text
Run an agent startup spot check before you continue.

This is a diagnostic check, not the main task. Keep it brief and evidence-backed.

Your goal is to prove that you are operating from current repo-local instructions, not stale conversation memory, and that your next action is inside your assigned lane.

## Required checks

1. Freshness
- Identify whether this is a new task/lane, a resumed context, post-commit/push/deploy work, or a continuous same-lane continuation.
- State whether a fresh bounded startup read is required under the repo startup contract.
- If required, perform the fresh bounded read before continuing.

2. Instruction sources
- List the root/core instructions you actually loaded for this task.
- List the scoped area instructions you loaded, if any.
- List your agent-specific contract, SOP, or default-load memory that you loaded, if any.
- Do not list historical artifacts, retained reports, archives, or old packets unless they were specifically required for this task.

3. Lane and authority
- State the lane you believe you own for this task.
- State what is out of scope.
- Identify the source of truth controlling the task.
- Say whether your conclusion or next action is decision-grade, partial, or not yet proven.

4. Drift check
- Identify one tempting adjacent task you should not pick up.
- State what would make your current understanding stale.
- State the smallest next proof or validation that would increase confidence.

## Response format

Return only this:

- **Mode:** brainstorm/no-edit or implementation.
- **Freshness:** fresh read required/performed, already fresh, or stale/blocked.
- **Loaded:** concise list of docs or files actually loaded.
- **Lane:** owned lane and out-of-scope boundary.
- **Authority:** source of truth and confidence level.
- **Next proof:** smallest useful validation or evidence check.
- **Drift guard:** adjacent work you will not pick up.

If you cannot prove the required instructions are current, stop and say what must be loaded before continuing.
```
