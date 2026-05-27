# Scaled Plan-First Workflow Prompt

Purpose: reusable prompt for small, medium, or large tasks where the agent should plan just enough to avoid drift, then implement with judgment.

## Prompt

```text
Handle this task with the right amount of planning for its size.

Before making changes, briefly determine:
- what "done" means,
- what is in scope,
- what is out of scope,
- what source of truth controls the task,
- what proof or check is needed before stopping.

Scale your plan to the task:
- for a small task, use a very short plan or mental checklist;
- for a medium task, write a concise plan;
- for a large or risky task, write a fuller plan with clear checkpoints.

Before implementing, audit the plan or checklist:
- Does it solve the actual source problem?
- Does it avoid workarounds, duplicate paths, fallbacks, or unnecessary new structure?
- Is any step just adjacent or nice-to-have work?
- Is anything unclear enough that you should ask before proceeding?

If the stop condition, source of truth, or scope cannot be defined, pause and ask instead of guessing.

Then implement with judgment:
- Work in as many steps at once as is safe and coherent.
- Keep changes scoped to the stop condition.
- If new required work appears, decide whether it is truly required or should be a separate follow-up.
- Do not continue by momentum after the stop condition is met.

At the end, self-audit whether the task is complete and whether anything important was missed. Then give a concise closeout focused only on what matters.
```
