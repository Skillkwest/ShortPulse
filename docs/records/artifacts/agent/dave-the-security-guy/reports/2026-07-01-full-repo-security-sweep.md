# 2026-07-01 Full Repo Security Sweep

Status: complete from repo-local audit evidence; 2026-07-02 repo-local remediation closed F-001 and F-002; hosted/live proof remains outside this pass.

Owner/lane: Dave the Security Guy, launch-readiness security audit.

Objective: sweep the ShortPulse repo for major launch-relevant security issues, especially user-account isolation, cross-user data/media/storage access, credits/billing integrity, admin boundaries, provider/webhook trust, service-role use, prompt/external-input authority boundaries, secret/session exposure, and fail-closed auth behavior.

Mode: audit/report only. App code, SQL, UI, UX, product behavior, hosted Supabase, Vercel, GitHub secrets, billing/customer state, and production data are not to be mutated by this sweep.

Source of truth loaded:

- Root startup contract: `AGENTS.md`
- Core repo docs: `docs/dev-ground-rules.md`, `docs/conventions.md`, `docs/agent-playbook.md`, `docs/README.md`, `docs/troubleshooting.md`, `docs/glossary.md`
- Scoped docs: `frontend/AGENTS.md`, `docs/AGENTS.md`
- Dave docs: `docs/agents/dave-the-security-guy/AGENTS.md`, `README.md`, `goal-prompt.md`, `memory.md`, `standard-operating-procedure.md`, `security-decision-framework.md`, `security-ownership-map.md`
- Security references: `docs/security-checklist.md`, `docs/deployment.md`, `docs/supabase_auth_setup.md`

Stop condition:

- Stop when the repo has been swept across the major security surfaces below and every confirmed/likely major finding has severity, confidence, affected boundary, evidence, root owner, launch impact, ROI, recommended canonical fix, and proof gap.
- Stop early only for a true blocker: required live credential/console mutation, unsafe production-data action, ambiguous environment identity, or context exhaustion after writing a checkpoint.

Protected contracts:

- No UI/UX/product-behavior changes from this audit.
- No broad cleanup, generic error cleanup, patch layering, fallback routes, or legacy-route work unless it is a confirmed active security boundary.
- Do not expose raw secrets, tokens, signed URLs, customer-private data, raw logs, or raw env values.
- Mini Ecosystem is excluded by default per repo policy.

Proof boundaries:

- Local code/docs/SQL evidence can identify repo risks.
- Local tests can validate code paths if implementation is later approved.
- Hosted Supabase/Vercel/Stripe posture requires approved production-safe validation and is not proven by this repo-only sweep.

## Worktree Baseline

- Branch: `production`
- `shortpulse.allowedBranch`: `production`
- Existing dirty worktree at sweep start includes billing/profile/AI Studio/storage-addon code, tests, docs, and SQL. Those changes are treated as pre-existing and are not reverted by this audit.
- Workspace artifact safety check found normal `frontend/.next`; no generated backup directory was moved or created.

## Coverage Log

