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
  - `docs/agents/beeper/workspace/README.md`: Beeper-owned operational workspace for testing reports, run packets, evidence manifests, helper scripts, queues, and temporary working material.
- `docs/agents/bopper/README.md`: Bopper average-user testing, confusion capture, and abandonment-truth contract and memory entrypoint.
  - `docs/agents/bopper/standard-operating-procedure.md`: standing SOP for Bopper first-impression, CTA trust, and naive-user workflow audits.
  - `docs/agents/bopper/workspace/PERSONA.md`: active ICP card for Bopper's paying Studio-plan average-user persona.
  - `docs/agents/bopper/workspace/TRAINING-SYSTEM.md`: required run-packet, report, and rollup checklist for Bopper training data.
- `docs/agents/ayla/README.md`: Ayla, Kirk's primary AI personal assistant for ShortPulse, contract and authority surface.
  - `docs/agents/ayla/memory.md`: Ayla's repo-visible durable memory entrypoint.
  - `docs/agents/ayla/standard-operating-procedure.md`: Ayla's standing SOP for support replies, approval-sensitive outbound drafts, escalation, and retention.
  - `docs/agents/ayla/ux-playbook.md`: Ayla's applied UX lens for support trust, hesitation, auth recovery, pricing confusion, and escalation clarity.
  - `docs/agents/ayla/workspace/README.md`: Ayla's temporary workspace and intake surface.
- `docs/agents/abismia/README.md`: Abismia UI/UX and intended runtime behavior stewardship contract and memory entrypoint.
  - `docs/agents/abismia/AGENTS.md`: Abismia-scoped execution overlay for UI/UX and visible runtime-behavior work.
  - `docs/agents/abismia/memory.md`: Abismia's repo-visible durable memory entrypoint.
  - `docs/agents/abismia/standard-operating-procedure.md`: Abismia's standing SOP for UI/UX reviews, canonical interaction fixes, and runtime-state validation.
  - `docs/agents/abismia/workspace/README.md`: Abismia's temporary workspace and intake surface.
- `docs/agents/d-bug/README.md`: debugging handoff intake, triage, reproduction, and debug-plan contract.
  - `docs/agents/d-bug/standard-operating-procedure.md`: standing SOP for D-Bug handoff intake, repo audit, debug planning, bounded fixes, and downstream routing.
  - `docs/agents/d-bug/scorecard-operations.md`: standing SOP for D-Bug checkpoint scoring, baseline tracking, and training-evidence capture.
- `docs/agents/dave-the-security-guy/README.md`: Dave the Security Guy security stewardship contract for app security, user account security, Supabase, Vercel, secrets, environment boundaries, and attack-resistance review.
  - `docs/agents/dave-the-security-guy/AGENTS.md`: Dave-scoped security execution overlay.
  - `docs/agents/dave-the-security-guy/standard-operating-procedure.md`: Dave's standing SOP for security review, hardening, incident response, and environment-security work.
  - `docs/agents/dave-the-security-guy/security-ownership-map.md`: Dave's security control-family and steward handoff map.
  - `docs/agents/dave-the-security-guy/workspace/README.md`: Dave's temporary workspace and intake surface.
- `docs/agents/change-impact-auditor.md`: change-impact audit helper contract.
- `docs/agents/gear-ball/README.md`: worktree, branch, environment, Vercel, and database coordination contract and memory entrypoint.
  - `docs/agents/gear-ball/github-operations.md`: Gear Ball's local GitHub push, PR, review, and merge coordination summary.
- `docs/agents/nuclo/README.md`: Nuclo version, environment ladder, Vercel, and Supabase coordination contract and memory entrypoint.
  - `docs/agents/nuclo/environment-ledger-template.md`: reviewed matrix template for branch, Vercel, GitHub Environment, and Supabase mapping before cutover work.
  - `docs/agents/nuclo/workspace/README.md`: Nuclo-owned operational workspace for managed scratch, inbox material, and handoff preparation.
- `docs/records/artifacts/agent/ophestivus/contract.md`: admin board steward contract and local workspace home.
  - compatibility pointer remains at `docs/agents/ophestivus/README.md` for historical links.
