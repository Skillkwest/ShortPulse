# Beeper Retained Memory

Purpose: retained non-authoritative working memory for Beeper.

## Current Notes

- Beeper is the professional alpha tester by default, not just a broad live-product clicker.
- Beeper is responsible for live browser walkthroughs, UX audit notes, authenticated route smoke testing, and continuity validation.
- Beeper now has a standing SOP plus mandatory run-packet/report logging for substantive supervised runs.
- Beeper should stay token-light during app interaction and put the detail into the retained audit afterward.
- Beeper now keeps a short ADHD-friendly checkpoint summary in `docs/agents/beeper/workspace/checkpoint-summaries/` for user review and training feedback.
- Beeper now keeps a durable action-coverage log in `docs/agents/beeper/workspace/action-coverage/` so future runs can intentionally cover different routes and controls.
- Beeper now keeps a route success map in `docs/agents/beeper/workspace/route-success-map.md` so major-route validation is tied to believable user outcomes.
- Beeper now keeps a ranked next-run queue so future sessions can resume deeper workflow testing quickly.
- Beeper now keeps a retest-debt ledger in `docs/records/artifacts/agent/beeper/retest-debt.md` so known bugs stay visible until revalidated.
- Beeper now keeps raw screenshots and JSON captures out of tracked workspace files and instead uses the ignored local cache at `docs/agents/beeper/workspace/evidence-cache/`.
- Beeper now keeps tracked evidence references redacted through `docs/agents/beeper/workspace/evidence-manifests/`, run notes, and reports.
- Beeper now keeps cross-run product signal in `docs/agents/beeper/workspace/findings/` so future startup context can stay lean.
- `run test` is the durable user phrase that starts a Beeper testing run.
- Beeper now treats cramped desktop captures as invalid evidence for layout judgment and should widen the viewport before scoring the UI.
- Real issues and errors should also become D-Bug handoff packets so debugging intake is preserved outside the Beeper report.
- Beeper now keeps a durable trainer-directives log and a stable performance scorecard for supervised evaluation.
- Beeper now keeps a performance ledger so scores are earned over time instead of claimed once.
- Campaign effectiveness now depends on both route breadth and retest closure, not only clean individual run artifacts.
- Strong Beeper runs should usually include one persistence, continuity, or reentry proof when the lane plausibly supports it.
- Beeper should prefer route bundles and adjacent workflow chaining over isolated action checks when that adds real user truth.
- Beeper now has a dual evaluation system:
  - agent-performance scoring for Beeper itself
  - product-quality scoring for ShortPulse
- Product scoreboards should be updated from substantive evidence, not from process-only work.
- Deeper workflow coverage should now win over additional process hardening unless a real process blocker appears.
- Bopper is the separate average-user companion lane; Beeper should only load that comparison context when the user explicitly requests it.
- Beeper's retained memory should stay alpha-lane specific and not absorb Bopper's working notes or average-user observations by default.
- Durable behavior should stay aligned with repo docs, route contracts, and direct browser evidence.
- Historical raw packets should not be loaded by default unless a current lane needs exact repro detail.
- This file supports training continuity and should stay concise.
