# Datserok Ownership Manifest

Purpose: define exactly which repo surfaces Datserok owns directly, which shared project-persistence surfaces Datserok may modify when asked, and which adjacent lanes stay outside Datserok ownership.

## Directly Owned By Datserok

Datserok owns these local operating surfaces:

- `docs/agents/datserok/README.md`
- `docs/agents/datserok/AGENTS.md`
- `docs/agents/datserok/memory.md`
- `docs/agents/datserok/standard-operating-procedure.md`
- `docs/agents/datserok/ownership-manifest.md`
- `docs/agents/datserok/project-persistence-source-map.md`
- `docs/agents/datserok/workspace/`
- `docs/records/artifacts/agent/datserok/README.md`
- `docs/records/artifacts/agent/datserok/training-history.md`
- `docs/records/artifacts/agent/datserok/run-log.md`
- `docs/records/artifacts/agent/datserok/tools.md`
- `docs/records/artifacts/agent/datserok/reports/`

## Product Surfaces Datserok May Modify When Asked

Datserok may modify these shared surfaces only for project persistence, project save/restore, project workspace, project association, or project UX authority work:

- project API routes under `frontend/pages/api/projects/`
- project server helpers under `frontend/lib/server/projectApiRoutes/`
- `frontend/lib/server/projectWorkspaceStatesService.ts`
- `frontend/lib/server/projectGenerationAssociationsService.ts`
- project identity, restore, and persistence hooks under `frontend/features/ai-studio/hooks/`
- project workspace API and persistence logic under `frontend/features/ai-studio/logic/`
- dashboard and AI Studio project entrypoints when the change is project-persistence-owned
- focused tests for the affected persistence seam
- current project persistence SOPs and ADRs when the shipped contract changes

## Shared But Not Datserok-Owned

These surfaces may depend on project persistence but are not Datserok-owned:

- Reference Grid, Quick Slot Inventory, Canvas, and media-display performance authority;
- media ingestion, admitted derivatives, upload normalization, and provider image-size admission;
- Standard/Pulse runtime semantics, prompt/composer behavior, and conversational agent behavior;
- billing, credits, entitlements, pricing, and payment flows;
- security, privacy, auth/session risk, RLS/storage security, and secrets;
- Vercel, Supabase environment topology, hosted deployment posture, and production cutover;
- branch, commit, push, release, and GitHub execution;
- Copperknot readiness scores, launch priorities, and handoff queue authority.

## Handoff Owners

- Holomony: media display, right-rail surfaces, adaptive preview, performance, and detail-modal media behavior.
- Gutan: media ingestion normalization, admitted derivatives, image-size limits, and provider-reference admission.
- Create Workflow or Pulse: Create/Pulse runtime semantics, composer behavior, and workflow-specific agent behavior.
- Money Stuff: billing, credits, plans, entitlements, Stripe, and payment-readiness issues.
- Dave the Security Guy: security, privacy, auth, secrets, RLS/storage risks, and attack-surface signoff.
- Nuclo: Vercel, Supabase, environment topology, production URL posture, and hosted cutover.
- Gear Ball: branch posture, commits, pushes, releases, and GitHub execution.
- Copperknot: readiness scoring, launch priority, and queue-level interpretation.

## Move Rule

Move a file into Datserok space only when all of the following are true:

1. it defines Datserok behavior, memory, retained training, reports, tools, source mapping, or temporary project-persistence working drafts;
2. it is not shared product/runtime code;
3. it is not owned by another agent contract;
4. keeping it outside Datserok would create ambiguity about the project-persistence operating package.
