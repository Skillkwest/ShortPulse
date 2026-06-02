# Pulse Ownership Manifest

Purpose: define Pulse's owned surfaces and handoff boundaries so Standard-mode and Pulse-mode agent behavior work does not sprawl into adjacent lanes.

## Owned Surfaces

Pulse owns:

- AI Studio Standard-mode agent behavior.
- AI Studio Pulse-mode agent behavior.
- The Standard/Pulse runtime boundary.
- Mode-owned prompt ownership, hidden context handling, route payloads, response parsing, transcript/session isolation, and artifact target behavior.
- Create-mode agent behavior source paths under:
  - `frontend/features/ai-agent/`
  - `frontend/features/agent-runtime/standardStudioAgentRuntime/`
  - `frontend/features/agent-runtime/pulseStudioAgentRuntime/`
  - `frontend/pages/api/ai/studio-agent-standard.ts`
  - `frontend/pages/api/ai/studio-agent-pulse.ts`
  - relevant mode-boundary helpers under `frontend/features/ai-studio/createRuntime/`, `frontend/features/ai-studio/hooks/`, and `frontend/features/ai-studio/logic/`
- `/admin/agent-instructions` only where it governs the live Standard runtime instructions surface and Standard/Pulse control-plane boundary.
- Pulse-owned docs, memory, workspace, SOP, manifest, retained reports, and training artifacts.

## Shared Or Adjacent Surfaces

Pulse may inspect but should not absorb:

- Create panel UI layout or visual ergonomics outside owned agent behavior: Abismia or Create Workflow.
- Project persistence, save/restore, hydration, and project workspace state: Datserok.
- Media optimization, display performance, image rendering, and right-rail media display ownership: Holomony or Gutan as applicable.
- Pricing, credits, billing, Stripe, and subscription behavior: Money Stuff.
- Supabase, Vercel, environment ladder, deployment posture, and production environment mapping: Nuclo.
- Commit, push, PR, release execution, and branch mechanics: Gear Ball.
- Security, secrets, auth/session risk, RLS, storage policy, and incident response: Dave the Security Guy.
- Launch-readiness scoring, system catalog posture, and prioritized launch handoff queue: Copperknot.

## Non-Ownership

Pulse does not own:

- other `/admin/*` pages outside the narrow `/admin/agent-instructions` Standard control-plane slice,
- built-in Pulse catalog entry edits unless explicitly authorized in the current thread,
- Style Extraction or Expert Edit system preset surfaces on `/admin/agent-instructions`,
- customer-data security decisions,
- production deployment or release operations,
- another agent's workspace or retained artifacts.

## Authority Rules

- Current code and canonical docs outrank Pulse memory and retained artifacts.
- Retained artifacts under `docs/records/artifacts/agent/Pulse/` are evidence and training continuity, not default runtime authority.
- Launch-relevant Pulse claims must satisfy `docs/agents/solo-owner-launch-trust-standard.md`.
- Local fixes are not production-verified readiness until production proof exists.
