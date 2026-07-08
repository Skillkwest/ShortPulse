# Incident Audit Follow-Up Buildout Plan - 2026-07-08

Status: active execution source for this incident-audit follow-up lane.

## Source Of Truth

This document is the durable repo source for the July 8, 2026 incident-audit follow-up buildout.

It converts these non-repo inputs into an executable plan:

- Triage packet: `/Users/worldbuilder/.codex/attachments/3d462e4b-309e-47a9-91db-78700f156a43/pasted-text.txt`
- Current-thread plan from July 8, 2026, which split the audited incidents into:
  - Lane A: generation recovery reliability
  - Lane B: upload persistence
  - Lane C: Kie upload/provider staging

Use this file, not chat memory alone, for future checkpoints.

## Objective

Turn the audited incident packet into narrow, canonical fixes or durable follow-ups by proving which errors represent real product risks, fixing only the owning source seam when a local fix is justified, and labeling remaining gaps by owner, evidence level, and next proof.

## Owner And Lane Boundaries

Primary execution lane: Bactuo when work concerns generation lifecycle, provider recovery, generation settlement, or generation-output convergence.

Repo authority for Bactuo-owned work:

- `docs/agents/bactuo/generation-recovery-settlement-source-map.md`
- `docs/agents/bactuo/standard-operating-procedure.md`
- `docs/sops/sop_generation_recovery_diagnostics.md`

Shared or adjacent lanes:

- Upload persistence work must stay on canonical media upload/finalize service seams.
- Kie upload/provider staging work must stay on the canonical Kie upload route, provider admission, and staging diagnostics seams.
- Billing subscription conflicts and deploy-skew chunk failures are watch items unless fresh evidence shows repeated current impact after the production alias is settled.

## Approved Scope

Approved in this plan:

- Local `production` branch code, test, and focused doc updates.
- Static inspection, targeted local tests, and production-safe read-only proof.
- Canonical source fixes in the owning route, service, lifecycle helper, or test surface.
- Durable plan updates when they reduce ambiguity about this exact incident set.

Not approved in this plan:

- UI, UX, or intended-behavior changes.
- Branch changes, commits, pushes, deploys, or release promotion.
- Production mutations, destructive admin action, live replay, credit mutation, or provider-spend tests.
- Security posture changes, env changes, secret changes, or broad operational rewrites.
- Workarounds, duplicate authorities, backup implementations, hidden fallbacks, or broad refactors.
- Mobile-specific work.

## Incident Lanes

### Lane A: Generation Recovery Reliability

Incidents:

- `7c55b438`: `generation.task_backed_stale_timeout`, output `out-loqrms4o6s`, Kie Veo task `605a7975ef6da2e795cd07e17b08fa23`
- `75a1f0a1`: `/api/internal/generation-recovery/run` exception, message `This operation was aborted`, generation `9e2f4e98-43f4-44dd-bbad-9a181af915af`
- `0c9479f4`: `generation.workflow_failure`, reason `poll_timeout`, `kie-gpt-image-2-edit-status`
- `283b83ff`: `generation.task_backed_stale_timeout`, output `out-zf61v5n9tm`, Kie Veo task `66c64716aa6da62cf7eb612af70becb3`

First proof target:

Trace whether the recovery runner can throw an uncaught abort from media persistence, provider probing, or control-plane timeout handling, and whether the stale task-backed outputs share the same lifecycle failure shape.

Minimum local proof for a code fix:

- Targeted tests covering the fixed recovery seam.
- Static trace from recovery route to owning helper.
- No new fallback recovery path.

Production proof gap:

- Exact generation/task rows and recovery events for the named IDs are not proven by local code inspection. Treat production conclusions as unproven until read-only production/Admin trace evidence is captured.

### Lane B: Upload Persistence

Incidents:

- `00c08b98`: client `media_library_save_failure`, output `upload-ccne007keej`
- `e61473de`: client API `500` on `/api/media/finalize-upload`, request `b89a1940-ae41-4432-b1e2-d60485ba21a4`
- `cc33b3f1`: server `/api/media/finalize-upload` exception, message `Upload failed`, request `b89a1940-ae41-4432-b1e2-d60485ba21a4`