| Area                                           | Status                   | Notes                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startup/security instructions                  | Complete                 | Required startup and Dave docs loaded in bounded chunks.                                                                                                                                                                                                                                                                                           |
| Repo inventory                                 | Complete                 | Excluding `mini-ecosystem/`, `frontend/.next/`, `node_modules/`. API route inventory found 174 route files under `frontend/pages/api`.                                                                                                                                                                                                             |
| Secret/session artifact scan                   | Complete                 | `scripts/check_secret_exposure.js` passed. Local real env files exist but are ignored; tracked source scan found only placeholder/test literals and redaction logic, not live-looking secrets.                                                                                                                                                     |
| API auth and authorization routes              | Complete                 | `frontend/proxy.ts` and `frontend/lib/server/api/protectedApiPaths.ts` protect `/api/account`, `/api/projects`, `/api/pricing`, `/api/admin`, `/api/credits`, `/api/media`, `/api/generation`, provider routes, and other sensitive prefixes. Checked exception wrappers delegate to guarded helpers.                                              |
| Auth/session/signup/consent flows              | Complete                 | Signup intent, callback URL, OAuth handoff preflight, account bootstrap, media-compliance route, and media-compliance guard checked. Account-first signup is intentional; zero-credit baseline is the contract. Product-image consent gap found below.                                                                                             |
| Billing/Stripe/credits/webhooks                | Complete                 | Checkout, portal, subscription change, storage add-on change, Stripe customer verification, top-up eligibility, generation billing, and webhook signature/idempotency/ownership shape checked. No repo-backed credit leak found. Hosted Stripe/Supabase proof not performed.                                                                       |
| Storage/media/signed URLs                      | Complete                 | Media upload service, project preview signing, media copy URL service, signed batch previews, project/workspace media authorities, and product-image asset admission checked. Signed URLs are user-scoped where account-private; product-image consent gap found below.                                                                            |
| SQL/RLS/RPC/storage policies                   | Complete, local evidence | Key SQL/docs evidence shows user-id RLS for billing/credits/media/projects/workspaces and storage object path policies. Critical RPC posture has repo check scripts. Hosted application remains unproven.                                                                                                                                          |
| Admin/internal cron boundaries                 | Complete                 | Admin APIs require `requireAdminUser` except `admin/access`, which is intentionally a self-access check behind `requireApiUser`. Internal cron routes require explicit secrets and fail closed when disabled or unconfigured.                                                                                                                      |
| Provider/proxy/prompt injection/external input | Complete                 | Provider submit/status helpers require auth, media agreement for billed generation, credit reservation, provider request ownership for status, webhook signature validation, and trusted URL/SSRF checks for remote media copy. Agent safety rollback is scoped to production hard-floor incidents and policy RPCs, not billing/account authority. |
| Error leakage                                  | Complete                 | No raw secret/signed URL/customer payment leak found in public errors. Some admin/internal errors include operational detail behind admin/cron gates.                                                                                                                                                                                              |
| GitHub Actions/scripts/deploy gates            | Complete                 | SQL mutation workflows have environment-scoped secrets, confirmation tokens, constrained SQL paths/operations, and read-only permissions. Diagnostic workflows can upload row-level production identifiers as artifacts; finding below.                                                                                                            |

## Findings

Remediation note, 2026-07-02: F-001 and F-002 were re-audited from current repo evidence and remediated in repo-local code. F-001 now fails closed in `frontend/lib/server/productImageAssetAdmission.ts` before product-image asset side effects when the current media agreement is not accepted. F-002 now keeps default reliability diagnostics aggregate-only; row-level diagnostic output lives behind explicit break-glass SQL files and the `include_row_details` workflow input. Validation is recorded in `docs/records/artifacts/agent/dave-the-security-guy/reports/2026-07-01-full-sweep-findings-remediation-handoff.md`.

### F-001: Product Image Asset Routes Bypass Server-Side Media Agreement Guard

- Severity: medium-high.
- Confidence: high from repo evidence.
- Affected boundary: media-compliance / effectful media creation.
- Launch impact: authenticated users who have not accepted the current media agreement can still request product-image asset signed upload targets and admit owned storage images into character/element asset paths. This does not appear to create a cross-user leak or credit leak, but it weakens the consent contract and lets an account perform media-storage side effects before acceptance.
- ROI: high if implementation is approved, because the canonical fix is small and local: add the same server-side agreement guard used by ordinary media uploads to the product-image asset admission helper or its three route callers.
- Evidence:
  - `frontend/pages/api/media/prepare-product-image-asset-upload.ts` requires `requireApiUser` and rate limits, then calls `prepareProductImageAssetUploadForUser`; no `requireMediaComplianceAccepted` call.
  - `frontend/pages/api/media/finalize-product-image-asset-upload.ts` requires `requireApiUser` and rate limits, then calls `finalizePreparedProductImageAssetUploadForUser`; no `requireMediaComplianceAccepted` call.
  - `frontend/pages/api/media/admit-image-asset-from-storage.ts` requires `requireApiUser` and rate limits, then calls `admitProductImageAssetFromStorageForUser`; no `requireMediaComplianceAccepted` call.
  - `frontend/lib/server/productImageAssetAdmission.ts` enforces user-scoped storage paths and owned character/element targets, but it does not check `getMediaComplianceAcceptanceStatusForUser`.
  - Contrast: `frontend/lib/server/mediaUploadService.ts` calls `assertMediaComplianceAcceptedForUpload` before preparing, finalizing, staging, or uploading media; `frontend/pages/api/projects/create.ts`, `frontend/pages/api/fal/upload-url.ts`, `frontend/pages/api/kie/upload-url.ts`, and `frontend/lib/server/api/generationBilling.ts` also fail closed on missing acceptance.
