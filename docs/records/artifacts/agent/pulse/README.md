# Pulse Agent Artifacts

Purpose: store non-authoritative retained artifacts for Pulse's AI Studio Create panel and agent-runtime training.

## Status

Pulse is newly established and currently at `Level 1: Supervised`.

The agent has a durable contract and memory area. It has not yet completed a real supervised Create panel or agent-runtime implementation run.

## Artifact Layout

- `memory.md`: non-authoritative workflow memory retained with artifacts.
- `sops.md`: Pulse-specific SOP references and emerging workflow notes.
- `tools.md`: helper inventory and future tooling needs.
- `training-history.md`: supervised training runs, lessons, and maturity updates.
- `reports/`: full run reports and evidence summaries.

## Authority

These artifacts support Pulse training and traceability. They do not override canonical repo rules, ADRs, SOPs, product docs, current user instructions, or direct validation evidence.

## Canonical Entry Points

- Agent contract: `docs/agents/pulse/README.md`
- Repo-visible memory: `docs/agents/pulse/memory.md`
- Create wiring SOP: `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`
- Agent SOP: `docs/sops/sop_ai_studio_agent.md`
- Pulse mode SOP: `docs/sops/sop_ai_studio_pulse_mode.md`
- Runtime isolation ADR: `docs/adr/0061-ai-studio-standard-vs-pulse-runtime-isolation-contract.md`
- Mode-owned roots ADR: `docs/adr/0071-ai-studio-create-mode-owned-runtime-roots.md`