First proof target:

Determine whether this is a transient Supabase storage failure, a staged-object move/copy edge case, a durable media-row persistence failure, or a diagnostics gap that prevents operators from distinguishing those cases.

Minimum local proof for a code fix:

- Targeted media finalize/upload service tests for the exact failing seam.
- Sanitized user-facing error behavior preserved.
- No alternate upload path or storage fallback.

Production proof gap:

- The Supabase storage error behind the request ID is not proven from the packet alone.

### Lane C: Kie Upload / Provider Staging

Incidents:

- `239eacc0`: `/api/kie/upload-url` upstream failed with status `500`, request `9b571935-ad89-45d6-8e31-a5aa505f0fcc`
- `14c83dc4`: client API `500` mirror on `/api/kie/upload-url`, request `a76cd14f-e22b-472e-b222-5644012bf3fb`

First proof target:

Determine whether the incidents represent a provider outage, admission/profile mismatch, unsupported upload bytes, insufficient diagnostics, or an app-side route handling defect.

Minimum local proof for a code fix:

- Targeted route tests for provider non-ok, provider payload parse failures, and diagnostic metadata.
- Existing provider failover or admission contracts preserved.
- No new provider workaround without a documented owner and removal condition.

Production proof gap:

- Provider-side response body, admission profile, and source media characteristics for the exact request IDs are not proven by the packet alone.

## Execution Order

1. Lane A first, because generation recovery failure can leave multiple downstream user-visible states unresolved.
2. Lane B second, because finalize-upload failures affect durable user media ownership.
3. Lane C third, unless fresh evidence shows Kie upload failures are actively blocking the same user workflow.
4. Watch-only items last:
   - chunk load failure after deploy skew
   - billing subscription `409` conflict

Each lane must be completed as a validated batch before moving to the next lane.

## Execution Status

### 2026-07-08 Lane A Local Containment Batch

Status: local implementation proof complete; production proof pending.

Completed:

- Hardened `frontend/lib/server/generationControlPlane/recoveryBatchExecution.ts` so a recovery-row error stays contained even when the follow-up requeue write fails or the injected logging callback rejects.
- Made Supabase requeue mutation errors explicit instead of silently treating `{ error }` responses as success.
- Added abort-shaped and secondary-failure coverage in `frontend/lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts`.

Validated:

- `cd frontend && npx vitest run lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts`
- `cd frontend && npx vitest run tests/api/internal-generation-recovery-run.test.ts lib/server/generationControlPlane/__tests__/runCycle.test.ts`

Still unproven:

- The exact production generation rows for incidents `7c55b438`, `75a1f0a1`, `0c9479f4`, and `283b83ff`.
- Whether the production `This operation was aborted` event came from the recovery engine itself, the follow-up requeue write, provider/media fetch, or a surrounding platform timeout.
- Deployed production behavior on `https://www.shortpulse.ai`.

Boundary:

Do not mark Lane A production-closed until read-only production/Admin trace evidence links the named generation/task IDs to the fixed containment seam, or proves a different canonical seam owns the remaining failure.

### 2026-07-08 Lane B Local Diagnostics Batch

Status: local diagnostic-source hardening complete; production proof pending.

Completed:

- Extended `MediaUploadServiceError` in `frontend/lib/server/mediaUploadPolicy.ts` with optional structured diagnostics.
- Labeled finalize-upload failure stages in `frontend/lib/server/mediaUploadService.ts`, including prepared upload read, prepared upload move, storage upload, media row insert, and preview URL signing failures.
- Included those diagnostics in `/api/media/finalize-upload` 500 logs while preserving the existing sanitized client response.
- Added route and service tests for structured finalize diagnostics.

Validated:

- `cd frontend && npx vitest run lib/server/__tests__/mediaUploadService.directUpload.test.ts`
- `cd frontend && npx vitest run tests/api/media-finalize-upload-route.test.ts`
- `cd frontend && npm run type-check:touched`

Still unproven:

- The exact Supabase storage/backend error behind request `b89a1940-ae41-4432-b1e2-d60485ba21a4`.
- Whether incidents `00c08b98`, `e61473de`, and `cc33b3f1` were storage read, storage move, durable upload, row insert, or signing failures.
- Deployed production behavior on `https://www.shortpulse.ai`.

