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

## Shared Trust Standard

- `docs/agents/solo-owner-launch-trust-standard.md`: shared launch-trust standard for high-ROI agents supporting a solo human owner during the pre-launch production-readiness phase.

## Agent Contracts

- `docs/agents/testers/README.md`: simulated customer tester index for customer-realistic UI, UX, and behavior audits.
  - `docs/agents/testers/maya-chen/README.md`: Maya Chen growth-stage creator tester profile, SOPs, reports, workspace, and scoring tools.
  - `docs/agents/testers/mark-delaney/README.md`: Mark Delaney practical AI content workspace tester profile and local-only credential setup.
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
- `docs/agents/ako/README.md`: Ako backlog management, planning-surface reconciliation, and authorized board-sync contract and memory entrypoint.
  - `docs/agents/ako/AGENTS.md`: Ako-scoped execution overlay for backlog, planning, and board-reconciliation work.
  - `docs/agents/ako/memory.md`: Ako's repo-visible durable memory entrypoint.
  - `docs/agents/ako/standard-operating-procedure.md`: Ako's standing SOP for backlog audits, planning cleanup, and authorized board reconciliation.
  - `docs/agents/ako/ownership-manifest.md`: Ako's ownership boundary map for backlog/planning surfaces versus adjacent specialist lanes.
  - retained artifacts live under `docs/records/artifacts/agent/ako/`.
- `docs/agents/abismia/README.md`: Abismia UI/UX and intended runtime behavior stewardship contract and memory entrypoint.
  - `docs/agents/abismia/AGENTS.md`: Abismia-scoped execution overlay for UI/UX and visible runtime-behavior work.
  - `docs/agents/abismia/memory.md`: Abismia's repo-visible durable memory entrypoint.
  - `docs/agents/abismia/standard-operating-procedure.md`: Abismia's standing SOP for UI/UX reviews, canonical interaction fixes, and runtime-state validation.
  - `docs/agents/abismia/sop-runtime-ui-code-hardening.md`: Abismia lane SOP for CSS, TSX, layout, component, and visible runtime hardening without unintended visual or behavior drift.
  - `docs/agents/abismia/sop-human-experience-psychological-feel.md`: Abismia lane SOP for signed-in human-experience audits, perceived speed, trust, hesitation, agency, and cognitive load.
  - `docs/agents/abismia/workspace/README.md`: Abismia's temporary workspace and intake surface.
- `docs/agents/enate-ende/README.md`: Enate Ende right-rail Canvas stewardship contract and memory entrypoint.
  - `docs/agents/enate-ende/AGENTS.md`: Enate Ende-scoped execution overlay for Canvas-only work.
  - `docs/agents/enate-ende/memory.md`: Enate Ende's repo-visible durable memory entrypoint.
  - `docs/agents/enate-ende/standard-operating-procedure.md`: Enate Ende's standing SOP for Canvas behavior, durability, and validation work.
  - `docs/agents/enate-ende/ownership-manifest.md`: Enate Ende's ownership boundary map for Canvas versus adjacent specialist lanes.
  - `docs/agents/enate-ende/canvas-command-index.md`: compact first-load map for Canvas owner paths, validation anchors, and escalation docs.
  - `docs/agents/enate-ende/canvas-launch-hardening-plan-2026-07-07.md`: canonical pre-launch Canvas hardening plan for trust, durability, proof, and freeze rules.
  - `docs/agents/enate-ende/canvas-tear-out-drag-design-2026-06-03.md`: design note for exporting Canvas items into workflow surfaces without regressing normal Canvas drag behavior.
  - `docs/agents/enate-ende/workspace/README.md`: Enate Ende's temporary workspace and intake surface.
  - retained artifacts live under `docs/records/artifacts/agent/enate-ende/`.
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
  - `docs/agents/nuclo/CURRENT-HANDOFF.md`: active Nuclo handoff entrypoint; use this before reports when status is active.
  - `docs/agents/nuclo/memory.md`: Nuclo's concise repo-visible durable memory.
  - `docs/agents/nuclo/environment-ledger-template.md`: reviewed matrix template for branch, Vercel, GitHub Environment, and Supabase mapping before cutover work.
  - `docs/agents/nuclo/previous-handoffs/`: archived Nuclo handoff summaries; historical only unless explicitly relevant.
  - `docs/agents/nuclo/workspace/README.md`: Nuclo-owned operational workspace for managed scratch, inbox material, and handoff preparation.
  - retained artifacts live under `docs/records/artifacts/agent/nuclo/`.
