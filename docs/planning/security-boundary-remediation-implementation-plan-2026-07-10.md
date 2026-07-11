# Security Boundary Remediation Implementation Plan

Status: implementation in progress; local security batches complete through the proof boundary below

Date: 2026-07-10

Owner/lane: Dave the Security Guy owns the security architecture, evidence bar, and implementation audit. Money Stuff owns the one billing-policy choice described below. Nuclo owns hosted Supabase/environment readback and apply coordination. Gear Ball owns GitHub environment, branch, workflow, commit, and push operations.

## Implementation Progress

Completed locally through 2026-07-11:

- SEC-04: removed caller-directed Kie media `HEAD`/`GET` probing and the runtime probe toggle. Kie media validation is deterministic and makes zero network requests; provider submit owns fetchability failures.
- SEC-05 prerequisite: moved the Media Library generation-output attachment mutation behind authenticated `POST /api/generation/output-media-link`. The route derives caller identity from the verified bearer token, verifies both generation and media ownership, and performs the service-role mutation.
- Phase 0 source inventory: identified every active signed Supabase media upload lane, the remaining generated-media and poster-variant direct storage writers, the browser Fal/Kie staging hub, and the server-side Kie GPT Image 2 pre-reservation self-call.
- SEC-01 local foundation and route wiring: added migration `223` and a service-role-only internal-capacity authority that derives paid/internal-comp eligibility from the current subscription contract without reading or mutating customer credits. Standard, Pulse, Style Extraction, and Voiceover Enhance now acquire one durable parent before OpenAI dispatch, consume bounded attempts across retries/fallback/repair/recovery, and settle sanitized usage.
- Runtime SQL proof integration: migration `223`, its rollback, all three RPC signatures, and the service-role table grants are represented in the canonical migration inventories and `sql/check_runtime_sql_security_audit.sql`.
- SEC-01 proof hardening: all four routes prove durable admission denial causes zero provider dispatch; settlement normalizes available Responses/Chat token usage and aggregates it with bounded physical request counts without retaining prompts, outputs, URLs, or user identifiers. The hosted runtime audit now also verifies RLS, absence of browser policies, and absence of anon/auth table access for the admission table.
- Phase 0 production readback (2026-07-11): Nuclo confirmed the production project identity, migration `223` end-state objects, `media_library` bucket/policies, generation grants/RLS/constraints, and aggregate mismatch counts without identity-bearing output. All generation child-parent/attempt/output/media ownership mismatch classes were zero; 304 storage objects remain in deleted/missing-owner namespaces and are explicitly outside this migration's no-cleanup authority.
- SEC-05 local relational hardening: migration `224` adds and validates same-owner composite generation/attempt/output/media foreign keys, preserves existing cascade/set-null delete behavior, makes generation child owner columns immutable, and removes browser mutations from the five server-owned generation child tables while preserving authenticated owner-scoped reads. The output media-link route remains the canonical browser-to-server mutation seam.
- SEC-02 additive upload-intent foundation: migration `225` adds the private bounded `media_upload_staging` bucket, service-role-only `media_upload_intents` table, and five atomic lifecycle RPCs. Migration `226` reconciles the staging-bucket MIME allowlist with the runtime audit by adding `audio/m4a` alongside `audio/x-m4a`. Intents bind one user, purpose, kind, server-derived path, byte ceiling, and expiry; they store sanitized inspection facts only and grant no provider, billing, credit, signing, or durable Media Library authority. Route/caller migration and durable-bucket policy revocation remain deliberately separate phases.
- SEC-02 first canonical caller batch: Media Library image/video/audio prepare and finalize now reserve, claim, finalize, or reject an upload intent and upload browser bytes only to `media_upload_staging`. Finalization rechecks paid entitlement, quota, exact intent/path/purpose, content signature, MIME, and size before the server writes the durable `media_library` object and row. Existing UI/UX and response fields are preserved; the client receives only the additional opaque intent and staging-bucket fields. Reference image/video, motion reference, Voice Changer, product-image, generated-media/poster writers, and browser delete/overwrite callers remain unmigrated, so durable-bucket browser policies must remain in place.
- Phase 1 workflow source hardening: all three production SQL workflows are fixed to the canonical `Production` environment and `production` ref, assert the ref before checkout or secret-bearing work, verify the checked-out SHA, pin actions immutably, minimize permissions/secret scope, and emit injection-safe execution summaries. Static workflow contracts cover the source boundary. Hosted environment branch restriction, administrator-bypass policy, negative dispatch proof, commit, and push remain Gear Ball-owned deployment work.