Boundary:

Do not mark Lane B production-closed until read-only production/Admin event evidence identifies the original failing finalize stage, or a fresh repeated event carries the new structured `media_upload_stage` metadata after deployment.

### 2026-07-08 Lane C Local Diagnostics Batch

Status: local diagnostic-source hardening complete; production/provider proof pending.

Completed:

- Added non-sensitive request-context metadata to Kie upload failure logs in `frontend/pages/api/kie/upload-url.ts`.
- Preserved existing provider upload behavior, fallback behavior, admission behavior, and client responses.
- Extended existing `frontend/tests/api/kie-upload-url.test.ts` coverage so upstream non-OK, provider-declared failure, and missing returned URL logs include request format, upload path, media kind, admission profile, content type, and source-shape booleans.

Validated:

- `cd frontend && npx vitest run tests/api/kie-upload-url.test.ts`
- `cd frontend && npm run type-check:touched`

Still unproven:

- The provider-side response body and source media characteristics for requests `9b571935-ad89-45d6-8e31-a5aa505f0fcc` and `a76cd14f-e22b-472e-b222-5644012bf3fb`.
- Whether incidents `239eacc0` and `14c83dc4` were provider outage, source-media admission/profile mismatch, unsupported bytes, or another provider-side temporary failure.
- Deployed production behavior on `https://www.shortpulse.ai`.

Boundary:

Do not mark Lane C production-closed until read-only production/Admin event evidence identifies the original request context and upstream response shape, or a fresh repeated event carries the new Kie request metadata after deployment.

### 2026-07-08 Local Buildout Completion Audit

Status: all approved local buildout batches complete; production/Admin proof deferred by stop condition.

Completed local scope:

- Lane A: canonical recovery batch containment fix plus targeted tests.
- Lane B: finalize-upload diagnostic-source hardening plus targeted tests.
- Lane C: Kie upload request-context diagnostic hardening plus targeted tests.
- Durable source-of-truth plan and docs index entries.

Final local validation:

- `cd frontend && npx vitest run lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts tests/api/internal-generation-recovery-run.test.ts lib/server/generationControlPlane/__tests__/runCycle.test.ts lib/server/__tests__/mediaUploadService.directUpload.test.ts tests/api/media-finalize-upload-route.test.ts tests/api/kie-upload-url.test.ts`
- `cd frontend && npx eslint lib/server/generationControlPlane/recoveryBatchExecution.ts lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts lib/server/mediaUploadPolicy.ts lib/server/mediaUploadService.ts lib/server/__tests__/mediaUploadService.directUpload.test.ts pages/api/media/finalize-upload.ts tests/api/media-finalize-upload-route.test.ts pages/api/kie/upload-url.ts tests/api/kie-upload-url.test.ts`
- `node scripts/typecheck_changed_files.mjs --path frontend/lib/server/generationControlPlane/recoveryBatchExecution.ts --path frontend/lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts --path frontend/lib/server/mediaUploadPolicy.ts --path frontend/lib/server/mediaUploadService.ts --path frontend/lib/server/__tests__/mediaUploadService.directUpload.test.ts --path frontend/pages/api/media/finalize-upload.ts --path frontend/tests/api/media-finalize-upload-route.test.ts --path frontend/pages/api/kie/upload-url.ts --path frontend/tests/api/kie-upload-url.test.ts`
- `node scripts/check_docs_links.js`

Validation note:

- `cd frontend && npm run type-check:touched` is currently blocked by an unrelated dirty file outside this incident lane: `frontend/pages/api/billing/stripe/webhook.ts`.
- The narrowed type-check helper found no diagnostics in the nine touched incident frontend TypeScript paths.

Deferred proof:

- Exact production/Admin event causality for all named incident IDs and request IDs.
- Deployed behavior on `https://www.shortpulse.ai`.
- Post-deploy confirmation that fresh repeated events carry the new diagnostic metadata.

Stop condition reached:

The next proof depends on production/Admin read access, deployment, or fresh production events. Those are outside this approved local code/test/docs lane.

### 2026-07-08 Post-Deploy Production-Safe Check

