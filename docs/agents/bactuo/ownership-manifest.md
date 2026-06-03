# Bactuo Ownership Manifest

Purpose: define exactly which repo surfaces Bactuo owns directly, which shared generation surfaces Bactuo may modify when asked, and which adjacent lanes stay outside Bactuo ownership.

## Directly Owned By Bactuo

Bactuo owns these local operating surfaces:

- `docs/agents/bactuo/README.md`
- `docs/agents/bactuo/AGENTS.md`
- `docs/agents/bactuo/memory.md`
- `docs/agents/bactuo/standard-operating-procedure.md`
- `docs/agents/bactuo/ownership-manifest.md`
- `docs/agents/bactuo/generation-recovery-settlement-source-map.md`
- `docs/agents/bactuo/generation-architecture-consolidation-plan-2026-06-03.md`
- `docs/agents/bactuo/workspace/`
- `docs/records/artifacts/agent/bactuo/README.md`
- `docs/records/artifacts/agent/bactuo/training-history.md`
- `docs/records/artifacts/agent/bactuo/run-log.md`
- `docs/records/artifacts/agent/bactuo/tools.md`
- `docs/records/artifacts/agent/bactuo/reports/`

## Product Surfaces Bactuo May Modify When Asked

Bactuo may modify these shared surfaces only for generation lifecycle, recovery, canonical output persistence, or request-scoped settlement work:

- `frontend/lib/server/api/falSubmitProxy.ts`
- `frontend/lib/server/api/falStatusProxy.ts`
- `frontend/lib/server/api/directGenerationSettlement.ts`
- `frontend/lib/server/api/falStatusPersistedResults.ts`
- `frontend/lib/server/api/terminalConvergenceViewSync.ts`
- `frontend/lib/server/api/generationOutputs.ts`
- `frontend/lib/server/api/generationAbandonment.ts`
- `frontend/lib/server/api/generationBilling/`
- `frontend/lib/server/falIntegration/`
- `frontend/lib/server/generationControlPlane/`
- `frontend/lib/server/openaiImageGeneration.ts`
- `frontend/lib/server/elevenlabs.ts`
- `frontend/pages/api/openai/image-generate.ts`
- `frontend/pages/api/elevenlabs/text-to-speech.ts`
- `frontend/pages/api/elevenlabs/music.ts`
- focused tests for the affected generation seam
- current generation docs, SOPs, and ADRs when the shipped contract changes

## Shared But Not Bactuo-Owned

These surfaces may depend on generation behavior but are not Bactuo-owned:

- pricing policy, subscription plans, entitlements, and Stripe account-level commerce authority;
- security, privacy, auth/session risk, RLS/storage security, and secrets;
- Vercel, Supabase environment topology, hosted deployment posture, and production cutover;
- branch, commit, push, release, and GitHub execution;
- generalized AI Studio UX/layout stewardship outside generation-owned runtime behavior;
- project persistence, project workspace state, and project ownership authority;
- media-display optimization and adaptive/delivery-performance authority;
- launch-readiness scoring, system catalog interpretation, and queue-level prioritization.

## Handoff Owners

- Money Stuff: pricing policy, plans, subscriptions, entitlements, and non-generation commerce decisions.
- Dave the Security Guy: security, privacy, auth, secrets, RLS/storage risks, and attack-surface signoff.
- Nuclo: Vercel, Supabase, environment topology, production URL posture, and hosted cutover.
- Gear Ball: branch posture, commits, pushes, releases, and GitHub execution.
- Abismia or Create Workflow: broader AI Studio UX or workflow intent outside generation-owned lifecycle behavior.
- Datserok: project persistence, save/restore, and project-owned workspace authority.
- Holomony: media display, preview/full-quality delivery, and right-rail media performance.
- Copperknot: readiness scoring, launch priority, and queue-level interpretation.

## Move Rule

Move a file into Bactuo space only when all of the following are true:

1. it defines Bactuo behavior, memory, retained training, reports, tools, source mapping, or temporary generation working drafts;
2. it is not shared product/runtime code;
3. it is not owned by another agent contract;
4. keeping it outside Bactuo would create ambiguity about the generation operating package.
