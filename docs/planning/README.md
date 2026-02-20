# Planning Docs

Purpose: active planning artifacts and current execution backlogs.

## Contents
- `backlog.md`: active and upcoming work.
- `documentation-audit-2026-02-17.md`: documentation governance audit artifact (classification matrix, contradiction method, backlog evidence matrix).
- `audit-progress.md`: automation/docs audit status.
- `mvp-pretester-full-audit-remediation-plan.md`: full-app audit remediation runbook for pre-tester release hardening.
- `mvp-ui-ux-stabilization-remediation-plan.md`: standalone UI/UX stabilization and remediation runbook for pre-tester quality hardening.
- `mvp-ui-ux-sprint-ticket-breakdown.md`: sprint-ready ticket register (one ticket per UI/UX remediation checklist item, with owner and estimate).
- `mvp-ui-ux-issue-board.md`: owner-assigned execution board with ticket status, reviewer, and acceptance evidence.
- `mvp-ui-ux-phase0-baseline-qa-checklist.md`: runbook checklist for UX-0 baseline capture and keyboard/accessibility verification.
- `mvp-ui-ux-phase0-baseline-capture-template.md`: fill-in template for per-route baseline evidence and sign-off.
- `mvp-ui-ux-phase0-baseline-report-2026-02-14-full.md`: full UX-0 baseline report for all priority routes plus first-pass keyboard baseline.
- `ai-studio-generation-runtime-v2-locked-execution.md`: authoritative locked execution plan for server-authoritative runtime v2.
- `ai-studio-generation-runtime-audit-2026-02-20.md`: repo audit findings and implementation deltas for runtime v2.
- `ai-studio-runtime-v2-recovery-execution-phase.md`: shared recovery execution phase tracker (webhook inbox, verify cutover, reconciler leases, guarded transitions).
- `ai-studio-runtime-v2-staging-execution-checklist.md`: operator checklist with ordered staging migration/env/deploy/smoke-test commands and runtime gates.
- `ai-studio-fal-reliability-rollout.md`: archived pointer to superseded planning doc (full archive under `docs/archive/planning/`).
- `ai-studio-generation-runtime-stabilization.md`: archived pointer to superseded planning doc (full archive under `docs/archive/planning/`).
- `ai-studio-agent-tooling-phased-plan.md`: phased rollout for media analysis, prompt optimization, evaluation, and MCP adoption gates.
- `ai-studio-agent-pipeline-hardening-plan.md`: quality-first hardening plan for deterministic routing, server-owned vision summaries, durable canonical state, and no-question action contracts.
- `ai-studio-reference-grid-stabilization-v4-plan.md`: decision-complete stabilization plan for 50-60 reference sessions (decoupling, adaptive delivery, hydration/decode budgets, virtualization, watchdog degrade levels).
- `media-library-reference-grid-optimization-plan.md`: near-instant media loading architecture plan (Media Library + AI Studio Reference Grid).
- `media-optimization-phase0-measurement-spec.md`: baseline instrumentation, dataset profiles, and phase gates for media performance.
- `media-optimization-schema-and-migration-spec.md`: proposed schema/storage migration design for derivative-first media delivery.
- `ai-studio-primary-character-panel-build-plan.md`: execution plan for embedding the Character Manager workflow body into AI Studio's primary Character toolbar panel.
- `ai-studio-shell-render-isolation-v3-plan.md`: selector-store + shell-boundary isolation execution and rollout plan for 50-60 reference shell responsiveness.
- `expert-workflow-hardening-css-reorg-plan.md`: execution tracker for expert workflow hardening and expert CSS reorganization.
- `tooling-audit-2026-02-16.md`: comprehensive tooling and framework audit with prioritized recommendations for masonry layout, image optimization, DnD, toasts, lightbox, date formatting, state management, and schema validation.

## Maintenance
- Keep plans actionable and current.
- Move obsolete plans to `docs/archive/planning/` when superseded.
- Superseded UX-0 partial baseline report moved to `docs/archive/mvp-ui-ux-phase0-baseline-report-2026-02-14-dashboard-ai-studio.md`.
- Log notable plan outcomes in `docs/change_log.md`.
