# 2026-07-01 Full Sweep Findings Remediation Handoff

Status: completed from repo-local remediation on 2026-07-02; hosted/live proof not performed.

Owner/lane: Dave the Security Guy, launch-readiness security remediation.

Source sweep: `docs/records/artifacts/agent/dave-the-security-guy/reports/2026-07-01-full-repo-security-sweep.md`

Objective: re-audit and solve the two confirmed findings from the full repo-local security sweep without widening into broad cleanup, UI/UX changes, behavior redesign, or low-ROI hardening.

## 2026-07-02 Remediation Result

- Issue 1 fixed at the canonical helper: `frontend/lib/server/productImageAssetAdmission.ts` now requires current media agreement acceptance before preparing product-image signed upload targets, finalizing staged product-image uploads, or admitting storage-backed product images.
- Issue 1 regression coverage added in `frontend/lib/server/__tests__/productImageAssetAdmission.test.ts` for all three helper entry points, including unavailable media-compliance status. Route coverage in `frontend/tests/api/media-product-image-asset-routes.test.ts` now proves consent failures return stable `MEDIA_COMPLIANCE_REQUIRED` codes without logging them as server faults.
- Issue 2 fixed by data minimization: default reliability diagnostics remain aggregate-only, and row-level diagnostic queries were moved to explicit break-glass SQL files gated by `RELIABILITY_DIAGNOSTICS_INCLUDE_ROW_DETAILS=false` by default and the manual workflow `include_row_details` input. Diagnostics artifacts now explicitly retain for 7 days.
- No hosted Supabase, Vercel, GitHub secrets, customer data, production data, billing state, UI/UX behavior, signup semantics, credit semantics, or product flow was mutated in this remediation run.

Validation recorded for this remediation:

- `npm -C frontend test -- productImageAssetAdmission` passed.
- `npm -C frontend test -- media-product-image-asset-routes` passed.
- Static scan of the default artifact-bound reliability diagnostics path found no `user_id`, `generation_id`, `provider_request_id`, `source_ref`, row timing JSON, or media visibility timestamp fields.
- `bash -n scripts/reliability_control_plane_diagnostics.sh` passed.
- `node scripts/check_secret_exposure.js` passed.
- `npm -C frontend run docs:check` passed.
- `git diff --check` passed.
- `npm -C frontend run type-check` is still blocked by unrelated pre-existing billing concurrency test typings in `frontend/tests/api/billingConcurrencyEntitlements.test.ts`.

## Startup Contract For The Next Agent

1. Start on local `production` and confirm `git config --local shortpulse.allowedBranch` is `production`.
2. Follow the root startup contract in `AGENTS.md`, then Dave's current contract under `docs/agents/dave-the-security-guy/`.
3. Treat the sweep report above as context, not authority. Re-prove each issue from current code before editing.
4. Read these implementation surfaces before making changes:
   - `frontend/lib/server/productImageAssetAdmission.ts`
   - `frontend/lib/server/api/mediaComplianceGuard.ts`
   - `frontend/lib/server/api/mediaComplianceAcceptance.ts`
   - `frontend/lib/server/mediaUploadService.ts`
   - `frontend/pages/api/media/prepare-product-image-asset-upload.ts`
   - `frontend/pages/api/media/finalize-product-image-asset-upload.ts`
   - `frontend/pages/api/media/admit-image-asset-from-storage.ts`
   - `frontend/lib/server/__tests__/productImageAssetAdmission.test.ts`
   - `frontend/tests/api/media-product-image-asset-routes.test.ts`
   - `.github/workflows/reliability-control-plane-diagnostics.yml`
   - `scripts/reliability_control_plane_diagnostics.sh`
   - `sql/check_generation_queue_dispatch_latency.sql`
   - `sql/check_generation_recovery_media_visible_latency.sql`
5. Do not mutate hosted Supabase, Vercel, GitHub secrets, Stripe, customer data, or production data unless the user separately approves a live validation lane.

## Protected Contracts

- No UI, UX, visible copy, or intended product-flow changes.
- No signup/billing/credit semantics changes.
- No fallback routes, backup routes, duplicate authorities, or compatibility patches.
- No broad error cleanup, route polish, formatting-only churn, or adjacent hardening.
- Preserve fail-closed behavior for auth, media agreement, storage path scope, RLS/RPC, service-role, admin, billing, provider, and webhook boundaries.
- Never expose raw secrets, tokens, signed URLs, raw env values, customer-private data, or production logs.

## Issue 1: Product Image Asset Routes Bypass Media Agreement Guard

Severity: medium-high.

Threat statement: an authenticated user who has not accepted the current media agreement can still create product-image media side effects by using product-image asset upload/admission routes, weakening the consent boundary before launch.

Canonical root: `frontend/lib/server/productImageAssetAdmission.ts`, because all three affected routes delegate to this helper and helper-level enforcement prevents future route-level omissions.

Known affected entry points:

