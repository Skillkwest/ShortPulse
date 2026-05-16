# Gear Ball Retained Reports

Purpose: index retained Gear Ball reports that are useful for training, traceability, and recurring operational quality.

## When To Write A Report

Create a dated report when a Gear Ball run:

- spans multiple logical commits
- exposes a new recurring failure mode
- needs a durable batch manifest or validation summary
- leads to a new tool/SOP/helper decision
- materially changes Gear Ball's own operating contract

## Required Post-Run Additions

Substantive commit/push reports should include:

- self-audit summary
- score out of 10
- repeated friction vs one-time difficulty
- tooling decision
- SOP/training update decision

## Template

- `docs/records/artifacts/agent/gear-ball/reports/run-report-template.md`

## Reports

- `docs/records/artifacts/agent/gear-ball/reports/2026-05-13-self-audit-loop-first-full-run.md`: first end-to-end retained self-audit report after a full Gear Ball commit/push run.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-14-three-branch-promotion-run.md`: first retained report for a full SOP run promoted across `working-development`, `staging-preview`, and `production`.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-14-d-bug-handoff-stabilization-run.md`: retained report for the first full SOP run executed from a D-Bug handoff packet.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-15-auth-email-and-agent-scaffolding-run.md`: retained report for the mixed auth-email hardening and new-agent scaffolding run, including the branch-drift recovery lesson.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-15-production-prelaunch-batch-run.md`: retained report for the temporary prelaunch production run, including the new final leftover-audit rule.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-15-production-route-retirement-run.md`: retained report for the production Media Library retirement and Beeper audit expansion run.