- Root owner: `frontend/lib/server/productImageAssetAdmission.ts` is the canonical source if product-image asset admission should share the same acceptance policy as other media ingestion. The route callers are acceptable secondary insertion points, but helper-level enforcement is harder to forget.
- Recommended canonical fix if approved later: require current media agreement acceptance at the start of `prepareProductImageAssetUploadForUser`, `finalizePreparedProductImageAssetUploadForUser`, and `admitProductImageAssetFromStorageForUser`, preferably through a shared helper local to `productImageAssetAdmission.ts`, and add focused API/helper tests for unaccepted users returning 403.
- Proof gap: not yet runtime-tested. The finding is source-backed; validation would be route-unit tests plus a targeted manual/API check.

### F-002: Hosted Diagnostic Workflows Can Export Production Row Identifiers Into GitHub Artifacts

- Severity: medium.
- Confidence: high from repo evidence.
- Affected boundary: production operational-data privacy / artifact retention.
- Launch impact: manual production diagnostics can write row-level user and provider identifiers into GitHub Actions logs/artifacts. I did not find secrets, signed URLs, emails, card details, or Stripe customer data in these outputs, so this is not an account-takeover or billing-leak issue. It is still launch-relevant because production `user_id`, `generation_id`, `provider_request_id`, `source_ref`, and timing metadata are customer/private operational data and can outlive the immediate diagnostic need in GitHub artifacts.
- ROI: medium-high if implementation is approved. The canonical fix is contained: default CI/production diagnostic SQL to aggregate-only output, move row-level detail behind a separate explicitly named break-glass script/input, and document artifact retention/access expectations.
- Evidence:
  - `.github/workflows/reliability-control-plane-diagnostics.yml` runs hosted diagnostics against the selected GitHub Environment and uploads `/tmp/reliability_control_plane_diagnostics.log` plus the diagnostic log directory as artifacts.
  - `scripts/reliability_control_plane_diagnostics.sh` runs `sql/check_generation_queue_dispatch_latency.sql` and `sql/check_generation_recovery_media_visible_latency.sql`, teeing each SQL result into log files and a combined log.
  - `sql/check_generation_queue_dispatch_latency.sql` includes a "Recent worst-case rows" query that outputs `e.user_id`, `generation_id`, `provider_request_id`, `source_ref`, queue timestamps, and timing JSON for up to 50 rows.
  - `sql/check_generation_recovery_media_visible_latency.sql` includes a "Recent worst-case rows" query that outputs `e.user_id`, `generation_id`, `provider_request_id`, recovery actor, provider timing, media count, and result URL count for up to 50 rows.
  - `.github/workflows/generation-pipeline-backfill-baseline.yml` also uploads a hosted diagnostic artifact, but its checked SQL currently emits aggregate metric counts rather than row-level user identifiers.
- Root owner: diagnostic SQL/scripts under `sql/check_generation_*` and `scripts/reliability_control_plane_diagnostics.sh`; workflow artifact upload is the transport layer, not the root data-minimization decision.
- Recommended canonical fix if approved later: split the row-detail queries out of the default reliability diagnostics, keep default workflow artifacts aggregate-only, and add an explicitly named `include_row_details`/break-glass path only if the owner accepts that artifact privacy tradeoff for an incident.
- Proof gap: GitHub repository visibility, environment protection, artifact retention, and current production workflow usage were not verified. This finding is repo-backed as a data-minimization risk, not proof that an unauthorized person has artifact access.

