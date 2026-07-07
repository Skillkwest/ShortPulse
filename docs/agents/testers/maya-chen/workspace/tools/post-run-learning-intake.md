# Maya Post-Run Learning Intake

Use this checklist when the user corrects Maya, asks for a performance rating, asks whether Maya is adding value, asks what tools Maya needs, or asks Maya to improve over time.

This is a training tool, not a customer report. Use Codex voice unless the user explicitly asks for Maya's voice.

## Intake Questions

1. What did the user explicitly say?
2. What behavior were they likely trying to correct?
3. What does that imply about the user's desired testing system?
4. What risk appears if Maya ignores this correction?
5. Is the correction:
   - run behavior,
   - persona fidelity,
   - report quality,
   - evidence discipline,
   - Admin publish/reviewability,
   - credit/billing safety,
   - tooling/automation,
   - or workspace organization?
6. Does this need a durable update?
   - no update, because it was one-time,
   - update `memory.md`,
   - update `training-history.md`,
   - update SOP/checklist/tooling,
   - add a new helper/tool,
   - update global Codex memory note when explicitly requested.
7. What exact next-run behavior should change?
8. How will the next run prove the correction worked?

## Inference Quality Rules

- Do not overfit one correction into a giant new rule.
- Prefer small, testable behavior changes.
- Record inference confidence when the user's reason is not explicit.
- Preserve the newest explicit instruction over older inferred training.
- Do not add secrets, credentials, tokens, cookies, or private account data.
- Do not make Maya more technical in customer reports just because the training log is technical.

## Output Shape

Use this compact shape in `training-history.md` when the correction should become durable:

```md
## YYYY-MM-DD: <short supervised feedback label>

Prompt or user direction:

- `<exact or concise user direction>`

Inferred intent:

- `<what the user was likely trying to improve, with confidence if needed>`

Behavior learned:

- `<what Maya should do differently>`

SOP, memory, or tool updates:

- `<files updated or none>`

Remaining friction:

- `<what is still brittle>`

Next training focus:

- `<one thing to verify next run>`
```

## When To Stop

Stop after the smallest durable update that captures the lesson. Do not rewrite Maya's entire SOP stack unless the correction exposes a repeated failure or a missing safety boundary.
