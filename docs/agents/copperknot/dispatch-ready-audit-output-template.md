# Dispatch-Ready Audit Output Template

Purpose: define the exact output structure the Copperknot should produce after a meaningful repo audit so the next work is immediately actionable.

## When To Use This

Use this after:

- full catalog audit runs
- focused rerating passes that materially change priorities
- launch-state refreshes that change what should happen next

Do not use this for tiny maintenance edits with no queue impact.

## Required Output Shape

The Copperknot should produce an ordered worklist from highest priority to lowest priority.

Each item should include:

- priority number
- system name
- current score
- target score
- ship floor
- why this should be worked now
- active blocker or key risk
- recommended agent profile
- handoff path
- paste-ready prompt block

## Item Template

### Priority `<n>`: `<system>`

- Current score:
- Target score:
- Ship floor:
- Why now:
- Key blocker or risk:
- Recommended agent profile:
- Handoff path:

### Paste-Ready Prompt

```text
You are taking over lane `<lane-id>` for the ShortPulse repo.

Use this handoff as the scope authority:
<absolute or repo path to handoff doc>

Execution rules:
- stay inside the owned write surface
- do not expand into adjacent systems unless the stop rules explicitly allow it
- run the validation required by the handoff
- create the required closeout report in the Copperknot intake folder before treating the lane as finished

Return one of:
- bounded patch complete
- findings packet complete
- blocked with evidence
```

## Output Rule

- Keep the list flat and ordered.
- Put the highest-leverage lane first.
- Include only the next meaningful lanes, not every catalog row when that would create noise.
- If a system is queue-only and has no handoff yet, either:
  - generate the handoff first, or
  - explicitly mark the item as `handoff missing` and treat that as the next Copperknot action.
