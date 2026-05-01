# Gear Ball Reports

Purpose: index durable evidence reports for Gear Ball worktree, commit, branch, environment, Vercel, database, release, and merge coordination tasks.

## Report Rules

- Keep reports concise, dated, and evidence-backed.
- Do not store secrets, raw customer data, access tokens, full env dumps, or large logs.
- Prefer links to canonical docs, commands run, validation outcomes, target branches, target environments, and residual risks.
- Use reports when a task needs more durable evidence than a short final response.

## Worktree Batch Report Template

Use this compact template for substantial worktree organization, commit, push, or PR handoff runs:

```markdown
# Gear Ball <task> Report - YYYY-MM-DD

Purpose: <one sentence describing the operational run>.

## Prompt Cadence

- <authorization gate 1>
- <authorization gate 2>
- <authorization gate 3>

## Batch Manifest

| Commit | Batch | Files/Scope | Risk Notes | Validation Evidence |
| --- | --- | --- | --- | --- |
| `<hash or pending>` | `<subject>` | `<paths/groups>` | `<risk>` | `<checks>` |

## Validation Results

- `<command>`: <pass/fail and exact summary>

## Failure Signals Found

- <failing file/test/signal, or "None">

## Fix Constraints

- <what was allowed>
- <what was deliberately not changed>

## Final State

- Branch:
- Allowed branch:
- Worktree:
- Remote/PR:

## Unverified Or Deferred

- <human review, CI, deploy, env, database, or merge gaps>
```

## Reports

- `docs/agents/gear-ball/reports/2026-05-01-agentic-github-operations-research.md`: source-backed synthesis for Gear Ball's GitHub PR, review, merge, and agent-governance workflow.
- `docs/agents/gear-ball/reports/2026-05-01-worktree-batch-commit-and-push.md`: evidence and lessons from Gear Ball's first full worktree batch, validation, commit, and push run.
