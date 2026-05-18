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
- route-level browser smoke result when the run changed an interaction-heavy admin or frontend route

## Template

- `docs/records/artifacts/agent/gear-ball/reports/run-report-template.md`

## Reports

- `docs/records/artifacts/agent/gear-ball/reports/2026-05-18-production-panel-layout-and-character-library-run.md`: retained report for the production AI Studio panel-layout and character-library flow run, including the coupled panel/CSS/test-manifest lesson.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-18-production-create-workflow-diagnostics-and-billing-audit-run.md`: retained report for the production Create workflow diagnosis/runtime lane plus recurring billing diagnostics lane, including the tracked-temp drift cleanup lesson.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-18-production-project-foundation-and-prompt-bridge-run.md`: retained report for the production AI Studio project-foundation, prompt-bridge, and billing follow-up run, including the repeated inter-batch leftover cleanup chain.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-18-production-create-composer-and-voices-run.md`: retained report for the production create-composer/voices surface run, including the build-only `projectsService.ts` type regression caught before commit.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-17-production-create-workflow-and-ai-studio-run.md`: retained report for the production Create Workflow packet and AI Studio/runtime hardening run, including the manifest-miss lesson caught by the inter-batch leftover audit.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-16-production-ai-studio-runtime-and-packets-run.md`: retained report for the production AI Studio/runtime hardening run that also published the related agent packet refresh and Gear Ball closeout.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-13-self-audit-loop-first-full-run.md`: first end-to-end retained self-audit report after a full Gear Ball commit/push run.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-14-three-branch-promotion-run.md`: first retained report for a full SOP run promoted across `working-development`, `staging-preview`, and `production`.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-14-d-bug-handoff-stabilization-run.md`: retained report for the first full SOP run executed from a D-Bug handoff packet.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-15-auth-email-and-agent-scaffolding-run.md`: retained report for the mixed auth-email hardening and new-agent scaffolding run, including the branch-drift recovery lesson.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-15-production-prelaunch-batch-run.md`: retained report for the temporary prelaunch production run, including the new final leftover-audit rule.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-15-production-route-retirement-run.md`: retained report for the production Media Library retirement and Beeper audit expansion run.
- `docs/records/artifacts/agent/gear-ball/reports/2026-05-15-production-panel-media-and-agent-closeout-run.md`: retained report for the later production closeout that finalized panel media persistence and the Beeper/Bopper retained audit lane.
