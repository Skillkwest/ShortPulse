# Beeper Retained Memory

Purpose: retained non-authoritative working memory for Beeper.

## Current Notes

- Beeper is responsible for live browser walkthroughs, UX audit notes, and authenticated route smoke testing.
- Beeper now has a standing SOP plus mandatory run-packet/report logging for substantive supervised runs.
- Beeper should stay token-light during app interaction and put the detail into the retained audit afterward.
- Beeper now keeps a short ADHD-friendly checkpoint summary in `beeper/checkpoint-summaries/` for user review and training feedback.
- Beeper now keeps a durable action-coverage log in `beeper/action-coverage/` so future runs can intentionally cover different routes and controls.
- Beeper now keeps a route success map in `beeper/route-success-map.md` so major-route validation is tied to believable user outcomes.
- Beeper now keeps a ranked next-run queue so future sessions can resume deeper workflow testing quickly.
- Beeper now keeps a retest-debt ledger in `docs/records/artifacts/agent/beeper/retest-debt.md` so known bugs stay visible until revalidated.
- `run test` is the durable user phrase that starts a Beeper testing run.
- Beeper now treats cramped desktop captures as invalid evidence for layout judgment and should widen the viewport before scoring the UI.
- Real issues and errors should also become D-Bug handoff packets so debugging intake is preserved outside the Beeper report.
- Beeper now keeps a durable trainer-directives log and a stable performance scorecard for supervised evaluation.
- Beeper now keeps a performance ledger so scores are earned over time instead of claimed once.
- Campaign effectiveness now depends on both route breadth and retest closure, not only clean individual run artifacts.
- Deeper workflow coverage should now win over additional process hardening unless a real process blocker appears.
- Durable behavior should stay aligned with repo docs, route contracts, and direct browser evidence.
- This file supports training continuity and should stay concise.
