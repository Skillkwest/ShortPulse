# Enate Ende Ownership Manifest

Purpose: define exactly which surfaces belong to Enate Ende directly and which nearby surfaces remain shared or out of scope.

## Directly Owned By Enate Ende

These are Enate Ende's canonical identity, instruction, memory, and retained-artifact surfaces:

- `docs/agents/enate-ende/README.md`
- `docs/agents/enate-ende/AGENTS.md`
- `docs/agents/enate-ende/standard-operating-procedure.md`
- `docs/agents/enate-ende/memory.md`
- `docs/agents/enate-ende/ownership-manifest.md`
- `docs/agents/enate-ende/canvas-command-index.md`
- `docs/agents/enate-ende/workspace/*`
- `docs/records/artifacts/agent/enate-ende/*`

## Shared But Approved For Enate Ende Implementation Lanes

These remain shared product/runtime surfaces even though Enate Ende may edit them during a scoped Canvas task:

- `frontend/features/ai-studio/components/canvas/*`
- `frontend/features/ai-studio/logic/sessionSnapshotCanvas.ts`
- `frontend/features/ai-studio/logic/canvasMediaDisplayAuthority.ts`
- Canvas-specific tests under `frontend/features/ai-studio/components/canvas/__tests__/`
- Canvas-related logic tests under `frontend/features/ai-studio/logic/__tests__/`
- shared right-rail contract docs such as `docs/adr/0049-ai-studio-right-rail-surface-ownership-and-media-resolution-contract.md`

## Explicitly Not Enate Ende-Owned Yet

These may become adjacent later, but they are not part of Enate Ende's current authority:

- `Quick Slot Inventory`
- `Reference Grid`
- broader right-rail cross-surface policy work that is not necessary for the current Canvas lane
- non-Canvas AI Studio surfaces
- other agent folders and retained artifact areas
- security, secrets, auth/session risk, RLS, and storage policy work
- Supabase, Vercel, environment ladder, deployment posture, commits, pushes, PRs, and release operations
- launch-readiness scoring, system catalog posture, and prioritized launch handoff queue

## Handoff Map

- Quick Slot Inventory or Reference Grid ownership: Holomony unless the user explicitly expands Enate Ende's lane.
- Project persistence, restore, and hydration: Datserok.
- Media optimization/display performance outside Canvas-owned presentation: Holomony or Gutan, depending on the source boundary.
- Security: Dave the Security Guy.
- Environment, Supabase, Vercel, and deployment posture: Nuclo.
- Commit, push, PR, and release execution: Gear Ball.
- Launch-readiness scoring and queue posture: Copperknot.

## Move Rule

Move a file into Enate Ende space only when all of the following are true:

1. it defines Enate Ende behavior, memory, SOPs, or Enate Ende-only helper material
2. it is not a shared product/runtime file
3. it is not owned by another agent's contract or artifact history
4. keeping it outside Enate Ende space would create ambiguity about Enate Ende's operating package

## Authority Rules

- Current code and canonical docs outrank Enate Ende memory and retained artifacts.
- Retained artifacts are evidence and training continuity, not default runtime authority.
- Launch-relevant Enate Ende claims must satisfy `docs/agents/solo-owner-launch-trust-standard.md`.
- Local fixes are not production-verified readiness until production proof exists.
