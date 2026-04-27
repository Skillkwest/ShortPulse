# Phase 5 Evidence: Prompt-Only Single-Stage Runtime Readiness

Date: 2026-02-24  
Operator: @codex  
Program: AI Studio Agent Hardening + Modularization  
Scope: prompt-only single-stage runtime cutover readiness packet

## Release Context
- Commit (phase 1): `fe8fdab4`  
  `agent-runtime: normalize safety refusals and enforce prompt-only action shaping`
- Commit (phase 2): `f089c1c6`  
  `agent-runtime: promote single-stage canonical path with legacy fallback flag`
- Commit (phase 3): `babf343d`  
  `agent-runtime: adopt prompt-only system contract and document rollout governance`
- Commit (phase 4): `e663a61f`  
  `agent-runtime: classify telemetry outcomes for rollout observability`
- Commit (phase 5): `79eb1861`  
  `agent-prompts: trim formatter contract to apply-prompt only`
- Commit (phase 6): `dc214a1c`  
  `agent-runtime: canonicalize context type to agent-output`
- Commit (phase 7): `c53b3c50`  
  `agent-runtime: harden safety error classification and non-safety regression coverage`
- Commit (phase 8): `f1df08a2`  
  `agent-runtime: add rollback lever path verification tests`

## Runtime Flag Plan
- `STUDIO_AGENT_SINGLE_STAGE_ENABLED=true` (target default for rollout)
- `STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED=false` (target default for rollout)
- `STUDIO_AGENT_TEXT_FAST_PATH_ENABLED=true` (legacy-path compatibility flag; only relevant when single-stage is disabled)

Rollback posture:
1. First rollback lever: `STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED=true`
2. Second rollback lever: `STUDIO_AGENT_SINGLE_STAGE_ENABLED=false`
3. Preserve canonical continuity behavior and contract version unchanged while toggling flags.

## Verification Summary
All checks executed on local head after phase commits:

1. Contract suite:
   - Command: `npm run test:agent:contract`
   - Result: pass
2. Disable/continuity suite:
   - Command: `npm run test:agent:disable-continuity`
   - Result: pass
3. Runtime-focused suites:
   - Command: `npm run test -- tests/api/studio-agent.runtime.test.ts`
   - Result: pass
4. Runtime unit suites:
   - Command: `npm run test -- features/agent-runtime/__tests__/studioAgentRouteOutcomes.test.ts features/agent-runtime/__tests__/studioAgentTurnResponse.test.ts features/agent-runtime/__tests__/studioAgentResponseNormalization.test.ts`
   - Result: pass
5. Lint:
   - Command: `npm run lint`
   - Result: pass
6. Build:
   - Command: `npm run build`
   - Result: pass
7. Architecture boundaries:
   - Command: `node scripts/check_architecture_boundaries.js`
   - Result: pass
8. Size budgets:
   - Command: `node scripts/check_size_budgets.js`
   - Result: pass

## Promotion Gate Alignment
Readiness status for Phase 5 ring progression:

1. Contract/continuity gates: ready
2. Build/lint integrity: ready
3. Rollback controls documented: ready
4. Safety/refusal contract behavior:
   - Safety-policy upstream failures map to normal refusal turns (`200`) with empty actions.
   - Non-safety upstream auth/config failures remain transport errors (do not map to refusal).
   - Refusal copy standardized to `I cannot describe this.`
5. Rollback-lever verification:
   - Test coverage asserts `legacy_v2_fallback` path when lever 1 is enabled.
   - Test coverage asserts `v2_orchestration` path when lever 2 disables single-stage.
   - Safety refusals short-circuit and do not execute legacy fallback.
6. Compatibility posture:
   - External contract remains `Agent-Contract-Version: 1`
   - Canonical prompt persistence behavior unchanged

## Notes For Staging Ring Operator
1. Start ring with `STUDIO_AGENT_SINGLE_STAGE_ENABLED=true` and `STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED=false`.
2. If latency or semantic quality regresses, enable legacy fallback before disabling single-stage.
3. Collect ring metrics and attach to the active rollout report and tracker ring table.

## Pre-User MVP Note
When the product has no external users/live traffic, production canary rings may be deferred under explicit waiver.

Waiver artifact:
- `docs/records/evidence/agent/phase-5/2026-02-24-phase-5-pre-user-mvp-rollout-waiver.md`

Reactivation trigger:
1. First external-user onboarding or first sustained production traffic cohort.
2. Resume `5% -> 25% -> 50% -> 100%` ring progression and replace waiver rows with live metrics.
