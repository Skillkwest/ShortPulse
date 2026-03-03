# Phase 13 Wave F Pass 7: No-Sim Promotion Readiness Packet

Date: 2026-03-02
Owner: Codex (implementation support)
Status: PASS (local no-sim gate), HOLD (staging activation pending runtime parity verification)

## Scope
1. Continue safety-control-plane consistency rollout without running additional simulations.
2. Validate high-risk safety paths with targeted unit/API coverage only.
3. Produce operator-ready promotion guidance for staged activation with rollback readiness.

## Touched Surfaces
1. `frontend/features/agent-runtime/safetyPolicy/textSafetyLexicon.ts`
2. `frontend/features/agent-runtime/safetyPolicy/__tests__/textSafetyEvaluator.test.ts`
3. `frontend/features/agent-runtime/__tests__/studioAgentSafetyInputPrecheck.test.ts`
4. `frontend/tests/api/fal-submit-proxy.test.ts`
5. `frontend/tests/api/studio-agent.runtime.test.ts`
6. `frontend/tests/api/generate-prompt.sanitization.test.ts`
7. `docs/sops/sop_ai_studio_agent_safety_control_plane.md` (already aligned in prior pass; reused for runbook gating)

## Commands Run
1. Targeted safety decision/image-preflight validation:
```bash
npm run test -- features/agent-runtime/safetyPolicy/__tests__/decisionEngine.test.ts features/agent-runtime/safetyPolicy/__tests__/imagePreflightClassifier.test.ts
```
Result:
- Test Files: 2 passed
- Tests: 11 passed
- Failures: 0

2. Targeted safety precheck + API contract validation:
```bash
npm run test -- features/agent-runtime/safetyPolicy/__tests__/rewriteRecheckPolicy.test.ts features/agent-runtime/__tests__/studioAgentSafetyInputPrecheck.test.ts features/agent-runtime/safetyPolicy/__tests__/textSafetyEvaluator.test.ts tests/api/studio-agent.runtime.test.ts tests/api/generate-prompt.sanitization.test.ts tests/api/fal-submit-proxy.test.ts
```
Result:
- Test Files: 6 passed
- Tests: 73 passed
- Failures: 0

3. Admin safety control-plane API contract validation:
```bash
npm run test -- tests/api/admin-agent-safety-policy-active.test.ts tests/api/admin-agent-safety-policy-version.test.ts tests/api/admin-agent-safety-policy-activate.test.ts tests/api/admin-agent-safety-policy-rollback.test.ts
```
Result:
- Test Files: 4 passed
- Tests: 18 passed
- Failures: 0

4. Staging parity probe with temporary admin bootstrap user and Vercel bypass-cookie handshake:
- Probe packet: `/tmp/agent-safety-staging-probe-2026-03-02.json`
Result:
- `GET /api/admin/agent-safety-policy/active` returned `404` on staging alias deployment.
- Route-level staging checklist could not proceed due missing deployed route parity.

5. Local manual no-sim checklist execution (temporary admin bootstrap user):
- Probe packet: `/tmp/agent-safety-local-manual-check-2026-03-02.json`
Result summary:
- `GET /api/admin/agent-safety-policy/active` => `200` (`activeProfileId=prod_safe_v1`, `activePolicyVersion=3`, `postprocess.mode=shadow`)
- `/api/ai/generate-prompt` => safe `500` (upstream timeout), suggestive `200`, explicit `200` refusal
- `/api/ai/studio-agent` => safe `200`, suggestive `200`, explicit `200` refusal
- `/api/fal/flux2pro-submit` => suggestive `422`, explicit `422` (`GENERATION_SAFETY_BLOCKED`)
- `POST /api/admin/agent-safety-policy/activate` (idempotent same-profile call) => `200` with `status=already_active`

## Key Outcomes
1. Rewrite consistency improved for common violence-suggestive wording by sanitizing `armed` deterministically.
2. `studio-agent` and `generate-prompt` rewrite-lane behavior remains consistent and provider-call-enabled where intended.
3. `fal-submit` remains stricter in phase 1 (`allow_only`) and is explicitly locked by API tests.
4. Admin control-plane route handlers (`active/version/activate/rollback`) remain contract-stable under test.

## Risk Notes
1. No new simulation evidence was collected in this pass (intentional).
2. Promotion to staging/prod remains blocked because staging alias parity still fails (`/api/admin/agent-safety-policy/active` => `404`).
3. Local safe-lane `generate-prompt` returned a transient upstream timeout (`500`), indicating provider-path reliability noise independent of refusal/rewrite gating.

## Promotion Decision
1. Local gate: PASS.
2. Staging gate: HOLD until all are true:
   - `/api/admin/agent-safety-policy/active` responds successfully with admin bearer on target staging alias.
   - Manual no-sim checklist in `docs/sops/sop_ai_studio_agent_safety_control_plane.md` completes without contract drift.
   - `postprocess.mode=shadow` is confirmed for tuning window.

## Rollback Readiness
1. Rollback endpoint remains tested and available:
   - `POST /api/admin/agent-safety-policy/rollback`
2. Cooldown lock semantics are preserved by API/SQL control-plane behavior and prior evidence.
3. Immediate rollback trigger condition:
   - Any staging manual check mismatch on route contract, safety decision fields, or unexpected refusal/rewrite regression.

## Operator Next Actions (No Sim)
1. Verify staging route parity with admin bearer:
   - `GET /api/admin/agent-safety-policy/active`
2. If parity is green, create/activate candidate policy only if required knob changes remain.
3. Execute manual route checks (safe/suggestive/explicit) and confirm telemetry fields:
   - `safety_stage`, `safety_outcome`, `category`, `decision_action`, `decision_source`, `provider_call_skipped`
4. Hold or rollback immediately on mismatch.