Current proof boundary:

- local Kie security/transport tests pass `12/12`;
- generation ownership route/service/Media Library persistence tests pass `42/42`;
- the integrated OpenAI admission/runtime/SQL-security suite passes `128/128`; the broader refreshed focused security suite passes `177/177`; migration `224`/`225` and workflow contracts pass `36/36`; the Media Library upload-intent route/client/service batch passes `60/60`; full TypeScript, production build, and documentation checks pass at the recorded checkpoint;
- focused ESLint and `git diff --check` pass;
- the Phase 0 Supabase readback is production evidence; migration `223` was deployed by the user and its exact catalog posture is confirmed. After the user's deploy/apply pass, the runtime SQL audit saw the migration `224`/`225` object families in production and exposed two source-truth blockers: a stale Kanban RPC signature expectation and the missing `audio/m4a` staging-bucket MIME variant now covered by migration `226`. The Media Library prepare/finalize application batch requires migrations `225` and `226` before production audit signoff, while existing browser storage policies remain unchanged for unmigrated callers. No signed-upload canary, migration `226` apply, GitHub environment mutation, provider-spend canary, commit, or push has occurred in this lane.

Deployment checkpoint: confirm migrations `224` and `225` remain present, apply corrective migration `226`, then run the canonical runtime SQL audit and require zero failures before committing/deploying the source batch. After deployment, run a controlled paid Media Library signed-upload canary against `https://www.shortpulse.ai` and verify one intent-to-durable-row lineage plus staging cleanup. Do not deploy the Media Library route batch before migration `225`, because the new route intentionally fails closed when its intent RPCs or staging bucket are unavailable. Durable-bucket browser writes must not be revoked until every direct upload/overwrite/delete caller is migrated and a production signed-upload canary passes. Phase 1 hosted GitHub environment restriction and negative workflow proof remain Gear Ball-owned.

## Objective

Close the six confirmed or conditional launch-security boundaries from the July 10 comprehensive audit through canonical server/database authorities:

1. require durable paid-provider admission before exposed OpenAI work;
2. prevent authenticated direct writes and overwrites in durable Media Library storage;
3. bind Fal/Kie staging to paid, owned, expiring work;
4. remove caller-directed Kie media probing;
5. enforce generation child-to-parent ownership relationally and through least privilege;
6. ensure production SQL credentials are usable only by reviewed `production` code.

Done means all six boundaries have an implementation owner, exact source seam, safe sequence, focused tests, hosted proof gate, rollback boundary, and a stop condition. This document does not authorize implementation, hosted mutation, deployment, commit, or push.

## Planning Frame

### Source of truth

- Security finding record: `docs/records/artifacts/agent/dave-the-security-guy/reports/2026-07-10-comprehensive-security-research-audit.md`
- Security contract: `docs/security-checklist.md`
- Billing/credit authority: `docs/sops/sop_billing_credits_operations.md`, `frontend/lib/server/api/generationBilling/`, `billing_subscription_contracts`
- Generation admission: `docs/planning/ai-studio-generation-admission-rollout-plan.md`, `frontend/lib/server/api/generationAdmission/`
- Media admission: `frontend/lib/server/mediaUploadService.ts`, media prepare/finalize routes, `sql/storage_policies.sql`
- Provider staging: `frontend/pages/api/fal/upload-url.ts`, `frontend/pages/api/kie/upload-url.ts`, `frontend/lib/server/api/falCdnUpload.ts`
- Kie submit validation: `frontend/lib/server/providerIntegration/kieSubmitMediaGuards.ts`, `submitProviderDispatcher.ts`
- Generation relational ownership: migrations `034`, `071`, `072`, `076`, `093`, `132`; `sql/check_runtime_sql_security_audit.sql`
- Production SQL authority: the three `.github/workflows/apply-*-sql*.yml` workflows and the GitHub environment holding `SUPABASE_DB_URL`
- Deployment and migration governance: `docs/deployment.md`, `docs/sops/sop_sql_migration_operations.md`, `docs/database-migrations.md`

