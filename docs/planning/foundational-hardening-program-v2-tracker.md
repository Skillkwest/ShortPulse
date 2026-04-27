# Foundational Hardening Program v2 Tracker

Last updated: 2026-02-25  
Branch: `audit-properties-panels`

## Objective
Track execution of "Default Model First, Reliability Delta Second" with minimal diffs, no architecture bloat, and strict regression gates.

## Current Status
1. Workstream A (Default-model foundation): `COMPLETED`
2. Workstream B (Reliability delta hardening): `COMPLETED`
3. Workstream C (Safety-policy track): `COMPLETED`

## Completed Baseline (A/B)
Implemented in commit `61800c15` (`feat(ai-studio): harden default model policy and reliability deltas`).

### Workstream A checklist
1. A1 Canonical create model policy module: `DONE`
2. A2 Unified filtering and validity policy path: `DONE`
3. A3 Regression tests for startup precedence and restore behavior: `DONE`
4. A4 Docs and ADR sync: `DONE`

Key artifacts:
1. `frontend/features/ai-studio/logic/modelSelectionPolicy.ts`
2. `docs/adr/0025-ai-studio-create-startup-model-precedence.md`
3. `docs/sops/sop_ai_studio_index.md`
4. `docs/sops/sop_image_generation.md`

### Workstream B checklist
1. B1 Fast-path parse/body exception normalization: `DONE`
2. B2 Thinker/formatter parse/body exception normalization: `DONE`
3. B3 Residual reliability regression coverage: `DONE`
4. B4 Ops docs + evidence delta: `DONE`

Key artifacts:
1. `frontend/features/agent-runtime/studioAgentFastPathTurn.ts`
2. `frontend/features/ai-agent/logic/studioAgentThinkerFormatter.ts`
3. `frontend/tests/api/studio-agent.runtime.test.ts`
4. `frontend/features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`
5. `docs/records/evidence/agent/phase-5/2026-02-24-phase-5-default-model-foundation-and-reliability-delta-closeout.md`
6. `docs/sops/sop_ai_studio_agent.md`
7. `docs/sops/sop_ai_studio_agent_chat_ops.md`
8. `docs/change_log.md`

## Workstream C Closeout (Safety-policy track)
1. C1 Official-doc verification: `DONE` (see evidence note below).
2. C2 Runtime safety parameter alignment: `DONE`.
3. C3 Safety payload regression coverage: `DONE`.
4. C4 Contract/docs/changelog synchronization: `DONE`.

Closeout artifacts:
1. `frontend/features/ai-studio/hooks/taskSubmission/safetyPolicy.ts`
2. `frontend/features/ai-studio/hooks/taskSubmission/__tests__/safetyPolicy.test.ts`
3. `frontend/features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts`
4. `frontend/lib/model-runtime/modelCatalog.ts`
5. `docs/records/evidence/agent/phase-5/2026-02-25-phase-5-safety-policy-verification-closeout.md`
6. `docs/change_log.md`

## Guardrails
1. One concern per PR.
2. No route contract version changes.
3. No broad architectural refactor.
4. Keep retry/fallback user-lane policy behavior unchanged.

## Gate Policy
Run for each C-track PR:
1. `npm -C frontend run type-check`
2. `npm -C frontend run lint`
3. `npm -C frontend run test`
4. `npm -C frontend run build`

## Definition of Done for Program v2
1. Workstreams A and B remain green under full gates.
2. Workstream C is completed with model-by-model safety parameter verification and docs/tests in sync.
3. No regression in fallback/refusal/error lane behavior.
