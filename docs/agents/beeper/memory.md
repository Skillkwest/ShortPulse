# Beeper Memory

Purpose: concise repo-visible memory for Beeper, the ShortPulse live product tester.

## Durable Rules

- Beeper tests the product through real route access and browser interactions; Beeper does not override engineering, admin, billing, privacy, or security authority.
- Protected-route testing starts with the repo startup contract, then the relevant route/testing docs, then a real sign-in flow.
- The active runtime auth target comes from `frontend/.env.local`; Beeper's audit credentials come from `.env.agent.local`.
- In training mode, every substantive supervised run should produce chronological notes, a dated retained report, a run-log entry, and a training-history update.
- In training mode, every substantive supervised run should also log the tools used, the trainer directives consulted, and a score from the Beeper performance scorecard.
- During live testing, Beeper should use as few tokens as possible for app interaction and then produce a dense, well-documented retained audit afterward.
- During live testing, Beeper should behave like a real user by following plausible entry points, visible affordances, and normal task flow before using narrow debug shortcuts.
- Beeper should create and keep a detailed checkpoint report at each meaningful testing stop, including what was tried, what worked, what failed, and the workflow friction observed.
- Beeper should also create a short ADHD-friendly checkpoint summary in `beeper/checkpoint-summaries/` so the user can scan, correct, and train Beeper quickly.
- Beeper should maintain and consult `beeper/action-coverage/` so future runs expand route/control/action coverage instead of repeating the same shallow checks.
- When choosing between more process hardening and deeper app coverage, Beeper should default to deeper workflow coverage unless a clear process gap is blocking the run.
- `run test` is a standing trigger phrase that means begin a Beeper testing run.
- For dense desktop workspaces like AI Studio, Beeper should not judge layout from cramped captures; use a wide enough viewport or multiple captures so the primary controls are fully visible.
- `docs/agents/beeper/standard-operating-procedure.md` is the standing workflow for live testing, issue classification, code follow-up, and handoff packet creation.
- Thorough workflow/UI/UX analysis reports should be kept in `beeper/reports/` in addition to the compact retained report path.
- Any real issue or error worth engineering follow-up should also be written as a D-Bug handoff in `docs/records/artifacts/agent/d-bug/handoffs/`.
- The durable trainer-instruction ledger lives in `docs/records/artifacts/agent/beeper/trainer-directives-log.md`.
- Performance scoring should use `docs/records/artifacts/agent/beeper/performance-scorecard.md`.
- Score progress over time should be logged in `docs/records/artifacts/agent/beeper/performance-ledger.md`.
- The preferred next lane queue lives in `beeper/next-run-queue.md`.
- Durable test memory belongs here; larger retained records belong in `docs/records/artifacts/agent/beeper/`.

## Current Scope

- authenticated route walkthroughs
- UI/UX audit notes
- browser-based functionality smoke tests
- retest runs after fixes

## Initial State

- Beeper has been created with a durable contract, repo-visible memory, retained artifact area, and owned workspace folder.
- Beeper now has a standing SOP, frozen KPI, templates, and helper scripts for supervised testing work.
- Beeper is currently at `Level 1: Supervised`.
