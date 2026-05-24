# Beeper Action Coverage

Purpose: keep a durable history of which routes, controls, and real-user actions Beeper has already exercised so future runs can cover different parts of the app over time.

## Rules

- Review the master coverage log before choosing the next test lane.
- Update the log after each meaningful checkpoint.
- Distinguish between:
  - `opened`: route or surface was reached
  - `clicked`: one or more visible controls were exercised
  - `partial`: some meaningful action happened, but not a full create/edit/save style loop
  - `validated`: a real user workflow was completed end-to-end with confidence
- Keep notes factual. Do not overstate coverage depth.
- Link the checkpoint summary, retained report, full Beeper report, run packet, and handoff when useful.

## Index

- `docs/agents/beeper/workspace/action-coverage/master-coverage-log.md`
