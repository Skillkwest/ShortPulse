# Seedream Shadow Parity Report

Date: 2026-05-06  
Owner: AI Studio Engineering  
Program: 1 (Runtime And Money)  
Status: published

## Purpose
Publish the Runtime V2 Seedream shadow parity packet for the active closeout lane.

This report separates:
1. repo-backed readiness evidence that is already verifiable locally, from
2. live staging shadow-window evidence that still must be collected before canary signoff.

It does not claim that the full plan is complete.

## Scope
In scope:
- Seedream-only Runtime V2 closeout readiness
- Fal submit/status/webhook/recovery/settlement no-regression evidence
- active runtime-doc and runbook parity needed before staging shadow
- the remaining live-shadow evidence gap before canary

Out of scope:
- 72-hour canary signoff
- broader Kie migration history from unified buildout Phase 11
- non-Seedream model-family rollout decisions

## Current Conclusion
Repo-backed readiness is green enough to proceed to a Seedream staging shadow window.

What is true now:
- the shared Runtime V2 recovery and settlement path is implemented and locally regression-tested
- active runtime/docs/runbooks align with the live Fal-only webhook and admission contracts
- the strongest local Fal no-regression gate currently in the repo passes

What is not yet true:
- no in-repo staging shadow-window observation output is attached for the current Runtime V2 Seedream lane
- the 72-hour Seedream canary gate has not been executed
- the full Seedream Runtime V2 preview env set has not yet been confirmed from the current staging preflight inventory
- live shadow/canary execution is intentionally deferred while work remains on the current branch only

## Repo-Backed Evidence

### 1. Active runtime contract and rollout docs
- `docs/planning/ai-studio-generation-runtime-v2-locked-execution.md`
- `docs/planning/ai-studio-runtime-v2-recovery-execution-phase.md`
- `docs/planning/ai-studio-runtime-v2-staging-execution-checklist.md`

These three docs now agree on the active closeout sequence:
- Seedream shadow parity first
- Seedream-only canary second
- no legacy HMAC webhook fallback in the active runtime contract

### 2. Runtime code authority surfaces
- `frontend/lib/server/api/falSubmitProxy.ts`
- `frontend/lib/server/api/falRuntimeFlags.ts`
- `frontend/lib/server/falIntegration/recoveryExecution.ts`
- `frontend/lib/server/api/falWebhook.ts`
- `frontend/pages/api/fal/webhook.ts`

These surfaces now reflect the intended Runtime V2 posture:
- Fal-only webhook verification on JWKS/Ed25519
- server-authoritative recovery and settlement convergence
- admission control and shared-provider backpressure in the active submit path
- Seedream-first shadow/canary rollout via integration mode and allowlist controls

### 3. Local regression gate
Executed on 2026-05-06:

```bash
cd frontend
npm run test:phase11:fal-regression
```

Result:
- `13` test files passed
- `148` tests passed

This remains the strongest local Fal no-regression suite currently available in the repo for:
- `/api/fal/*` route inventory stability
- submit/status proxy behavior
- provider probe/runtime convergence
- recovery execution/runtime behavior
- provider integration status parsing/policy seams

### 4. Docs and operator parity gate
Executed on 2026-05-06:

```bash
cd frontend
npm run docs:check
```

Result:
- documentation links passed
- semantic drift checks passed
- migration/doc parity passed
- archive manifest passed
- model catalog parity passed
- naming canonical drift passed
- operator map drift passed

### 5. Active operational guidance is aligned
The live operator guidance now reflects:
- Fal-only webhook verification
- `off|enforce` admission mode
- shared-provider admission interpretation
- recovery-lag backpressure interpretation

Primary operational references:
- `docs/sops/sop_provider_incident_response.md`
- `docs/sops/sop_generation_recovery_diagnostics.md`
- `docs/monitoring.md`
- `docs/operator-map.md`

## Live Shadow Evidence Still Required
The missing evidence is the actual Seedream staging shadow-window output from the Runtime V2 checklist.

Required sources:
- `docs/planning/ai-studio-runtime-v2-staging-execution-checklist.md` Step 8
- staging SQL/editor outputs for:
  - duplicate captured settlement count
  - duplicate media persistence count
  - stuck-running snapshot
  - unresolved `terminal_success_no_media` backlog

This report is therefore a published readiness/parity packet, not a claim that the live shadow window has already been observed and passed.

Current preflight blocker note:
- `docs/planning/evidence/runtime-v2/2026-05-06-seedream-shadow-staging-preflight-env-check.md`

Operator-ready execution checklist:
- `docs/planning/evidence/runtime-v2/2026-05-06-seedream-shadow-operator-handoff-checklist.md`

## Decision
Decision: `READY_FOR_STAGING_SHADOW`

Reasoning:
1. The runtime contract is implemented and aligned in code/docs.
2. The strongest local Fal regression gate is green.
3. The next missing proof is operational window evidence, not another repo-internal cleanup lane.

## Required Next Steps
1. Run the Seedream staging shadow window using the env posture in `docs/planning/ai-studio-runtime-v2-staging-execution-checklist.md`.
2. Capture and attach the Step 8 SQL outputs to this namespace as a dated follow-up packet or live log.
3. If shadow stays clean, switch to `SHORTPULSE_FAL_INTEGRATION_MODE=on` with Seedream-only allowlist and begin the 72-hour canary gate.
4. Keep the plan open until the canary item is also complete.

## Current Branch Constraint
Current operator decision:
- do not execute the live Seedream staging shadow or canary steps from this branch-only lane
- resume those steps only after this branch is pushed, merged, and intentionally promoted into an environment where staging execution is appropriate