- `docs/agents/gottspan-the-admin/README.md`: Gottspan The Admin operating contract and memory entrypoint.
  - `docs/agents/gottspan-the-admin/ux-playbook.md`: Gottspan's applied UX review lens for admin surfaces, especially trust, hesitation, pricing clarity, and grid-first operator workflows.
  - `docs/agents/gottspan-the-admin/standard-operating-procedure.md`: Gottspan's standing SOP for repo-state audits, docs governance, admin subsystem stewardship, release-risk review, and agent-surface routing.
  - `docs/agents/gottspan-the-admin/repo-state-audit-checklist.md`: Gottspan's compact checklist for branch/worktree posture, docs integrity, repo-risk review, and closeout discipline during repo audits.
  - `docs/agents/gottspan-the-admin/weekly-repo-steward-run.md`: Gottspan's default weekly recurring workflow for one concise repo-state audit and one durable report.
  - `docs/agents/gottspan-the-admin/runtime-load-policy.md`: Gottspan's default always-load versus conditional-load policy for keeping runtime context lean.
  - `docs/agents/gottspan-the-admin/prompts/README.md`: Gottspan's reusable prompt library for repo-steward and maintenance workflows.
  - commit/push execution is intentionally out of scope for Gottspan and belongs to Gear Ball.
- `docs/agents/Babineaux the Engineer/README.md`: Babineaux the Engineer contract for code-quality, runtime correctness, modularity, and production-readiness hardening.
  - `docs/agents/Babineaux the Engineer/AGENTS.md`: Babineaux the Engineer local instruction overlay for this folder.
  - `docs/agents/Babineaux the Engineer/memory.md`: Babineaux the Engineer repo-visible durable memory entrypoint.
  - `docs/agents/Babineaux the Engineer/standard-operating-procedure.md`: standing SOP for bounded hardening, canonicalization, contract repair, and seam-reduction lanes.
  - `docs/agents/Babineaux the Engineer/ownership-manifest.md`: owned vs non-owned surface map for Babineaux the Engineer.
  - `docs/agents/Babineaux the Engineer/workspace/README.md`: Babineaux the Engineer temporary workspace and scratch surface.
- `docs/agents/Money Stuff/README.md`: Money Stuff permanent commerce billing steward contract, memory entrypoint, and source-of-truth map.
- `docs/agents/lever/README.md`: Lever model maintenance manager contract and memory entrypoint.
- `docs/agents/holomony/README.md`: Holomony media optimization and performance specialist contract and memory entrypoint.
  - `docs/agents/holomony/AGENTS.md`: Holomony-scoped execution overlay for media optimization, KPI, audit, and training loops.
  - `docs/agents/holomony/standard-operating-procedure.md`: Holomony's standing SOP for media-surface performance audits, optimization lanes, KPI discipline, and training updates.
  - `docs/agents/holomony/ownership-manifest.md`: Holomony's ownership boundary map for local instructions, artifacts, helper scripts, and shared dependencies.
- `docs/agents/Create Workflow/README.md`: Create Workflow Create-panel stewardship contract and memory entrypoint for Standard/Pulse runtime boundaries, composer behavior, and retained workflow training.
  - `docs/agents/Create Workflow/create-panel-operating-brief.md`: compact current-state brief for Create panel runtime ownership, composer contract, and workflow boundaries.
  - `docs/agents/Create Workflow/create-panel-system-map.md`: compact system map for Create page orchestration, Standard/Pulse runtime boundaries, composer intake, and reference-feed ownership.
  - `docs/agents/Create Workflow/standard-operating-procedure.md`: standing SOP for Create-panel attachment/composer incident handling and training-data capture.
  - retained artifacts live under the slugged path `docs/records/artifacts/agent/create-workflow/`.
- `docs/agents/pulse/README.md`: Pulse Create panel and AI Studio Standard/Pulse agent-runtime stewardship contract and memory entrypoint.
- `docs/agents/copperknot/README.md`: systems catalog stewardship, production-readiness prioritization, and execution-handoff contract and memory entrypoint.
  - `docs/agents/copperknot/operating-package-2026-05-06.md`: current operating package entrypoint for the July 2 production-readiness window.
  - `docs/agents/copperknot/standard-operating-procedure.md`: standing SOP for catalog audits, rerating, handoff generation, and external lane report intake.
  - `docs/agents/copperknot/catalog-tool-health-metrics.md`: standing health metrics for judging whether the catalog tool itself remains trustworthy and current.
  - `docs/agents/copperknot/measurement-and-learning.md`: standing measurement framework for score history, launch-state trends, and queue-decision hindsight.

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
