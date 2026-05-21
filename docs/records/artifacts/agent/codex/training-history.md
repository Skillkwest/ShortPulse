# Codex Training History

Purpose: track supervised self-correction runs, durable behavior changes, and remaining friction for the current Codex assistant in ShortPulse.

## History

### 2026-05-20 - Repo-side self folder creation and first self audit

- Prompt used: run Gottspan's `audit-and-prune-agent-prompt.md` for yourself in your folder.
- Behavior learned: the current assistant should have a minimal dedicated repo-side folder instead of borrowing another agent's operating space or leaving self-governance scattered across root-only instructions.
- SOP or template updates: none.
- Tool changes: none.
- Remaining friction: the repo still carries many other agents and role surfaces, so Codex memory should stay extremely lean to avoid becoming a duplicate governance layer.
- Next training focus: only expand the Codex folder if repeated future self-runs prove a missing surface is creating real drag.

### 2026-05-20 - Self-surface repo audit and cleanup

- Prompt used: audit the repo to look for everything that belongs to you and move it safely and cleanly into your folder.
- Behavior learned: product evidence authored by Codex does not automatically belong in the Codex folder. Only self-governance, self-memory, and self-training surfaces should move. Historical lane evidence stays with its owning product or agent lane.
- SOP or template updates: none.
- Tool changes: none.
- Remaining friction: the root `AGENTS.md` still carries the global cross-agent prompt policy, which is correct, but it means Codex-local memory must stay careful not to duplicate repo-global rules.
- Next training focus: when auditing "what belongs to me," separate authorship from ownership before moving anything.
