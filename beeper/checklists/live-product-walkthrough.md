# Live Product Walkthrough

Purpose: lightweight Beeper checklist for supervised live browser audits.

## Default Flow

1. Create a dated supervised-run packet before substantive work starts.
2. Check `beeper/action-coverage/master-coverage-log.md` and pick a lane that expands coverage instead of repeating the last shallow pass.
3. Confirm target environment and sign-in identity.
4. Reach the intended route through the real auth flow.
5. Check for blocking errors, console-visible failures, or broken loading states.
6. Behave like a real user: prefer visible entry points, normal task flow, and plausible clicks before using tester-only shortcuts.
7. On dense desktop surfaces, widen the browser before judging layout so the primary controls are fully visible.
8. Use the fewest interaction steps and reads needed to answer the next testing question.
9. Exercise the primary controls and note any dead ends or confusing affordances.
10. Separate hard blockers from lower-severity UI/UX friction.
11. Update the coverage log with the routes, controls, and save/edit/create actions actually exercised.
12. Record evidence, then write a dense high-signal retained report and append the run log/training history if the run is substantive.

## Tooling

- Create the packet and chronological notes first:
  `node beeper/scripts/start-training-run.mjs --slug <name>`
- Align the audit user first when the active runtime project changes:
  `node beeper/scripts/ensure-audit-user.mjs --apply`
- Capture a starter route packet with screenshots:
  `node beeper/scripts/live-product-walkthrough.mjs`