## No Confirmed Major Issue In These Swept Surfaces

- Account signup / zero-credit posture: repo code supports account-first signup with Stripe-customer bootstrap and zero credits until subscription/top-up eligibility. New-user SQL defaults free active profile and zero credit balance; the legacy signup seed-credit migration blocks positive `signup_seed` grants. Hosted trigger/migration state remains a production proof gap.
- Stripe and credits: checkout, portal, subscription changes, storage add-ons, top-up eligibility, Stripe customer/subscription verification, webhook signature verification, webhook idempotency, and credit reservation paths all bind operations to the authenticated user or verified Stripe customer metadata. No repo-backed cross-user credit or card/billing access issue found.
- Project/workspace/media isolation: project, workspace snapshot, output display item, media prompt/media file association, preview signing, and media library routes consistently use authenticated `user.id`, user-scoped storage paths, or owner association helpers. No repo-backed cross-user project/media/storage leak found.
- Admin/internal boundaries: admin APIs use app-metadata role checks through `requireAdminUser`; cron/internal routes require configured secrets and generally fail closed. No repo-backed unauthenticated admin/internal route found.
- Provider/webhook boundaries: provider submit/status helpers require auth, credit admission, media agreement, and provider request ownership. Stripe and Fal webhooks verify signatures and use idempotency. No repo-backed provider callback spoof or cross-user status leak found.
- Prompt-injection authority: AI Studio agent safety code can trigger a service-role rollback only for production hard-floor safety incidents and only through safety-policy RPCs. I did not find a path from model/user prompt text into billing, credits, account, admin, or cross-user data authority.

## Deferred / Not Major

- An earlier read made `frontend/lib/server/api/generationBilling.ts` look suspicious because adjacent snippets were interleaved in terminal output; a full focused read resolved that concern. I am not carrying it as a security finding.
- Public dashboard tutorial thumbnail delivery intentionally proxies objects under the dashboard tutorial thumbnail bucket for public/tutorial use. This is not a user-private media bucket path and did not meet the major launch-security threshold in this sweep.
- Some admin/internal routes return operational error detail behind admin or cron-secret gates. I did not find raw secrets, signed URLs, card data, or public customer-private error leakage. Keep this as future hygiene unless a concrete public leak is found.

## Remaining Proof Gaps

- Hosted Supabase posture is not proven by this repo-only sweep. Run the existing production-safe SQL audit scripts only with explicit production validation approval.
- Live production browser/API behavior is not proven here. This audit identifies source-backed risks and repo posture; it does not claim deployed production is current.
- GitHub artifact visibility/retention/environment protection was not checked from the GitHub UI/API.
- Findings F-001 and F-002 are not fixed in this audit-only pass.

## Validation / Commands

- Startup reads: completed by direct file reads.
- Secret scan: `node scripts/check_secret_exposure.js` passed during the sweep.
- Docs validation: `npm -C frontend run docs:check` passed after writing this report.
- Focused repo reads covered `frontend/proxy.ts`, protected API path registry, auth/signup/callback/bootstrap/media-compliance routes, billing/Stripe routes, generation billing, media upload/copy/signing/project workspace services, SQL/RLS/security check scripts, admin/internal routes, provider webhook/submit/status helpers, agent safety control-plane helpers, and GitHub workflows/scripts.
- Final route-auth hotspot scan left only expected unauthenticated/delegated route families: signed webhooks, public dashboard tutorial delivery, and wrapper routes that delegate to guarded handlers.
- No app test/build validation run; this is audit/report-only until fixes are approved.

## Checkpoints

- 2026-07-01 initial checkpoint: report created before broad sweep so findings can be added continuously.
- 2026-07-01 sweep checkpoint: two source-backed findings recorded; no app/SQL/UI behavior changed.
