# Agent Workflow Helpers

Purpose: index task-specific agent contracts, memory areas, and training helpers used by ShortPulse admin and engineering workflows.

## New Agent Quick Start

Use this path when setting up a new agent for a new recurring task:

1. Read `docs/sops/sop_agent_training_and_nurture.md`.
2. Fill in `docs/agents/generic-agent-training-template.md`.
3. Create the agent contract or memory entrypoint under `docs/agents/<agent-name>/` when the agent needs durable local notes.
4. Store run artifacts under `docs/records/artifacts/agent/<agent-name>/` when reports, training history, or raw evidence need to be retained.
5. After real runs, use `docs/sops/sop_agent_post_run_training_audit.md` to decide whether prompts, SOPs, templates, tools, or skills should improve.

## Agent Contracts

- `docs/agents/change-impact-auditor.md`: change-impact audit helper contract.
- `docs/agents/gear-ball/README.md`: worktree, branch, environment, Vercel, and database coordination contract and memory entrypoint.
  - `docs/agents/gear-ball/github-operations.md`: Gear Ball's local GitHub push, PR, review, and merge coordination summary.
- `docs/agents/ophestivus.md`: admin board steward contract.
- `docs/agents/gottspan-the-admin/README.md`: Gottspan The Admin operating contract and memory entrypoint.
- `docs/agents/pulse/README.md`: Pulse Create panel and AI Studio Standard/Pulse agent-runtime stewardship contract and memory entrypoint.

## Training Templates

- `docs/sops/sop_agent_training_and_nurture.md`: reusable SOP for creating, training, evaluating, and nurturing task-specific agents.
- `docs/sops/sop_agent_post_run_training_audit.md`: reusable post-run audit SOP for improving trained workflows after real runs.
- `docs/agents/generic-agent-training-template.md`: reusable task-specific agent training template.