- `docs/agents/latency/README.md`: Latency app-wide latency optimization steward contract, memory entrypoint, and source-of-truth prompt for the July 7 2026 latency launch plan.
  - `docs/agents/latency/AGENTS.md`: Latency-scoped execution overlay for high-ROI, preserve-behavior performance work.
  - `docs/agents/latency/job-description.md`: Latency's durable job title, job description, responsibilities, authority, success criteria, and hard boundaries.
  - `docs/agents/latency/goal-prompt.md`: durable active goal prompt for continuing the ShortPulse latency optimization plan.
  - `docs/agents/latency/memory.md`: Latency's repo-visible durable memory entrypoint.
  - `docs/agents/latency/standard-operating-procedure.md`: Latency's standing SOP for ROI-ranked latency execution, validation, and stop discipline.
  - `docs/agents/latency/ownership-manifest.md`: Latency's ownership boundary map for app-wide performance versus adjacent specialist lanes.
  - `docs/agents/latency/tools/README.md`: Latency's helper command and tool inventory.
  - `docs/agents/latency/workspace/README.md`: Latency's temporary workspace and intake surface.
  - retained artifacts live under `docs/records/artifacts/agent/latency/`.
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
- `docs/agents/bactuo/README.md`: Bactuo generation lifecycle, provider recovery, and request-scoped settlement contract and memory entrypoint.
  - `docs/agents/bactuo/AGENTS.md`: Bactuo-scoped execution overlay for generation, recovery, and settlement work.
  - `docs/agents/bactuo/memory.md`: Bactuo's repo-visible durable memory entrypoint.
  - `docs/agents/bactuo/standard-operating-procedure.md`: standing SOP for generation audits, canonical fixes, architecture consolidation, and training updates.
  - `docs/agents/bactuo/ownership-manifest.md`: Bactuo's ownership boundary map for generation versus pricing policy, security, environment, media, and project-persistence lanes.
  - `docs/agents/bactuo/generation-recovery-settlement-source-map.md`: compact first-load owner map for generation lifecycle authority, settlement seams, and validation anchors.
  - `docs/agents/bactuo/generation-architecture-consolidation-plan-2026-06-03.md`: staged architecture plan for making generation, recovery, and settlement more cohesive without a rewrite.
  - `docs/agents/bactuo/workspace/README.md`: Bactuo-owned temporary workspace for generation investigations, scratch architecture notes, and active intake material.
  - retained artifacts live under `docs/records/artifacts/agent/bactuo/`.
- `docs/agents/Money Stuff/README.md`: Money Stuff permanent commerce billing steward contract, memory entrypoint, and source-of-truth map.
- `docs/agents/nogo/README.md`: Nogo provider spending analytics steward contract, memory entrypoint, SOP, tools/workspace home, and spend-limit baseline owner.
  - `docs/agents/nogo/AGENTS.md`: Nogo-scoped instruction overlay for provider-spend analytics work.
  - `docs/agents/nogo/memory.md`: Nogo's concise durable memory and current baseline pointer.
  - `docs/agents/nogo/standard-operating-procedure.md`: standing SOP for spend limits, live spend audits, dashboard guidance, provider pricing refreshes, anomaly triage, and report/tool creation.
  - `docs/agents/nogo/ownership-manifest.md`: Nogo's boundary map against Money Stuff, Lever, Bactuo, Nuclo, Dave, and Copperknot.
  - `docs/agents/nogo/tools/README.md`: Nogo helper-tool inventory and tool guardrails.
  - `docs/agents/nogo/workspace/README.md`: Nogo intake/dropbox and scratch workspace.
  - retained artifacts live under `docs/records/artifacts/agent/nogo/`.
- `docs/agents/lever/README.md`: Lever model maintenance manager contract and memory entrypoint.
- `docs/agents/holomony/README.md`: Holomony media optimization and performance specialist contract and memory entrypoint.
  - `docs/agents/holomony/AGENTS.md`: Holomony-scoped execution overlay for media optimization, KPI, audit, and training loops.
  - `docs/agents/holomony/standard-operating-procedure.md`: Holomony's standing SOP for media-surface performance audits, optimization lanes, KPI discipline, and training updates.
  - `docs/agents/holomony/ownership-manifest.md`: Holomony's ownership boundary map for local instructions, artifacts, helper scripts, and shared dependencies.
  - `docs/agents/holomony/media-display-command-index.md`: compact code-backed command index for product media grids, media-library carriages, detail modals, and double-click handoffs.
  - `docs/agents/holomony/media-display-authority-ledger.md`: current claim packet table for Holomony media-display and detail-modal ownership.
  - `docs/agents/holomony/right-rail-command-index.md`: compact code-backed command index for Reference Grid, Quick Slot Inventory, and right-rail Canvas ownership work.
- `docs/agents/gutan/README.md`: Gutan media-ingestion normalization and product image admission contract and memory entrypoint.
  - `docs/agents/gutan/AGENTS.md`: Gutan-scoped execution overlay for image admission, resizing, compression, and boundary handoffs.
  - `docs/agents/gutan/standard-operating-procedure.md`: Gutan's standing SOP for image-admission audits, plans, implementation runs, and validation.
  - `docs/agents/gutan/ownership-manifest.md`: Gutan's ownership boundary map for product image admission versus display, storage, security, and Create/Pulse runtime lanes.