### Approved scope

- Server/API, SQL/RLS/storage, focused client call-site migration, tests, telemetry, and directly affected canonical docs.
- Domain-owned durable authorities with explicit lineage between upload intent, generation reservation, provider staging, and internal OpenAI capacity where those domains interact.
- Transitional compatibility only when it has an explicit removal phase, owner, validation gate, and deadline in this plan.
- Production-safe readbacks and negative probes after separate execution authority is granted.

### Non-goals

- No signup closure, free-credit grant, trial, hidden plan, or baseline account removal.
- No visible AI Studio, Media Library, Reference Grid, pricing, or workflow redesign.
- No mobile work.
- No broad malware platform, CSP campaign, WAF redesign, parser-hardening sweep, provider-cost optimization, or unrelated medium/low audit findings.
- No Supabase image transformations.
- No parallel upload authority, fallback billing path, client-selected provider authority, or process-local limiter treated as durable security.
- No orphan-object deletion, mismatch repair, production SQL apply, deploy, environment change, commit, or push without separate authority.

### Product-policy boundary

The recommended plan does not debit customer credits for the currently non-priced OpenAI conveniences. It treats them as paid/internal-comp account benefits governed by a separate durable internal-capacity allowance. That closes the security boundary without silently changing displayed pricing or customer balances.

Money Stuff approval is required only if implementation proposes converting any of these conveniences into a customer-credit debit. The fixed security contract is that baseline accounts receive no paid provider capacity, admission is durable and atomic, and retries share one bounded parent allowance.

### Proof requirements

- Static/source: exact route-to-authority wiring, no bypassing call sites, and security-contract tests.
- Local runtime: focused unit/API/SQL-source tests plus lint/build in proportion to touched scope.
- Hosted Supabase: catalog/grant/policy/constraint readback and approved two-user negative probes.
- Hosted GitHub: environment/branch/ruleset API readback and alternate-ref negative workflow proof.
- Production application: `https://www.shortpulse.ai` only; denied requests must show zero downstream provider/durable-storage mutation, and controlled paid canaries must show one end-to-end authority lineage.
- Provider: denied probes produce no provider object/request/cost delta; positive canaries require explicit spend authority.

### Plan stop condition

Planning stops when the implementation slices, dependencies, choices, tests, hosted gates, rollback boundaries, and completion proof are explicit. Implementation must stop at every hosted apply, provider-spend, destructive cleanup, deploy, commit, or push boundary unless separately authorized.

## Approach Comparison

### Approach A: Route-local checks and stronger rate limits

Add `assertPaid...` calls to each route, reduce byte limits, and replace some process-local limits with distributed counters.

Benefits:

- smallest initial diff;
- quickly blocks obvious baseline accounts.

Risks and breakage:

- leaves different routes with different interpretations of paid authority;
- does not bind staging to one owned generation or prevent replay;
- does not make storage inspection mandatory;
- creates repeated settlement and cleanup code;
- future routes can omit the check again.

Validation limitation: route tests can pass while provider/storage actions remain disconnected from durable work. Rejected as the final architecture.

### Approach B: Put all uploads and AI calls inside one monolithic submit route

Remove direct staging routes and make the generation submit handler accept raw media, stage it, reserve/call providers, and settle everything.

Benefits:

- easy ordering: admission before side effects;
- one obvious entry point for billable generations.

Risks and breakage:

- serverless request/body/runtime ceilings make large local media impractical;
- Voice Changer, reusable references, Media Library uploads, and non-generation paid AI do not fit one route;
- would create a god route and couple unrelated workflows;
- risks timeouts and visible upload regressions.

Useful piece retained: provider URL/storage staging should move inside the charged submit handler where payload size permits. Rejected as the universal upload architecture.

### Approach C: Domain-owned durable authorities plus narrow staging receipts

