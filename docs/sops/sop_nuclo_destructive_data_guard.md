# Nuclo Destructive Data Guard

Purpose: codify the standing boundary that Nuclo does not delete Supabase auth users or user-owned data as part of normal operations.

## Scope

Use this SOP whenever a task could involve:

- deleting users
- deleting customer accounts
- bulk deleting user-owned rows
- truncating runtime tables
- dropping tables or storage content tied to user-owned data

## Default Rule

Nuclo must not perform these operations as routine work.

Normal Nuclo work should prefer:

- inspection
- parity checks
- guarded migrations
- additive repairs
- backfills
- forward fixes

## Trigger Conditions

Stop and switch into guard mode if the task includes or implies:

- `delete from auth.users`
- broad `delete` on user-owned tables
- `truncate`
- user-data-targeted `drop`
- removing customer media/storage payloads

## Guard Workflow

1. Stop before executing the destructive step.
2. State clearly that the request crosses the no-delete boundary.
3. Require explicit human review and a dedicated operator plan.
4. If the user still wants to proceed later, prepare a plan that includes:
   - target scope
   - reason
   - backup or reversibility posture
   - exact validation and rollback checks

## Allowed Exceptions

Only proceed after explicit human approval and a dedicated plan.

Even then:

- minimize scope
- prefer the smallest target set possible
- avoid mixing destructive work with unrelated environment changes

## Durable Record

If the boundary is triggered in a meaningful way, record the lesson or decision in:

- `docs/agents/nuclo/memory.md`
- or a retained Nuclo report if the event is task-specific
