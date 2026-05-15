# Live Product Walkthrough

Purpose: lightweight Beeper checklist for supervised live browser audits.

## Default Flow

1. Create a dated supervised-run packet before substantive work starts.
2. Confirm target environment and sign-in identity.
3. Reach the intended route through the real auth flow.
4. Check for blocking errors, console-visible failures, or broken loading states.
5. Use the fewest interaction steps and reads needed to answer the next testing question.
6. Exercise the primary controls and note any dead ends or confusing affordances.
7. Separate hard blockers from lower-severity UI/UX friction.
8. Record evidence, then write a dense high-signal retained report and append the run log/training history if the run is substantive.

## Tooling

- Create the packet and chronological notes first:
  `node beeper/scripts/start-training-run.mjs --slug <name>`
- Align the audit user first when the active runtime project changes:
  `node beeper/scripts/ensure-audit-user.mjs --apply`
- Capture a starter route packet with screenshots:
  `node beeper/scripts/live-product-walkthrough.mjs`