Use three non-overlapping canonical authorities: upload intents for browser-to-storage transport; the existing generation credit reservation for Fal/Kie provider staging; and a dedicated internal-capacity admission for exposed OpenAI conveniences. Issue short-lived, single-use staging receipts bound to the owning authority, user, purpose, provider/model where applicable, media kind/count/bytes, and derived path. Browser uploads go only to quarantine/staging. Durable promotion or provider staging consumes the receipt after inspection and authority proof.

Benefits:

- one canonical trust boundary without forcing large blobs through API routes;
- supports Supabase, Fal, Kie, OpenAI, generation and non-generation paid AI;
- replay/cross-user/path/provider changes can be rejected atomically;
- preserves existing UI and upload progress behavior;
- provides auditable upload-intent-to-finalization and reservation-to-staging-to-provider lineage without forcing unrelated lifecycles into one table.

Risks and breakage:

- requires a migration, cleanup worker/classification, call-site transition, and careful idempotency;
- revoking durable-bucket writes too early breaks browser uploads;
- overly narrow receipt expiry can break slow uploads;
- coupling all provider allowances to user credit debit would silently change pricing.

Validation path: two-user grant tests, concurrent consume tests, downstream-zero assertions on denial, storage policy tests, and hosted lineage readback.

Decision: use Approach C, retaining Approach B only for server-side URL/storage staging after reservation. Use distributed limits from Approach A solely as defense in depth. Do not create a universal admission table that duplicates billing, upload, and internal-provider authorities.

## Recommended Authority Model

### Upload intent authority

Add a service-role-only upload-intent table/RPC family for browser-to-storage transport. Minimum fields:

- immutable intent id, `user_id`, purpose, generated staging path, declared/allowed media kind and byte ceiling;
- lifecycle (`prepared`, `uploaded`, `claimed`, `finalized`, `rejected`, `expired`);
- expiry, claim/finalize timestamps, inspected media facts, and optional owning source ref.

This authority does not grant credits, provider access, durable signing, or Media Library entitlement. It proves only that bytes arrived through an approved, bounded transport and were claimed once.

### Fal/Kie provider authority

Reuse the existing `ai_credit_reservations` and generation `source_ref` as the paid provider authority. After reservation, server code resolves an owned upload receipt, applies provider-specific admission, stages the bytes, and dispatches the provider request. Do not add a second provider-credit or pre-submit reservation ledger.

### OpenAI internal-capacity authority

Add a distinct service-role-only table/RPC and server module for non-priced OpenAI conveniences. One parent admission binds the paid/internal-comp eligibility decision, route lane, provider, idempotency/source ref, internal budget ceiling, maximum attempts, status, expiry, and sanitized usage. It never mutates the customer credit ledger.

Only server RPCs may create or mutate these authorities. Browser-facing routes receive opaque, purpose-bound identifiers and cannot choose user, provider authority, billing reference, or destination path.

### Staging receipt

- Bound to exactly one upload intent and, for provider staging, one existing generation reservation; also bound to user, provider/destination, purpose, media kind, count/bytes, and generated namespace.
- Short-lived but long enough for current maximum supported upload on expected networks.
- Atomically consumed; concurrent replay yields one winner.
- Cannot authorize durable Media Library signing or reads.
- Unfinalized bytes remain quarantined and enter a bounded cleanup lifecycle.

### Failure semantics

- Admission failure: no storage/provider/OpenAI side effect.
- Staging failure before provider submit: release credit reservation exactly once when outcome is known.
- Provider timeout after dispatch: mark indeterminate; recovery/settlement owns resolution.
- Retry: reuse the same parent admission within its bounded attempt budget; never mint a fresh allowance silently.
- Database/admission dependency unavailable: fail closed with stable user-facing behavior and preserved inputs.

## Execution Plan

### Phase 0 — Entry proof and policy lock

Owner: Dave with Money Stuff, Nuclo, and Gear Ball checkpoints.

1. Confirm the current worktree/branch and isolate unrelated changes.
2. Confirm the default SEC-01 policy remains a paid/internal-comp internal allowance with no customer credit debit. Escalate to Money Stuff only if a pricing/debit change is proposed.
3. Nuclo performs read-only hosted Supabase evidence capture:
   - bucket configuration and `storage.objects` policies;
   - grants/policies/constraints for the five generation child tables;
   - mismatch counts only, without identity-bearing output.