- `docs/agents/hybervees/README.md`: Hybervees tester-insights analyst contract for reading Admin Tester Reports and turning tester evidence into product-decision intelligence.
  - `docs/agents/hybervees/AGENTS.md`: Hybervees-scoped instruction overlay for tester-report insight analysis.
  - `docs/agents/hybervees/memory.md`: Hybervees' concise durable memory and default product-context anchors.
  - `docs/agents/hybervees/standard-operating-procedure.md`: standing SOP for reviewing tester reports, extracting human and engineering signal, and routing product follow-ups.
  - `docs/agents/hybervees/ownership-manifest.md`: Hybervees boundary map against tester personas, UX, debug, engineering, launch-readiness, security, billing, and repo-steward lanes.
  - `docs/agents/hybervees/workspace/README.md`: Hybervees workspace and intake/dropbox surface.
  - retained artifacts live under `docs/records/artifacts/agent/hybervees/`.
- `docs/agents/Create Workflow/README.md`: Create Workflow Create-panel stewardship contract and memory entrypoint for Standard/Pulse runtime boundaries, composer behavior, and retained workflow training.
  - `docs/agents/Create Workflow/create-panel-operating-brief.md`: compact current-state brief for Create panel runtime ownership, composer contract, and workflow boundaries.
  - `docs/agents/Create Workflow/create-panel-system-map.md`: compact system map for Create page orchestration, Standard/Pulse runtime boundaries, composer intake, and reference-feed ownership.
  - `docs/agents/Create Workflow/standard-operating-procedure.md`: standing SOP for Create-panel attachment/composer incident handling and training-data capture.
  - retained artifacts live under the slugged path `docs/records/artifacts/agent/create-workflow/`.
- `docs/agents/Pulse/README.md`: Pulse Standard-mode and Pulse-mode agent behavior ownership contract, memory entrypoint, and workspace home.
  - `docs/agents/Pulse/AGENTS.md`: Pulse-scoped execution overlay for Standard/Pulse agent behavior work.
  - `docs/agents/Pulse/memory.md`: Pulse's repo-visible durable memory entrypoint.
  - `docs/agents/Pulse/standard-operating-procedure.md`: Pulse's standing SOP for Standard/Pulse agent behavior, boundary, and `/admin/agent-instructions` Standard control-plane work.
  - `docs/agents/Pulse/ownership-manifest.md`: Pulse's ownership boundary map for Standard/Pulse runtime behavior versus adjacent specialist lanes.
  - `docs/agents/Pulse/workspace/README.md`: Pulse-owned temporary workspace for handoff files, drafts, and implementation prep material.
- `docs/agents/copperknot/README.md`: systems catalog stewardship, production-readiness prioritization, and execution-handoff contract and memory entrypoint.
  - `docs/agents/copperknot/goal-prompt.md`: concise reusable mission prompt for Copperknot's launch-readiness stewardship.
  - `docs/agents/copperknot/operating-package-2026-05-06.md`: current operating package entrypoint for the July 2 production-readiness window.
  - `docs/agents/copperknot/standard-operating-procedure.md`: core always-load SOP for catalog audits, rerating, handoff generation, and external lane report intake.
  - `docs/agents/copperknot/standard-operating-procedure-reference.md`: conditional deeper standards reference for handoff design, maintenance/pruning, status models, and output rules.
  - `docs/agents/copperknot/catalog-tool-health-metrics.md`: standing health metrics for judging whether the catalog tool itself remains trustworthy and current.
  - `docs/agents/copperknot/measurement-and-learning.md`: standing measurement framework for score history, launch-state trends, and queue-decision hindsight.
- `docs/agents/datserok/README.md`: Datserok project persistence, project save/restore, and project-workspace authority contract and memory entrypoint.
  - `docs/agents/datserok/AGENTS.md`: Datserok-scoped execution overlay for project persistence work.
  - `docs/agents/datserok/memory.md`: Datserok's repo-visible durable memory entrypoint.
  - `docs/agents/datserok/runtime-load-policy.md`: Datserok's default always-load versus conditional-load policy for keeping runtime context lean.
  - `docs/agents/datserok/standard-operating-procedure.md`: standing SOP for project persistence audits, explanations, canonical fixes, and training updates.
  - `docs/agents/datserok/ownership-manifest.md`: Datserok's ownership boundary map for project persistence versus adjacent AI Studio, media, environment, release, security, and readiness lanes.
  - `docs/agents/datserok/project-persistence-source-map.md`: compact first-load owner map for project identity, project save/restore behavior, code paths, and validation anchors.
  - retained artifacts live under `docs/records/artifacts/agent/datserok/`.

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
