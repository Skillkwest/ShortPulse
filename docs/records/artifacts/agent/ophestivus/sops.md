# Ophestivus SOP Index

Purpose: quick lookup for the SOPs Ophestivus uses when working the admin error and board workflow.

## Primary SOPs

| SOP                                                     | Use when                                                                                                       | Trigger phrases                                                                    |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `docs/sops/sop_admin_error_to_ophestivus_resolution.md` | Intake an Admin Errors issue, create or select a board ticket, resolve it, validate it, and move it to Review. | `run SOP`, `run error SOP`, `run error check SOP`, `error grab SOP`                |
| `docs/sops/sop_admin_ophestivus_review_to_complete.md`  | Audit tickets in Review, append approval notes, and move approved work to Complete.                            | `run review SOP`, `review board`, `audit review tickets`, `approve review tickets` |
| `docs/sops/sop_admin_ophestivus_complete_regression_audit.md` | Lightly audit one aged Complete ticket for post-completion regression evidence.                                | `run check complete SOP`, `run complete regression audit`, `audit complete column` |
| `docs/sops/sop_admin_ophestivus_board_operations.md`    | Understand shared board state, columns, helper commands, and board guardrails.                                 | `board operations`, `kanban workflow`                                              |
| `docs/sops/sop_sql_migration_operations.md`             | Work requires SQL migration, schema repair, hosted Supabase validation, or migration approval.                 | `SQL`, `migration`, `schema`, `Supabase`                                           |

## Default Order

1. Check `Backlog` first through `ophestivus:intake`.
2. If no backlog ticket exists, intake the next Admin Errors incident.
3. Move selected work to `In progress` before active resolution.
4. Validate the real issue, recurrence state, and touched code/data.
5. Move resolved work to `Review`, not `Complete`.
6. Use the Review SOP to approve Review tickets into `Complete`.
7. Leave `Published` human-controlled unless the user explicitly says otherwise.
8. Run mutating helper commands with `--dry-run` first when supported, unless the user explicitly says to execute immediately.

## Maintenance SOP

The Complete Regression Audit SOP is separate from the default error workflow. Run it only when explicitly triggered, such as `run check complete SOP`. It audits one aged `Complete` item, leaves the original completed ticket historical, and creates new work only when regression evidence exists.

## Escalation

Use the Human Review path when the work is blocked by credentials, human approval, product intent, risky data/schema changes, provider access, or broad multi-lane investigation Ophestivus cannot reliably handle as one working agent.

Do not use `Human Review` as a Review-ready residual risk classification. Review-ready classifications are `Accepted`, `Monitor`, and `Follow-up`.

Required title prefix:

```text
[HUMAN REVIEW] <plain issue title>
```

Required banner:

```text
*** HUMAN REVIEW REQUIRED ***
```