4. Gear Ball maps the exact GitHub environment holding production DB authority, duplicate environment names, workflow consumers, and current production ruleset state.
5. Inventory every direct browser storage upload and every Fal/Kie upload-route caller. Classify each as Media Library durable upload, transient generation reference, workflow source, or provider staging.

Gate: do not implement until the no-hidden-debit policy and the inventories name every active caller. Stop if environment identity is ambiguous or mismatch cleanup would be destructive.

### Phase 1 — Production SQL authority containment

Owner: Gear Ball execution; Dave security acceptance.

1. Restrict the actual production-secret environment to `production` only.
2. Verify the active `Production` repository ruleset on the default `production` branch, then decide explicitly whether to remove or narrow its administrator bypass. The fresh readback already shows deletion, non-fast-forward, pull-request, required-check, and linear-history rules; do not describe this as an unprotected branch.
3. Reconcile duplicate Production-named environments; retire secrets only after every consumer is mapped.
4. Harden all three SQL workflows:
   - fixed production environment for production-mutating jobs;
   - job-level `github.ref == 'refs/heads/production'` gate;
   - first shell assertion before install or secret use;
   - explicit checkout of `refs/heads/production` and SHA verification;
   - immutable action SHAs and minimum permissions;
   - DB secret scoped to the exact `psql`/verification step;
   - summary containing trigger ref/SHA, checkout SHA, SQL SHA-256, actor, environment, and result.
5. Add static workflow contract tests.

Proof: GitHub API readback plus a non-production-ref negative dispatch rejected before environment-secret access. Run a harmless read-only canary before any production SQL apply.

Rollback: revert workflow code only after preserving the environment branch restriction. Never restore unrestricted environment use as a convenience rollback.

### Phase 2 — Domain authority schemas and server contracts

Owner: Dave implementation lane with Money Stuff contract review.

1. Add the upload-intent table/RPCs and the separate OpenAI internal-capacity admission table/RPCs. Do not create a universal admission table.
2. Use explicit `SECURITY DEFINER` search paths, service-role-only execute, RLS with no browser policies, unique idempotency keys, atomic consume, and bounded expiry.
3. Reuse existing `ai_credit_reservations` unchanged as the Fal/Kie paid provider authority; connect it to upload receipts through server-owned source refs/metadata rather than another billing ledger.
4. Add purpose-specific server modules under the existing media, generation billing/provider, and OpenAI API domains rather than a generic utility dumping ground.
5. Add sanitized admission telemetry and cleanup classification; no raw URLs, tokens, paths, or user identifiers in general telemetry.
6. Extend `sql/check_runtime_sql_security_audit.sql` for tables, RPC execute grants, RLS, and default privileges.

Proof: RPC concurrency/idempotency tests; anon/auth direct denial; service-role positive lifecycle; database-unavailable fail closed; `failing_checks = 0` in staging.

Rollback: application can stop minting new admissions; retain rows/RPCs for settlement and evidence until no active records remain.

### Phase 3 — Canonical Supabase upload path

Owner: Dave security boundary; Media ingest/save system remains the product owner.

1. Create or formalize a private quarantine/staging bucket/namespace with no general authenticated CRUD.
2. Migrate every browser upload caller to server-issued receipt-bound signed uploads.
3. Finalization must atomically validate:
   - receipt/user/path/purpose;
   - declared and magic-byte MIME;
   - decoded media constraints and aggregate size;
   - paid/storage entitlement and quota;
   - compliance acceptance where required;
   - one-time consume state.
4. Promote accepted bytes to the durable bucket with server authority and create the canonical row/usage accounting.
5. Ensure signing routes authorize durable rows/purpose, not merely existence under a user prefix.
6. Deny authenticated `INSERT` and `UPDATE` on the durable bucket, including upsert/overwrite.
7. Add cleanup for expired unfinalized staging objects.
8. Produce an aggregate orphan/mismatch report; cleanup is a separately approved operation.

Proof: direct SDK durable insert/update fails for baseline and paid users; signed staging works only for its receipt/path; rejected bytes never become signable; canonical paid upload creates exactly one row and quota delta; overwrite after inspection fails.

