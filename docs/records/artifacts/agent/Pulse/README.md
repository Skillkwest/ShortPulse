# Pulse Agent Artifacts

Purpose: store non-authoritative retained artifacts for Pulse's Standard-mode and Pulse-mode agent behavior training.

## Status

Pulse is currently at `Level 1: Supervised`.

The agent has a durable contract, scoped local instructions, standing SOP, ownership manifest, workspace, and memory area, and has completed one supervised Standard/Pulse agent-runtime implementation run.

## Artifact Layout

- `training-history.md`: supervised training runs, lessons, and maturity updates.
- `reports/`: full run reports and evidence summaries.

Retained helper notes that remain worth keeping live directly in this README so the artifact lane has one cleaner entrypoint instead of several tiny duplicate files.

## Authority

These artifacts support Pulse training and traceability. They do not override canonical repo rules, ADRs, SOPs, product docs, current user instructions, or direct validation evidence.

## Canonical Entry Points

- Agent contract: `docs/agents/Pulse/README.md`
- Local instructions: `docs/agents/Pulse/AGENTS.md`
- Standing SOP: `docs/agents/Pulse/standard-operating-procedure.md`
- Ownership manifest: `docs/agents/Pulse/ownership-manifest.md`
- Repo-visible memory: `docs/agents/Pulse/memory.md`
- Workspace: `docs/agents/Pulse/workspace/`
- Create wiring SOP: `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`
- Agent SOP: `docs/sops/sop_ai_studio_agent.md`
- Pulse mode SOP: `docs/sops/sop_ai_studio_pulse_mode.md`
- Runtime isolation ADR: `docs/adr/0061-ai-studio-standard-vs-pulse-runtime-isolation-contract.md`
- Mode-owned roots ADR: `docs/adr/0071-ai-studio-create-mode-owned-runtime-roots.md`

## Retained Training Notes

### Guardrail Summary

- Standard and Pulse are separate runtime modes.
- Pulse mode is a guided agent-first Create lane, not a visible prompt-paste helper.
- Hidden Pulse instructions must not leak into visible Standard composer state or Standard route payloads.
- Pulse intermediate guidance turns are not final artifacts.
- Final Pulse artifacts route by explicit artifact target.

### Retained Workflow References

- `agent-teaching/README.md`
- `agent-teaching/operations/post-run-performance-analysis-interview.md`
- `docs/agents/Pulse/standard-operating-procedure.md`
- `docs/agents/Pulse/ownership-manifest.md`
- `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`
- `docs/sops/sop_ai_studio_agent.md`
- `docs/sops/sop_ai_studio_pulse_mode.md`
- `docs/adr/0061-ai-studio-standard-vs-pulse-runtime-isolation-contract.md`
- `docs/adr/0071-ai-studio-create-mode-owned-runtime-roots.md`

### Retained Tooling Notes

- startup contract helper: `skills/skill-session-startup-contract/SKILL.md`
- docs validation: `npm -C frontend run docs:check`
- broader validation only when relevant:
  - `npm -C frontend run lint`
  - `npm -C frontend run build`

No dedicated Pulse helper scripts are currently justified. Add tooling only when repeated Pulse runs prove a real friction point.
