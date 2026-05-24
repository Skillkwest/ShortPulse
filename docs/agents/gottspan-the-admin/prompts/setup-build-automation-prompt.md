# Setup Build Automation Prompt

Purpose: reusable prompt for turning a build, cleanup, or repo-management task into a checkpointed execution loop with a clear stop condition, scope lock, and durable continuation path.

## Prompt

```text
Set up this task as a checkpointed build loop.

The goal is to keep working through checkpoints until the stop condition is met, while avoiding scope drift, vague continuation, or unfinished plans that only exist in chat.

The most important rule: do not drift. Every checkpoint and every continuation must prove that the next action is directly required by the stop condition.

If the task does not include enough information to define a verifiable stop condition, pause and ask for the missing scope instead of inventing it.

## First: define the stop condition

Before implementing anything, write a stop condition that another agent could verify without guessing.

The stop condition must state:

- what concrete outputs must exist,
- what validation or audit checks must pass,
- what handoffs must be created, delivered, re-audited, or explicitly marked blocked,
- what is out of scope,
- and when to stop instead of continuing.

Also write a short `scope lock`:

- the exact lane being worked,
- the files, folders, systems, or owners that are in scope,
- the files, folders, systems, or owners that are out of scope,
- and examples of tempting adjacent work that must not be picked up during this loop.

Do not continue because related work exists. Continue only when the next action is required to satisfy the stop condition or resolve a blocker found during checkpoint audit.

## Then: create checkpoints

Break the task into checkpoints. Each checkpoint should be small enough to finish and audit in one run.

For each checkpoint, define:

- goal,
- expected changed surfaces,
- validation to run,
- self-audit question,
- scope-lock check,
- decision rule: stop, continue, hand off, ask user, or mark blocked.

## Execute the loop

Run one checkpoint at a time.

At the end of each checkpoint:

1. validate the changed surfaces,
2. audit your own work,
3. compare the current state to the stop condition,
4. run the scope-lock check,
5. decide the next action,
6. update any durable tracker, handoff, or continuation note needed.

Do not start a new checkpoint until the current checkpoint is audited.

Do not add new scope at a checkpoint unless it is required for the stop condition. If a useful adjacent issue appears, record it as a separate follow-up or owner handoff. Do not execute it inside this loop.

If the next action is merely useful, nearby, convenient, or related, but not required by the stop condition, stop.

## Automation and continuation

Try to finish the next required checkpoint in the current run.

Create an automation, reminder, or durable continuation prompt only when:

- the stop condition is not met,
- the next checkpoint is clear,
- the work cannot or should not continue in the current run,
- and the user has authorized ongoing continuation or the environment has an approved automation mechanism.

The continuation prompt must include:

- the current checkpoint status,
- the stop condition,
- the scope lock,
- completed checkpoints,
- what remains,
- the exact next checkpoint to run,
- why that checkpoint is required by the stop condition,
- relevant file links,
- validation already run,
- known blockers or scope limits.

If automation is unavailable or inappropriate, write the continuation note in the correct repo-owned folder and tell the user the exact next prompt to run.

Any automation or continuation must begin by reloading the stop condition and scope lock before doing work. If the continuation cannot prove the next action is in scope, it must pause and ask instead of proceeding.

## Closeout

Close only when the stop condition is met or the task is blocked.

If complete, report:

- stop condition status,
- checkpoints completed,
- files changed,
- validations run,
- remaining risks or deferred work.

If blocked, report:

- why the stop condition cannot be met,
- the smallest unblocking action,
- the correct next owner.

## Rules

- Keep all work tied to the stop condition.
- Do not expand into adjacent cleanup or feature work unless required for completion.
- Each checkpoint must answer: "Is this action required to meet the stop condition?" If the answer is not clearly yes, do not do it.
- Continuation prompts must carry forward the scope lock unchanged unless the user explicitly changes scope.
- New discoveries become separate follow-ups or handoffs, not silent additions to the current loop.
- Do not create recurring automation when a durable continuation note or immediate next checkpoint is enough.
- Do not mark owner handoffs as dispatched unless they are placed in the owning agent's folder or delivered through another user-approved channel.
- Do not spawn helper agents to impersonate named agents.
- Respect repo branch, validation, security, and ownership rules.
- Preserve user or other-agent changes; do not revert unrelated work.

## Response structure

Return your work in this order:

1. Stop condition
2. Scope lock
3. Checkpoint plan
4. Current checkpoint execution
5. Self-audit, scope-lock check, and validation
6. Status against stop condition
7. Next checkpoint or continuation prompt, if needed
8. Closeout when complete or blocked
```