Rollback: keep new staging support while call sites transition. Do not restore durable-bucket authenticated writes after revocation; roll forward fixes to the canonical staging path.

### Phase 4 — Reservation-bound Fal/Kie staging

Owner: Dave security boundary; generation admission owns billing ordering.

1. Move server-fetchable URL/storage staging inside submit handlers after durable reservation.
2. Require a valid single-use staging receipt for browser/local-blob provider uploads.
3. Derive provider upload path and admission profile server-side.
4. Apply content admission to every binary, remote, and owned-storage source; prohibit profile-less arbitrary binary staging.
5. Reorder Kie GPT Image 2 staging so reservation precedes provider work.
6. Release reservations once on known pre-submit staging failure; mark indeterminate after uncertain provider dispatch.
7. Keep distributed account/provider quotas and existing rate limits as secondary defenses.
8. Remove the grantless Fal/Kie upload contract after all active call sites are migrated and telemetry shows no legacy use.

Proof: missing/expired/replayed/wrong-user/provider/model/path receipts cause zero provider calls; concurrent replay produces one provider call; reservation denial performs no staging; staging failure releases once; accepted submit binds reservation, staging, request, and settlement.

Rollback: during the bounded transition, disable new receipt enforcement only in non-production if necessary. Production must not restore grantless provider staging after cutover.

### Phase 5 — Kie SSRF removal

Owner: Dave.

1. Remove `probeUrlContentType` and the remote-probe environment toggle from `kieSubmitMediaGuards.ts`.
2. Require canonical staging receipts or server-reconstructed trusted provider URLs for Kie media.
3. Validate provenance, ownership, extension/media shape, and expiry locally without network access.
4. Make provider submit the fetchability boundary; normalize its failure without performing a separate caller-directed request.
5. Reuse a hardened SSRF-safe fetch primitive only for separately justified remote-ingest lanes; do not keep a hidden Kie fallback probe.

Proof: media guard never calls `fetch`; arbitrary external/private/link-local/redirect URLs are rejected before connection; valid staged receipt reaches dispatcher; no full URLs/tokens appear in logs.

Rollback: fix staging/provenance defects forward. Do not re-enable caller-directed probing.

### Phase 6 — OpenAI paid-provider admission

Owner: Dave security boundary with Money Stuff billing policy.

1. Wire the shared admission immediately before OpenAI dispatch in:
   - Standard agent runtime;
   - Pulse agent runtime/coordinator;
   - style extraction;
   - voiceover enhancement.
2. Treat retries, fallback models, vision, web search, and safe-completion recovery as bounded attempts under the same parent admission.
3. Keep already billed ElevenLabs transcription/title helpers under their existing generation admission; include their side-cost in observability rather than double charging.
4. Add distributed per-user/account/provider allowance controls and bounded input/output/tool budgets.
5. Settle actual usage where available; release known pre-dispatch failures and preserve indeterminate state on timeouts.

Proof: baseline account receives stable denial before provider mock/telemetry; paid/internal-comp authority behaves according to chosen policy; concurrent requests cannot overspend allowance; retries do not mint independent admissions; production canary shows one admission-to-usage lineage.

Rollback: disable the affected paid convenience rather than bypass admission if the authority service is unhealthy.

### Phase 7 — Generation relational ownership

Owner: Dave SQL security with Nuclo hosted apply coordination.

1. Read hosted grants/policies/constraints and capture aggregate mismatch counts.
2. Revoke anon/auth writes from server-owned queue, attempt, publication, and projection tables; preserve only required reads.
3. Move `ai_generation_outputs` browser mutation behind a canonical authenticated server route before revoking its writes, or retain the exact minimal grants during a documented transition.
4. Inventory and separately approve repair/quarantine of mismatched child-parent and output/media ownership.
5. Add composite ownership foreign keys using the existing parent `(id, user_id)` uniqueness:
   - child `(generation_id, user_id)` to `ai_generations`;
   - output/attempt references paired with `user_id`;
   - media references paired with `user_id` where applicable.
6. Add constraints `NOT VALID`, repair approved mismatches, validate, then remove redundant single-column constraints only where safe.
7. Strengthen RLS `WITH CHECK` and ownership-column immutability as defense in depth.
8. Extend runtime SQL audit for exact grants, policies, and validated composite constraints.

