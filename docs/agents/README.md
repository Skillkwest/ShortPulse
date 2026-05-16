# Agent Workflow Helpers

Purpose: index task-specific agent contracts, memory areas, and training helpers used by ShortPulse admin and engineering workflows.

## New Agent Quick Start

Use this path when setting up a new agent for a new recurring task:

1. Read `agent-teaching/README.md`.
2. Read `agent-teaching/foundations/how-to-decide-what-your-agent-can-do.md`.
3. Read `agent-teaching/setup/new-codex-project-setup.md` and `agent-teaching/setup/define-agent-identity.md`.
4. Use `agent-teaching/prompts/agent-setup-prompt.md` and, when SOPs already exist, `agent-teaching/prompts/agent-contract.md`.
5. Create the agent contract or memory entrypoint under `docs/agents/<agent-name>/` when the agent needs durable local notes.
6. Store run artifacts under `docs/records/artifacts/agent/<agent-name>/` when reports, training history, or raw evidence need to be retained.
7. After real runs, use `agent-teaching/operations/post-run-performance-analysis-interview.md` to decide whether prompts, SOPs, tools, or scope should improve.
8. Once the agent is stable, use `agent-teaching/operations/create-baseline-kpi.md` to freeze a baseline KPI.

## Agent Contracts

- `docs/agents/beeper/README.md`: Beeper live-product testing, UI/UX audit, and functionality walkthrough contract and memory entrypoint.
  - `docs/agents/beeper/standard-operating-procedure.md`: standing SOP for Beeper live testing, issue capture, handoff packets, and supervised training records.
- `docs/agents/bopper/README.md`: Bopper average-user testing, confusion capture, and abandonment-truth contract and memory entrypoint.
  - `docs/agents/bopper/standard-operating-procedure.md`: standing SOP for Bopper first-impression, CTA trust, and naive-user workflow audits.
  - `bopper/PERSONA.md`: active ICP card for Bopper's paying Studio-plan average-user persona.
  - `bopper/TRAINING-SYSTEM.md`: required run-packet, report, and rollup checklist for Bopper training data.
- `docs/agents/ayal/README.md`: Ayal user-account management and customer-service steward contract and memory entrypoint.
- `docs/agents/d-bug/README.md`: debugging handoff intake, triage, reproduction, and debug-plan contract.
  - `docs/agents/d-bug/standard-operating-procedure.md`: standing SOP for D-Bug handoff intake, repo audit, debug planning, bounded fixes, and downstream routing.
  - `docs/agents/d-bug/scorecard-operations.md`: standing SOP for D-Bug checkpoint scoring, baseline tracking, and training-evidence capture.
- `docs/agents/change-impact-auditor.md`: change-impact audit helper contract.
- `docs/agents/gear-ball/README.md`: worktree, branch, environment, Vercel, and database coordination contract and memory entrypoint.
  - `docs/agents/gear-ball/github-operations.md`: Gear Ball's local GitHub push, PR, review, and merge coordination summary.
- `docs/agents/nuclo/README.md`: Nuclo version, environment ladder, Vercel, and Supabase coordination contract and memory entrypoint.
  - `docs/agents/nuclo/environment-ledger-template.md`: reviewed matrix template for branch, Vercel, GitHub Environment, and Supabase mapping before cutover work.
- `docs/agents/ophestivus.md`: admin board steward contract.
- `docs/agents/gottspan-the-admin/README.md`: Gottspan The Admin operating contract and memory entrypoint.
- `docs/agents/ledger/README.md`: Ledger commerce billing steward contract, memory entrypoint, and source-of-truth map.
- `docs/agents/lever/README.md`: Lever model maintenance manager contract and memory entrypoint.
- `docs/agents/holomony/README.md`: Holomony media optimization and performance specialist contract and memory entrypoint.
  - `docs/agents/holomony/AGENTS.md`: Holomony-scoped execution overlay for media optimization, KPI, audit, and training loops.
- `docs/agents/pulse/README.md`: Pulse Create panel and AI Studio Standard/Pulse agent-runtime stewardship contract and memory entrypoint.
- `docs/agents/system-catalog-agent/README.md`: systems catalog stewardship, production-readiness prioritization, and execution-handoff contract and memory entrypoint.
  - `docs/agents/system-catalog-agent/operating-package-2026-05-06.md`: current operating package entrypoint for the June 6 production-readiness window.
  - `docs/agents/system-catalog-agent/standard-operating-procedure.md`: standing SOP for catalog audits, rerating, handoff generation, and external lane report intake.

## Training Guides

- `agent-teaching/README.md`: local mirror of the final Notion teaching curriculum.
- `agent-teaching/foundations/how-to-decide-what-your-agent-can-do.md`: decide whether a workflow is ready to become an agent.
- `agent-teaching/setup/codex-app-settings.md`: required Codex app and composer settings.
- `agent-teaching/setup/define-agent-identity.md`: identity, guardrails, dropbox folder, and training-history setup.
- `agent-teaching/prompts/agent-setup-prompt.md`: first setup prompt for a new agent without mature SOPs.
- `agent-teaching/prompts/agent-contract.md`: formal contract prompt for mature agents with existing SOPs.
- `agent-teaching/operations/post-run-performance-analysis-interview.md`: reusable post-run review sequence.
- `agent-teaching/operations/create-baseline-kpi.md`: frozen KPI baseline creation guidance.
- `agent-teaching/operations/agent-management.md`: how to move the agent from training to automation and maintenance.
- `agent-teaching/foundations/agent-maintenance-field-guide.md`: generic maintenance and drift guide.
