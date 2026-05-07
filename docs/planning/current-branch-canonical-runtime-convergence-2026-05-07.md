# Current-Branch Canonical Runtime Convergence

Status: complete  
Program: Program 1 - Runtime And Money  
Last updated: 2026-05-07  
Branch scope: `working-development` only

## Purpose
Freeze one branch-local runtime contract before removing legacy, shadow, fallback, queue-era, or dead config posture from active docs and code.

This document is the current authority for the cleanup lane described as:
- one canonical live runtime path
- no active-doc dependence on retired rollout posture
- smaller active env/config surface
- only justified production controls and justified temporary mitigations remain

## Non-goals
- staging execution or canary work
- runtime redesign
- deleting live resilience paths without branch proof
- fixing unrelated product defects
- deleting historical evidence unless it actively misstates the current branch contract

## Authority order
When sources disagree, use this order:
1. current branch runtime code
2. mounted route files on this branch
3. active env/config templates
4. active deploy/SOP/operator docs
5. ADRs
6. planning/history artifacts

## Frozen branch contract

### 1. Canonical generation submit path
Standard Fal submit is direct provider submit through the mounted `/api/fal/*-submit` routes and the shared submit proxy.

Authority:
- `frontend/pages/api/fal/*-submit.ts`
- `frontend/lib/server/api/falSubmitProxy.ts`

Implication:
- old queue-first or integration-mode rollout framing is not the active submit contract on this branch

### 2. Canonical status/read path
Status reads are provided by the mounted `/api/fal/*-status` routes and the shared status proxy/runtime helpers.

Authority:
- `frontend/pages/api/fal/*-status.ts`
- `frontend/lib/server/api/falStatusProxy.ts`
- `frontend/lib/server/falIntegration/statusProxyRuntime.ts`

Branch note:
- no active `frontend/pages/api/fal/queue-status.ts` route file is mounted on this branch
- older queue-status references are historical compatibility posture unless reintroduced by code, which is not the case in the current branch inventory

### 3. Canonical webhook posture
Fal webhook ingress is mounted at `/api/fal/webhook` and verifies Fal signatures directly in the route/runtime code.

Authority:
- `frontend/pages/api/fal/webhook.ts`
- `frontend/lib/server/api/falWebhook.ts`
- `frontend/lib/server/falIntegration/falWebhookIngress.ts`

Implication:
- legacy HMAC webhook posture is retired from the active branch contract
- active docs should not present webhook-mode switching as a normal runtime choice unless the current branch code actually reads those controls

### 4. Canonical recovery and reconciliation posture
Recovery is a live production path for accepted jobs. It is not legacy scaffolding.

Authority:
- `frontend/pages/api/internal/generation-recovery/run.ts`
- `frontend/lib/server/generationControlPlane/runCycle.ts`
- `frontend/lib/server/falIntegration/recoveryExecution.ts`

Implication:
- reconciler/recovery controls are canonical production controls on this branch
- they must not be removed under a generic "no fallback" cleanup

### 5. Canonical media upload posture
Media upload is server-authoritative through `/api/media/upload`.

Authority:
- `frontend/pages/api/media/upload.ts`

Implication:
- `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED` remains a live production control on this branch

### 6. Canonical session and workspace posture
Project/workspace persistence is the active durable authority. Legacy AI Studio session APIs remain only as retired tombstones returning `410`.

Authority:
- `frontend/pages/api/projects/[...projectPath].ts`
- `frontend/pages/api/projects/create.ts`
- `frontend/pages/api/projects/index.ts`
- `frontend/pages/api/ai/sessions/index.ts`
- `frontend/pages/api/ai/sessions/[sid].ts`
- `frontend/pages/api/ai/sessions/save.ts`

Implication:
- active docs should treat project/workspace persistence as canonical
- legacy session routes are not live product behavior

### 7. Canonical provider gating posture
Provider controls still exist and are not all rollout debt.

Authority:
- `frontend/lib/server/api/falRuntimeFlags.ts`
- `frontend/lib/server/providerIntegration/providerRuntimeConfig.ts`
- `frontend/lib/server/falIntegration/providerTrustPolicy.ts`
- `frontend/lib/server/api/openAiCompat.ts`

