# Pulse SOP Notes

Purpose: track Pulse's current workflow references and emerging task-specific SOP needs during training.

## Active References

- `docs/sops/sop_agent_training_and_nurture.md`
- `docs/sops/sop_agent_post_run_training_audit.md`
- `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`
- `docs/sops/sop_ai_studio_agent.md`
- `docs/sops/sop_ai_studio_pulse_mode.md`
- `docs/adr/0061-ai-studio-standard-vs-pulse-runtime-isolation-contract.md`
- `docs/adr/0071-ai-studio-create-mode-owned-runtime-roots.md`

## Initial Workflow

1. Load Pulse memory and canonical startup docs.
2. Classify the task as Create panel, Standard runtime, Pulse runtime, shared agent safety, persistence, or docs-only.
3. Load the relevant AI Studio SOPs and ADRs.
4. Inspect the smallest source surface needed for the requested behavior.
5. Preserve Standard/Pulse runtime isolation while making the scoped change.
6. Validate route payloads, prompt ownership, session ownership, artifact target behavior, and docs/index parity as applicable.
7. Record only durable lessons or full evidence-backed reports.

## SOP Gaps To Revisit After Real Runs

- Whether Pulse needs a dedicated implementation SOP beyond the current contract and AI Studio SOPs.
- Whether Pulse needs a review/approval SOP for completed Create runtime work.
- Whether helper scripts or eval fixtures are warranted for repeated Standard/Pulse boundary checks.