- `frontend/pages/api/media/prepare-product-image-asset-upload.ts`
- `frontend/pages/api/media/finalize-product-image-asset-upload.ts`
- `frontend/pages/api/media/admit-image-asset-from-storage.ts`

Recommended implementation:

1. Reconfirm the ordinary upload/generation contract: `requireMediaComplianceAccepted` fails closed using `getMediaComplianceAcceptanceStatusForUser`.
2. Add a small helper in `productImageAssetAdmission.ts` that checks current media agreement acceptance for the `userId` before any signed upload target is created, any staging object is finalized, or any storage-backed image is admitted.
3. Call that helper at the start of:
   - `prepareProductImageAssetUploadForUser`
   - `finalizePreparedProductImageAssetUploadForUser`
   - `admitProductImageAssetFromStorageForUser`
4. Preserve existing route response shape as much as possible. If the helper throws `ProductImageAssetAdmissionError(403, "Media agreement acceptance is required.", "MEDIA_COMPLIANCE_REQUIRED")`, the existing route error handling should naturally return a 403. If current tests expect a `code`, decide whether to add the code at route level only if required by existing route conventions.
5. Do not move ownership checks, path validation, image admission, or storage upload logic unless a focused test proves the source fix requires it.

Suggested tests:

- Add/extend route tests in `frontend/tests/api/media-product-image-asset-routes.test.ts` for unaccepted users returning 403 on all three affected routes.
- Add/extend helper tests in `frontend/lib/server/__tests__/productImageAssetAdmission.test.ts` if the route tests cannot prove helper-level enforcement.
- Keep mocks focused on `getMediaComplianceAcceptanceStatusForUser`, `getSupabaseAdmin`, and the existing product-image admission seams.

Focused validation:

- `npm -C frontend test -- media-product-image-asset-routes`
- `npm -C frontend test -- productImageAssetAdmission`
- `npm -C frontend run type-check`
- `node scripts/check_secret_exposure.js`

Stop after Issue 1 if validation fails for unrelated dirty-worktree reasons. Report the blocker instead of widening.

## Issue 2: Hosted Diagnostics Export Row Identifiers Into GitHub Artifacts

Severity: medium.

Threat statement: a manual production diagnostics run can write row-level production identifiers into GitHub Actions artifacts, causing private operational metadata to outlive the immediate diagnostic need.

Canonical root: diagnostic SQL/scripts decide what production data is printed; workflow artifact upload is the transport, not the source authority.

Known affected surfaces:

- `.github/workflows/reliability-control-plane-diagnostics.yml`
- `scripts/reliability_control_plane_diagnostics.sh`
- `sql/check_generation_queue_dispatch_latency.sql`
- `sql/check_generation_recovery_media_visible_latency.sql`

Recommended implementation:

1. Reconfirm that the default reliability diagnostic path is meant for normal deploy/health proof, not incident forensics.
2. Make default workflow/script output aggregate-only by removing or gating the "Recent worst-case rows" detail queries from default production artifact output.
3. Prefer a clear explicit switch, for example `RELIABILITY_DIAGNOSTICS_INCLUDE_ROW_DETAILS=false` by default, if row detail is still needed for break-glass incident work.
4. If adding a workflow input, make its label explicit about private row identifiers and keep default `false`.
5. Do not remove aggregate latency checks or security posture checks.
6. Do not print emails, prompts, signed URLs, Stripe/customer identifiers, or raw metadata blobs in the default path.

Suggested tests/checks:

- Add or update a script/unit check only if the repo already has a nearby pattern for validating SQL/log privacy.
- At minimum, run a static scan showing default diagnostic SQL no longer prints `user_id`, `generation_id`, `provider_request_id`, `source_ref`, or timing JSON in artifact-bound default output.
- `node scripts/check_secret_exposure.js`
- `npm -C frontend run docs:check`

Stop after Issue 2 if the correct solution requires a GitHub environment/retention policy decision rather than repo code changes. Record that as an operations proof gap.

## Recommended Sequence

1. Fix Issue 1 first. It directly affects an authenticated app-side media side-effect boundary and has the clearest canonical code fix.
2. Validate Issue 1 with focused tests and type-check.
3. Re-rank Issue 2 after Issue 1. If still in scope and low-mess, make default diagnostics aggregate-only. If GitHub retention/access policy is the real blocker, stop with an operations handoff instead of patching around policy uncertainty.
4. Update the sweep report only if the actual security contract changed or the finding status needs closure.

## Completion Criteria

The lane is complete when:

- Issue 1 is either fixed at the helper-level canonical source with focused proof or explicitly blocked by validation/ownership.
- Issue 2 is either fixed by data-minimized default diagnostics or explicitly deferred to an operations policy decision with the repo evidence named.
- Validation results are recorded.
- No unrelated code cleanup, UI/UX behavior changes, production mutations, or broad hardening were introduced.
- The closeout clearly separates fixed, unproven, blocked, and deferred work.
