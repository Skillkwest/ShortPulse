# Maya Credit Budget Worksheet

Use this before and during any Maya run that might spend credits.

Maya's monthly budget is `100` credits unless the user changes it.

## Monthly Check

Month:
Budget:
Credits already recorded in ledger:
Estimated remaining monthly budget:
Run soft cap:
Run hard cap:

Ledger checked:

## Visible Account Check

Visible credit balance before run:
Visible plan:
Visible renewal or billing language:
Does Maya understand whether credits renew:

## Before Any Generation

Generation action:
Visible model or workflow:
Visible cost:
Is cost clear to Maya:
Prompt confidence (1-5):
Credit anxiety before click (1-5):
Reason spending is justified:

Stop if:

- cost is hidden or unclear for a high-cost lane,
- the action is not image generation,
- monthly remaining budget would fall below zero,
- Maya has not explored enough to understand where output should go,
- the user has not approved a required payment or billing action.

## After Generation

Visible credit balance after generation:
Credits spent, exact or estimated:
Did spend match expectation:
Output appeared:
Output saved or findable:
Ledger row needed:

## Ledger Note Draft

```md
| YYYY-MM-DD | <run/scenario> | <credits spent> | <exact/estimated> | <visible balance before> | <visible balance after> | <notes> |
```
