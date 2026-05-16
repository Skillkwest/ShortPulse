# Beeper Workspace

Purpose: give Beeper an owned workspace folder inside the repo for local checklists, scratch planning, and future lightweight tooling that should stay separate from product code.

## Intended Use

- keep tester-specific helpers separate from app source,
- stage lightweight checklists or templates before they become durable docs,
- avoid mixing Beeper scratch work with product implementation folders.

## Canonical Links

- Agent contract: `docs/agents/beeper/README.md`
- Repo-visible memory: `docs/agents/beeper/memory.md`
- Retained artifacts: `docs/records/artifacts/agent/beeper/`

## Trigger

- `run test` means begin a Beeper testing run.

## Current Contents

- `action-coverage/README.md`
- `checklists/live-product-walkthrough.md`
- `checkpoint-summaries/README.md`
- `next-run-queue.md`
- `route-success-map.md`
- `reports/README.md`
- `runs/README.md`
- `scripts/ensure-audit-user.mjs`
- `scripts/live-product-walkthrough.mjs`
- `scripts/start-checkpoint-report.mjs`
- `scripts/start-training-run.mjs`
- `templates/action-coverage-update-template.md`
- `templates/checkpoint-user-summary-template.md`
- `templates/live-audit-report-template.md`
- `templates/workflow-ux-audit-template.md`
- `templates/training-run-notes-template.md`

## Reporting Rule

- Beeper should keep thorough workflow/UI/UX reports inside `beeper/reports/` so the long-form analysis stays in Beeper's owned folder.
- Beeper should keep short user-facing checkpoint summaries inside `beeper/checkpoint-summaries/` so the user can scan each checkpoint quickly and correct Beeper during training.
- Beeper should only keep trainer-facing checkpoint summaries there for real product checkpoints, not process-only hardening work.
- Beeper should keep a durable route/control/action history inside `beeper/action-coverage/` so each new run can target different product actions over time.
- Beeper should keep one defined normal-user success target per major route in `beeper/route-success-map.md` so coverage claims are tied to believable outcomes instead of just clicks.
- Beeper should use `beeper/next-run-queue.md` to keep the highest-value next testing lanes visible and reduce lane-selection churn.
- Retained docs under `docs/records/artifacts/agent/beeper/` remain the compact durable ledger, while `beeper/reports/` can hold the denser working audit write-up.
- Beeper should keep open retest debt in `docs/records/artifacts/agent/beeper/retest-debt.md` so issue follow-up stays visible after the first handoff.
- Any real issue or error that needs engineering follow-up should also produce a D-Bug handoff in `docs/records/artifacts/agent/d-bug/handoffs/`.
- On dense desktop surfaces, Beeper should keep the browser wide enough that the primary controls are fully visible before scoring layout or UX; clipped captures are correction material, not final evidence.
- Route-bundle runs should be preferred over fragmented micro-checkpoints when the next adjacent action is still on the same surface and adds real evidence.

## Commands

- Check or align Beeper's dedicated audit user against the active runtime project:
  `node beeper/scripts/ensure-audit-user.mjs --apply`
- Align the production audit user explicitly:
  `node beeper/scripts/ensure-audit-user.mjs --environment production --apply`
- Create a dated supervised-run packet before substantive training work:
  `node beeper/scripts/start-training-run.mjs --slug <name>`
- Create a kept detailed checkpoint report during testing:
  `node beeper/scripts/start-checkpoint-report.mjs --slug <name> --environment production --workflow <lane>`
- Run the starter signed-in route walkthrough:
  `node beeper/scripts/live-product-walkthrough.mjs`
