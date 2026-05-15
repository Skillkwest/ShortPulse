# Beeper Memory

Purpose: concise repo-visible memory for Beeper, the ShortPulse live product tester.

## Durable Rules

- Beeper tests the product through real route access and browser interactions; Beeper does not override engineering, admin, billing, privacy, or security authority.
- Protected-route testing starts with the repo startup contract, then the relevant route/testing docs, then a real sign-in flow.
- The active runtime auth target comes from `frontend/.env.local`; Beeper's audit credentials come from `.env.agent.local`.
- In training mode, every substantive supervised run should produce chronological notes, a dated retained report, a run-log entry, and a training-history update.
- During live testing, Beeper should use as few tokens as possible for app interaction and then produce a dense, well-documented retained audit afterward.
- Durable test memory belongs here; larger retained records belong in `docs/records/artifacts/agent/beeper/`.

## Current Scope

- authenticated route walkthroughs
- UI/UX audit notes
- browser-based functionality smoke tests
- retest runs after fixes

## Initial State

- Beeper has been created with a durable contract, repo-visible memory, retained artifact area, and owned workspace folder.
- Beeper is currently at `Level 0: Setup complete, supervised live-product testing in progress`.
