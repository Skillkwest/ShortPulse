# Maya Run Control Panel

Use this as the compact control panel during a live Maya run. It does not replace the SOPs; it keeps the active run from turning into paperwork.

## Before Chrome

Fill these in before opening the product:

```md
Run slug:
Scenario:
Tiny Apartment Reset Kit ladder step:
Human nuance focus:
Baseline comparison needed: <yes / no>
Allowed spend this run:
Hard stop condition:
Admin publish available: <yes / no / unknown>
```

## Live Run Spine

Keep the browser session on this rhythm:

1. Start from a customer-visible surface in a fresh real Chrome window.
2. Write Maya's first visible observation.
3. Ask Maya's current question.
4. Take the most natural visible action.
5. Record the confidence change and any taste/social-stakes/trust shift.
6. Repeat until the scenario is complete, blocked, or the timebox reaches the closeout window.

Do not open repo files, inspect hidden state, call APIs, or diagnose code while the live customer journey is in progress.

## Timebox

Default target: `45` minutes.

Recommended rhythm:

| Window    | Focus                                                                              |
| --------- | ---------------------------------------------------------------------------------- |
| 0-5 min   | Load SOPs, ledger, UGC goal, human nuance card, run control panel, and state card. |
| 5-15 min  | Orient Maya in Chrome and build the immediate mental map.                          |
| 15-30 min | Attempt the chosen project step.                                                   |
| 30-40 min | Verify saved-work, credit, output, or recovery state.                              |
| 40-45 min | Stop clicking and preserve notes for reports.                                      |

If the run blocks early, stop early and report the blocker. Do not click aimlessly to fill time.

## Status Decision

Use one status for the run:

- `completed`: Browser scenario completed, local reports are written, required ledgers/indexes/self-score are updated, required low-score corrections are named, and Admin publish either succeeded or was not required/available and is documented.
- `partial`: Browser scenario mostly completed, but a required verification, report step, Admin publish attempt, or self-score step remains incomplete.
- `blocked`: Maya cannot safely continue because of auth, payment, budget, Chrome control, production access, or owner approval.
- `failed`: The run violated SOP enough that its findings are unreliable.

## Admin Publish Semantics

Admin publishing is a post-run operator step:

- If the ingest secret is available, attempt publish and verify the row in `/admin/tester-reports`.
- If ingest succeeds but Admin tab verification is unavailable, record `ingest succeeded; Admin tab verification unproven`.
- If the ingest secret is missing, local reports can still be complete. Record `not published - ingest secret unavailable` in both reports, the report index, and the self-audit.

## Final Gate

Before saying the run is done, confirm:

- Maya report written.
- Engineering handoff written.
- Behavior metrics filled with measured values or `not measured`.
- Credit ledger updated if credits were checked or spent.
- Reports index updated.
- Admin publish status recorded.
- Self-audit/performance check completed.
- Baseline comparison completed or marked not needed.
- Post-run coach question answered.
- Any score below `7` has a specific next-run correction.
- Self-score ledger row added.
- Workspace memory/training history updated only if durable behavior changed.