Status: production route-safety proof complete; incident causality still requires Admin/event evidence.

Source of truth:

- Current clean `production` HEAD: `104a629f7c5ac092f25df005d4f8f101cb81b7e6`.
- Production URL: `https://www.shortpulse.ai`.
- Resolved Vercel deployment from parity check: `https://shortpulse-io2bpggzb-kirk-artmans-projects.vercel.app`, created `2026-07-08T17:02:28.054Z`.

Validated:

- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai`
  - Passed required route parity for 200 inspected route entries, including `/api/internal/generation-recovery/run` and `/api/internal/media-derivatives/run`.
- `node scripts/verify_internal_route_runtime.mjs --base-url https://www.shortpulse.ai --skip-auth --route generation_recovery --route user_health_fleet --route media_derivatives`
  - Passed expected unauthenticated fail-closed probes with `401` for all three protected internal routes.
- `curl` GET probes against `https://www.shortpulse.ai/api/media/finalize-upload` and `https://www.shortpulse.ai/api/kie/upload-url`
  - Both returned `401`, confirming the routes are present and fail closed for unauthenticated non-mutating probes.
- `cd frontend && npx vitest run lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts tests/api/internal-generation-recovery-run.test.ts lib/server/generationControlPlane/__tests__/runCycle.test.ts lib/server/__tests__/mediaUploadService.directUpload.test.ts tests/api/media-finalize-upload-route.test.ts tests/api/kie-upload-url.test.ts`
  - Passed: 6 files, 59 tests.
- `cd frontend && npx eslint lib/server/generationControlPlane/recoveryBatchExecution.ts lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts lib/server/mediaUploadPolicy.ts lib/server/mediaUploadService.ts lib/server/__tests__/mediaUploadService.directUpload.test.ts pages/api/media/finalize-upload.ts tests/api/media-finalize-upload-route.test.ts pages/api/kie/upload-url.ts tests/api/kie-upload-url.test.ts`
  - Passed.
- `node scripts/typecheck_changed_files.mjs --path ...`
  - Passed for the touched incident TypeScript paths; the repo-level touched type-check now also passes.
- `node scripts/check_secret_exposure.js`
  - Passed.

Conclusion:

- The production alias is route-coherent after deploy and the relevant protected routes fail closed instead of returning public 500s.
- No UI, UX, intended behavior, provider fallback, storage fallback, security posture, or branch-policy changes were introduced by this incident lane.
- The deploy-skew/chunk-load watch item is treated as noise unless it repeats after this settled production alias and pairs with fresh missing-asset or API failure evidence.

Still unproven:

- Exact production/Admin causality for the named generation, media finalize, and Kie upload incident IDs.
- Whether fresh repeated production events now include the new `media_upload_stage` or Kie request-context diagnostics.
- Authenticated/live success for generation recovery, media finalize, or Kie upload, because replay/spend/mutation tests remain outside this plan's approved scope.

Boundary:

Do not continue into live replay, provider-spend tests, production mutations, or unrelated deployed changes without a new explicit scope. The next high-ROI proof is read-only Admin/error-event inspection for fresh repeats of the same incident signatures.

## Proof Requirements

For each batch, record:

- Source of truth used.
- Exact route/service/helper/test touched.
- Evidence type: static, local test, production-safe read-only, or authenticated/live production.
- What remains unknown.
- Why the next action is still in scope.

Local proof can close implementation correctness. It cannot close deployed production behavior, provider availability, storage backend health, credit settlement, or live replay success.

## Stop Conditions

Stop before changing code when:

- The next step depends on production mutation, spend, live replay, deploy, push, or commit approval.
- The owner lane is not Bactuo or the canonical media/provider owner is unclear.
- The only available fix would add a workaround, duplicate implementation, hidden fallback, or broad refactor.
- Production evidence is required for a launch-relevant conclusion and only local/static evidence is available.
- Remaining work would mostly create churn instead of reducing this incident set's risk.

Stop after a batch when:

- The specific incident class is proven noise or handled by existing expected behavior.
- A canonical fix is made and validated locally, but deployment or production proof is outside this lane.
- A clearer owner handoff is needed for the next proof.