Branch note:
- Fal runtime allowlisting still exists through `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST`, but not as a legacy/shadow/on integration-mode switch
- Kie still has explicit gated/dark-path behavior for non-always-on lanes
- OpenAI transport still has a real Responses/chat compatibility surface

## Provisional control classification

### Canonical keep
These are live controls or live safety boundaries on this branch:
- `SHORTPULSE_FAL_RECONCILER_*`
- `SHORTPULSE_FAL_ADMISSION_*`
- `SHORTPULSE_FAL_TRUSTED_HOSTS`
- `SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED`
- `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST`
- `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED`
- OpenAI transport controls
- Kie provider gating controls

### Temporary keep
These should remain until the protected risk is closed:
- `NEXT_PUBLIC_AI_STUDIO_STYLE_DROP_SERVER_COPY_FALLBACK_ENABLED`
- workflow/session stabilization kill switches still covering known unstable behavior

### Doc demote candidates
These should not remain active current-runtime guidance:
- queue-era rollout framing
- shadow/canary posture described as a required current-path step
- `legacy -> shadow -> on` runtime framing where the current branch code no longer supports it

### Remove candidates
These need cleanup verification in the next batch:
- active-doc/env references that describe dead integration-mode switching
- active-doc/env references for webhook toggles that are no longer read in current route/runtime code

Completed in the first safe batch:
- `NEXT_PUBLIC_AGENT_V2` removed from active env/docs/test-support surface on this branch
- no live code/test-support references remain for `STUDIO_AGENT_CANONICAL_DB_ENABLED`; remaining mentions are historical planning context only

Completed in the final closeout batch:
- active operator/runtime docs no longer present `SHORTPULSE_FAL_WEBHOOK_ENABLED`, `SHORTPULSE_FAL_WEBHOOK_JWKS_URL`, or queue-era webhook canary posture as live branch controls
- `docs/adr/0020-ai-studio-server-authoritative-runtime-v2.md` now preserves original rollout controls as historical context while pointing current execution back to this branch-local contract

## First cleanup batch after this freeze
1. align active authority surfaces:
   - `frontend/.env.example`
   - `docs/deployment.md`
   - `docs/local-development.md`
   - `docs/planning/ai-studio-generation-runtime-v2-locked-execution.md`
2. remove or demote dead rollout posture from active docs
3. keep live recovery/admission/provider/upload controls intact

## Stop rule for this lane
Stop when:
- active docs describe one canonical live branch contract
- dead rollout posture is removed from active authority surfaces
- remaining controls are explicitly justified as canonical or temporary
- the next useful step would be runtime redesign instead of contract convergence

## Residual controls after closeout

### Canonical keep after closeout
- `SHORTPULSE_FAL_RECONCILER_*`
- `SHORTPULSE_FAL_ADMISSION_*`
- `SHORTPULSE_FAL_TRUSTED_HOSTS`
- `SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED`
- `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST`
- `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED`
- OpenAI transport controls in `frontend/lib/server/api/openAiCompat.ts`
- Kie provider gating controls in `frontend/lib/server/providerIntegration/providerRuntimeConfig.ts`

### Temporary keep after closeout
- `NEXT_PUBLIC_AI_STUDIO_STYLE_DROP_SERVER_COPY_FALLBACK_ENABLED`
- workflow/session stabilization kill switches that still cover a known open defect or unstable path

### Historical-only after closeout
- `NEXT_PUBLIC_AGENT_V2`
- `STUDIO_AGENT_CANONICAL_DB_ENABLED`
- queue-era `/api/fal/queue-status` posture on this branch
- `legacy -> shadow -> on` runtime framing
- active webhook enable/JWKS/tolerance toggles as branch-local runtime controls

## Closeout result
This lane is complete on the current branch because:
- the branch-local runtime contract is frozen in one authority document
- active env, deployment, local-development, SOP, and operator docs now describe the live branch posture
- rollout-era ADR/planning language has been demoted to historical context where it still needs to exist
- the first safe dead-surface batch was removed without changing live runtime behavior

The next useful step is not more adjacent cleanup in this lane. It is a separate runtime or media lane with a fresh repo-backed problem statement.