Proof: two-user insert/update attempts fail; service-role positive writes work; existing generation/media persistence smoke remains green; hosted catalog readback matches the contract; `failing_checks = 0`.

Rollback: restore a narrowly required grant only if runtime evidence proves incompatibility. Do not remove validated ownership constraints merely to restore a browser write path.

### Phase 8 — Integrated production proof and closeout

1. Run focused security suites, docs checks, lint, build, secret scan, and runtime SQL audit.
2. Deploy through the protected `production` path only after each phase's local/staging gate passes.
3. On `https://www.shortpulse.ai`, run production-safe negative probes first.
4. Run paid/provider-cost canaries only with explicit spend authority.
5. Read back admission, reservation, staging, provider request, durable media, and settlement lineage without retaining private payloads.
6. Confirm no UI/UX/signup/zero-credit balance behavior changed beyond fail-closed denial of paid capacity.
7. Update canonical security, deployment, migration, API, and Media Library/generation SOPs to reflect the implemented contract.

Completion proof: all six findings have source tests and the required hosted readback; denied operations demonstrate zero downstream side effects; positive canaries demonstrate one canonical authority lineage; unknowns are either closed or named as launch blockers.

## What Could Break

| Risk                                                 | Prevention/proof                                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Browser uploads fail after storage policy revocation | Complete caller inventory and staged-upload migration before revocation; paid canary before cutover.                               |
| Slow uploads outlive receipts                        | Base expiry on supported size/network envelope; refresh only before byte transfer and never after consume.                         |
| Duplicate provider uploads on retry                  | Admission idempotency plus atomic single-use receipt consume.                                                                      |
| Credits stay reserved after staging failure          | Known pre-dispatch failure releases exactly once; recovery handles indeterminate dispatch.                                         |
| Paid convenience is accidentally double charged      | Money Stuff policy lock; one parent admission; observability for downstream OpenAI side-cost.                                      |
| Existing generated output persistence breaks         | Move browser mutation server-side before grant revocation; preserve read contracts.                                                |
| Constraint validation fails on historical drift      | Aggregate preflight, `NOT VALID`, separately approved repair, then validate.                                                       |
| Production SQL access is locked out                  | Map real environment/consumers first; read-only canary; solo-owner-compatible protection without fictitious reviewer requirements. |
| SSRF returns through a fallback                      | Delete probe/toggle and assert media guard performs zero network calls.                                                            |
| Staging bucket becomes a second durable library      | No sign/list surface, strict expiry/cleanup, receipt-bound promotion only.                                                         |

## Implementation Stop Conditions

Stop immediately and report the exact boundary when:

- implementation proposes a customer pricing/debit change without Money Stuff approval;
- the production environment or Supabase project identity is ambiguous;
- hosted readback conflicts with the plan;
- existing mismatches require data repair/deletion not explicitly approved;
- an active upload caller cannot migrate without visible product change;
- the next action spends provider money, mutates hosted state, deploys, commits, pushes, or changes GitHub/Supabase controls without explicit authority;
- validation shows the canonical path cannot preserve intended behavior;
- remaining work belongs to a medium/low finding outside these six boundaries.

## Why This Plan Wins

The recommended plan uses domain-owned durable authorities and narrow capabilities instead of scattered plan checks, generalized upload permissions, a universal admission table, or a monolithic submit route. It closes cost, storage, content, SSRF, relational-integrity, and production-delivery boundaries at their owning seams while preserving the existing customer workflow. Transitional support is allowed only to migrate active callers and has an explicit removal gate; it never becomes a second authority.

## Remaining Unproven Facts

- Exact production Supabase storage policies and generation child grants/constraints.
- Existing child-parent and storage-orphan mismatch counts.
- Which GitHub environment variants currently hold production DB secrets and all consumers of each.
- Provider upload retention, billing, organization quotas, and denied-request cost behavior.
- Confirmation that exposed OpenAI conveniences remain an internal paid-account allowance with no customer debit; Money Stuff is required only if that product policy changes.
- Authenticated production two-user and paid-provider canary outcomes after implementation.

These are implementation entry gates, not reasons to dilute the plan.
