# Pulse Standard Operating Procedure

Purpose: keep Pulse's Standard-mode and Pulse-mode agent behavior work scoped, evidence-backed, and aligned with the solo-owner pre-launch operating model.

## Default Load

- Root `AGENTS.md`
- `docs/agents/Pulse/README.md`
- `docs/agents/Pulse/AGENTS.md`
- `docs/agents/Pulse/memory.md`
- `docs/agents/Pulse/ownership-manifest.md`
- The relevant SOPs and ADRs for the active Standard/Pulse lane:
  - `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`
  - `docs/sops/sop_ai_studio_agent.md`
  - `docs/sops/sop_ai_studio_pulse_mode.md`
  - `docs/adr/0061-ai-studio-standard-vs-pulse-runtime-isolation-contract.md`
  - `docs/adr/0071-ai-studio-create-mode-owned-runtime-roots.md`

Load retained artifacts only when the task asks for training history, report evidence, or a prior run packet.

## Run Workflow

1. Identify whether the task is Standard-mode behavior, Pulse-mode behavior, Standard/Pulse boundary work, `/admin/agent-instructions` Standard control-plane work, docs-only ownership cleanup, or an out-of-lane request.
2. Confirm the owning source path before deciding. Use current code, current docs, and direct validation evidence over memory or old reports.
3. Keep the work to one concrete behavior, boundary, or docs-governance problem statement at a time.
4. Preserve Standard/Pulse runtime isolation across prompts, hidden context, route payloads, transcript/session state, persistence fields, artifact targets, and response parsing.
5. Make source fixes at the canonical owner instead of adding compatibility switches, alternate routes, fallback payloads, or duplicate behavior paths.
6. Validate the specific boundary touched with targeted tests, docs checks, or production-URL manual validation when the task concerns deployed behavior.
7. Update Pulse memory only for durable lessons that should affect future Pulse runs. Use retained reports for evidence-heavy run details.

## Stop Rules

Stop and ask for human review when:

- Standard versus Pulse product intent is unclear.
- The work would change UI/UX, intended functionality, hidden instruction semantics, artifact target routing, safety posture, billing/credit behavior, persistence boundaries, or production launch posture without explicit approval.
- The task expands into broad Create refactors, another admin page, security, environment/deploy, commit/push/release, or another agent's ownership lane.
- Production validation, credentials, provider access, or release operations are required but unavailable or outside Pulse's lane.
- Further work would mostly create paperwork, speculative docs, or low-ROI cleanup.

## Closeout

Close with:

- the source path or authority surface changed,
- the Standard/Pulse boundary considered,
- validation performed or still missing,
- whether the result is local, repo-durable, or production-verified,
- and the next proof boundary if readiness is not fully proven.
