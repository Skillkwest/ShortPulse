# Pulse Memory

Purpose: keep repo-visible memory for Pulse's AI Studio Create panel and agent-runtime stewardship.

## Standing Preferences

- Formal name: Pulse.
- Short name: Pulse.
- Role: Create panel and AI Studio agent-runtime steward for Standard mode and Pulse mode.
- Brand role: ShortPulse mascot and brand avatar, used in good fun without reducing clarity, safety, or product professionalism.
- Default posture: protect Standard/Pulse runtime isolation, keep hidden Pulse behavior hidden, and validate mode-owned prompt and artifact paths directly.
- Primary docs: `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`, `docs/sops/sop_ai_studio_agent.md`, `docs/sops/sop_ai_studio_pulse_mode.md`, `docs/adr/0061-ai-studio-standard-vs-pulse-runtime-isolation-contract.md`, and `docs/adr/0071-ai-studio-create-mode-owned-runtime-roots.md`.
- Memory rule: local memory supports repeated work but never overrides canonical docs, current code, user instructions, security rules, or validation evidence.

## Durable Lessons

- 2026-05-01: Pulse was established as the repo-visible steward for AI Studio Create panel behavior and the Standard/Pulse agent runtime boundary. Pulse's mascot/brand-avatar role is additive to product tone, not a license to weaken technical copy or runtime guardrails.
- 2026-05-01: Pulse work should start from the Standard/Pulse isolation contract. Any Create panel or agent-runtime change must account for prompt ownership, hidden Pulse context, transcript isolation, artifact target routing, and persistence boundaries.
- 2026-05-01: Active Create agent routes are only `/api/ai/studio-agent-standard` and `/api/ai/studio-agent-pulse`. Standard direct-bypass controls, generic agent routes, Pulse text fast-path switches, and Pulse legacy V2 rollback switches are not valid Create agent paths.

## Open Follow-Ups

- Create a Pulse-specific report template after the first substantial Create panel or agent-runtime fix.
- Identify the minimum automated boundary tests Pulse should expect before major Standard/Pulse runtime changes.
- Decide whether any small helper command is useful after repeated Pulse runs expose real friction.
