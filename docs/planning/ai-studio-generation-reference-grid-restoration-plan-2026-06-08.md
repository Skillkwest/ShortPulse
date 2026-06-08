# AI Studio Generation Reference Grid Restoration Plan

Status: Active implementation source for the June 8, 2026 lane.

## Objective

Accepted provider generations must be durable Reference Grid work items. After
refresh, navigation away and back, closing ShortPulse, switching projects, or
returning to a plain session, AI Studio must rehydrate in-flight and completed
generated outputs from server authority instead of depending on browser memory.

## Source Of Truth

- Canonical read model: `public.generation_projection`.
- Project route binding: `generation_projection.project_id` plus
  `public.project_generation_items`.
- Plain-session binding: a bounded `generation_projection.workspace_runtime_key`
  derived from the current AI Studio base runtime authority, such as
  `session:<sid>`.
- Right-rail authority: `docs/adr/0083-create-mode-global-right-rail-authority.md`.
- Recovery authority: `docs/sops/sop_generation_recovery_diagnostics.md`.

## Owner / Lane

ShortPulse AI Studio generation recovery and workspace-global right-rail
persistence. This lane owns the schema, server projection writes, client
hydration, and targeted documentation needed to restore generated outputs into
the Reference Grid.

## Approved Scope

1. Add additive SQL support for `generation_projection.workspace_runtime_key`.
2. Thread the bounded workspace runtime key from AI Studio generation submit
   paths into provider route metadata.
3. Persist the workspace binding through shared projection writes for Fal/Kie
   routes, including Kie GPT Image 2 text-to-image
   (`/api/fal/kie-gpt-image-2-submit`) and Kie GPT Image 2 image-to-image
   (`/api/fal/kie-gpt-image-2-edit-submit`), OpenAI image, ElevenLabs
   audio/video, direct settlement, and recovery.
4. Hydrate generated outputs by project id or workspace runtime key without
   re-enabling user-global plain-session startup hydration.
5. Add/update regression tests for server projection writes, generated-output
   authority queries, and AI Studio maintenance/bootstrap behavior.
6. Update docs that define generation recovery, project/plain-session restore,
   and schema/security posture.

## Out Of Scope

- UI redesigns or copy changes.
- Changing launch, branch, commit, push, deployment, or production runtime
  posture.
- Reintroducing legacy `sid` snapshot persistence.
- User-global generated-output startup hydration for plain sessions.
- Browser-only localStorage/sessionStorage recovery as a substitute for server
  authority.
- Broad generation pipeline refactors not required for the binding and
  hydration contract.

## Proof Requirements

Minimum local proof before closeout:

- Targeted Vitest coverage for:
  - `useAiStudioGeneratedOutputMaintenance`
  - `useAiStudioState.outputStoreBridge`
  - `generatedMediaAuthority`
  - `generationProjection`
  - touched Fal/Kie, OpenAI, ElevenLabs, direct settlement, and recovery seams
- `npm -C frontend run type-check`
- `npm -C frontend run lint`
- `npm -C frontend run docs:check`
- `npm -C frontend run build`

Production proof on `https://www.shortpulse.ai` is required before claiming
deployed behavior, but it is outside this local implementation lane unless a
separate deploy/production validation instruction is given.

## Stop Conditions

Stop immediately if:

- The implementation requires user-global plain-session generated-output
  hydration.
- A provider family cannot receive or preserve the workspace/project binding
  through the shared submit/projection path without a larger owner decision.
- The schema change cannot stay additive.
- Validation shows project/session output leakage or unsafe cross-user access.
- Remaining work requires commit, push, deploy, production migration, or
  production validation outside the current lane.
