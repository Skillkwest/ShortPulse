# 2026-07-10 Comprehensive Security Research Audit

Status: complete, read-only

Owner/lane: Dave the Security Guy, launch-readiness security audit

Source of truth: current local production branch; current repo instructions; application, SQL, workflow, and test source; safe production HTTP probes; and explicitly named hosted readbacks. Historical reports were advisory until re-proved.

## Executive Verdict

ShortPulse has a strong user-isolation foundation. This sweep found no confirmed critical account takeover, cross-user credit theft, Stripe customer or payment-data leak, private-media read leak, admin bypass, XSS, CSRF, open redirect, exposed production secret, or prompt-injection path into privileged tools.

Six high-priority boundaries remain:

1. Authenticated zero-credit users can invoke OpenAI-backed routes without durable paid-provider admission or distributed spend limits.
2. Authenticated users can write directly to the private Supabase bucket under their own prefix, bypassing paid Media Library admission, aggregate quota, and app-level file inspection.
3. Fal and Kie upload staging exposes provider storage/egress without a credit reservation, paid entitlement, or workflow-bound grant.
4. Kie Kling media validation fetches caller-controlled URLs without private-network, DNS-rebinding, or redirect-hop defenses.
5. Generation child tables do not consistently enforce parent ownership; exploitability depends on hosted grants not read back in this lane.
6. Production SQL workflows can run from the manually selected Git ref, while the GitHub Production environment had no protection rules or branch policy at audit time.

These are trust-boundary issues, not UI defects. This audit changed no application code, SQL, hosted state, production data, provider state, UI/UX, product behavior, or Git state.

## Goal, Proof, And Stop

The goal was to assess common, advanced, and edge-case attacks across accounts, billing, data, storage, providers, browser security, AI, infrastructure, malware, and denial-of-wallet. A real finding needed an attacker action, crossed authority boundary, impact, current evidence, and canonical owner.

Proof labels:

- Source-confirmed: the defect exists in current local source.
- Hosted-confirmed: safe readback proved a hosted control state.
- Conditional: impact depends on a hosted grant or feature flag.
- Defense gap: useful hardening without a proven exploit.
- Dismissed: the end-to-end path did not support the candidate attack.

Local source/tests do not prove migration deployment or hosted configuration. Those unknowns remain explicit. The audit stops because all scoped domains have evidence or a named unknown, candidates were confirmed/downgraded/dismissed, findings are ranked, and further read-only scanning would mostly repeat work.

## Trust Map

Assets include Supabase identities/sessions, Stripe identity and credits, project/generation/media rows, private objects/signed URLs, service-role/admin/internal authority, production SQL credentials, provider capacity, prompts/uploads/URLs, telemetry, and logs.

Primary boundaries:

1. Browser to API: independently verify bearer identity.
2. User to paid capability: authentication is not spend authority.
3. API to service role/provider: caller identifiers are never authority.
4. Child row to parent: ownership must hold across every relationship.
5. Media/URL to parser/network: content and destination are hostile.
6. Model output to action: text must not become privilege.
7. Repository to production database: only reviewed production code gets production credentials.

## Ranked Findings

| ID               | Severity | Confidence                          | Proof                                   | Boundary                               |
| ---------------- | -------- | ----------------------------------- | --------------------------------------- | -------------------------------------- |
| SEC-01           | High     | High                                | Source-confirmed                        | user to OpenAI spend                   |
| SEC-02           | High     | High                                | Source-confirmed; hosted parity unknown | user to Supabase storage               |
| SEC-03           | High     | High                                | Source-confirmed                        | user to Fal/Kie capacity               |
| SEC-04           | High     | High                                | Source-confirmed                        | caller URL to server network           |
| SEC-05           | High     | High source / Medium exploitability | Conditional on hosted grants            | generation child to parent             |
| SEC-06           | High     | High                                | Hosted-confirmed                        | Git ref to production DB               |
| SEC-07           | Medium   | High                                | Conditional on production flag          | user content to global safety control  |
| SEC-08           | Medium   | High                                | Source-confirmed                        | hostile media to server resources      |
| SEC-09           | Medium   | High                                | Source-confirmed                        | remote fetch to network/memory         |
| SEC-10           | Medium   | High                                | Source-confirmed                        | CI dependencies to test credentials    |
| SEC-11           | Medium   | High                                | Defense gap                             | injection to persisted browser session |
| SEC-12           | Medium   | High                                | WAF unknown                             | distributed abuse                      |
| SEC-13 to SEC-18 | Low      | High                                | Source/scan confirmed                   | privacy, tooling, and resource edges   |

## High Findings

### SEC-01: Zero-credit users can consume OpenAI capacity

Attacker can create ordinary authenticated accounts and repeatedly call OpenAI-backed endpoints without a subscription or credits, causing provider spend and availability loss.

Evidence:

- frontend/features/agent-runtime/standardStudioAgentRuntime/runtime.ts:1027 authenticates but does not establish paid entitlement, credits, or a durable spend reservation before OpenAI.
- frontend/features/agent-runtime/pulseStudioAgentRuntime/runtime.ts has the same authentication-only admission.
- frontend/pages/api/ai/extract-style.ts:56-80 and frontend/pages/api/ai/voiceover-enhance.ts:26-45 invoke paid AI after authentication only.
- frontend/features/agent-runtime/studioAgentRequestGuards.ts uses a process-local Map rather than a distributed quota.
- Standard turns can add retries, vision, web search, and safe-completion recovery; runtime.ts:1379 shows an additional model request.
- The intended product contract admits real zero-credit accounts to AI Studio, so authentication cannot represent paid-provider authority.

Impact: denial of wallet, quota exhaustion, and service availability loss. It does not credit the attacker or spend another user's credit balance.

Canonical direction: one server-authoritative admission used by every paid AI operation, with entitlement/allowance or durable reservation before dispatch, distributed user/account/IP controls, bounded input/output cost, and consistent settlement.

### SEC-02: Direct storage writes bypass Media Library admission

An authenticated user can upload accepted MIME types directly to media_library under their own UUID prefix. This bypasses paid row admission, aggregate quota, and application signature/content inspection.

Evidence:

- sql/storage_policies.sql:5-44 permits listed media types up to 100 MB.
- sql/storage_policies.sql:65-89 authorizes insert/update based only on bucket and first path segment matching auth.uid().
- sql/migrations/190_require_paid_plan_for_media_library_inserts.sql:31-67 gates media_files/media_prompts, not storage.objects.
- Aggregate storage accounting is attached to media_files, leaving orphan objects outside it.
- frontend/pages/api/media/sign-batch.ts can sign existing caller-prefix objects, including direct orphan uploads.
- Normal finalization validates signature/MIME; direct object writes bypass it.

Impact: storage/egress abuse and hosting hostile bytes. The bucket is private, user-prefix isolation prevents cross-user reads, and SVG/HTML/script MIME types are not accepted, reducing browser code-execution risk. No antivirus/quarantine pipeline was found.

Canonical direction: remove general authenticated object insert/update authority. Use narrow server-authoritative upload grants or one app-owned staging/finalization path that proves entitlement, purpose, size/signature, quota, and ownership before an object becomes signable.

### SEC-03: Fal/Kie staging is not bound to paid work

An authenticated baseline account can consume provider upload capacity and receive provider-hosted URLs without a paid workflow or generation reservation.

Evidence:

- frontend/pages/api/fal/upload-url.ts authenticates and applies consent/process-local limits but no billing reservation or owned-workflow grant.
- frontend/pages/api/kie/upload-url.ts follows the same model and admits large uploads.
- Neither binds upload to a server-selected purpose, owned generation, expiring one-use grant, or durable quota.

Canonical direction: make staging subordinate to a server-created, user-owned, expiring workflow admission with bounded MIME/size/purpose and spend/quota reservation.

### SEC-04: Kie media probe permits SSRF

A paid attacker can cause ShortPulse to send HEAD, then selected ranged GET requests to caller-controlled HTTP(S) URLs while following redirects. Private/link-local destinations, DNS rebinding, and redirect destinations are not rejected.

Evidence:

- frontend/lib/server/providerIntegration/kieSubmitMediaGuards.ts:190-230 fetches with redirect: follow and GET fallback.
- Lines 233-237 enable remote probing by default outside tests.
- Validation checks syntax/protocol/media shape, not network destination.
- submitProviderDispatcher.ts invokes the guard before Kie submission.

Impact: private-service probing, metadata/link-local reachability, and side effects on internal GET endpoints. The body is not returned, limiting direct exfiltration; status/content-type/error behavior remains an oracle.

Canonical direction: one hardened fetch boundary with manual redirect validation, private/link-local/loopback rejection on every hop, DNS-rebinding-resistant connection behavior, strict time/byte limits, and allowlisting where possible. Do not GET an untrusted destination merely to infer MIME.

### SEC-05: Generation children do not prove parent ownership

If hosted authenticated write grants remain active, an attacker knowing another generation UUID can create attacker-owned queue/attempt/output/publication/projection rows referencing the victim generation. Global uniqueness can block legitimate writes or corrupt service-role consumers.

Evidence:

- Migrations 034, 071, 072, and 076 create child rows with user_id and generation_id.
- Modify policies prove child user_id = auth.uid(), not that the referenced parent belongs to the same user.
- Consistent composite ownership foreign keys are absent.
- Migration 132 hardens future defaults/selected tables but leaves existing grants in place.
- Direct authenticated persistence exists in mediaLibraryPersistence.ts, making hosted ACL state relevant.

Impact: cross-user integrity corruption and denial of persistence, not a proven confidentiality leak. Exploitability requires hosted grant proof.

Canonical direction: read hosted grants first. Revoke unnecessary direct writes; where intentional, enforce parent ownership in RLS and composite relational constraints.

### SEC-06: Production SQL workflows trust selected Git ref

An actor able to dispatch a workflow can use a ref whose workflow/SQL differs from reviewed production and run it with the production database secret. A read-only GitHub API readback found the Production environment had no protection rules or deployment branch policy.

Evidence:

- apply-hosted-sql-migration.yml, apply-control-plane-ops-sql.yml, and apply-conversation-state-migration-028.yml use workflow_dispatch, select the environment, and check out the triggering ref without a production-ref assertion.

Impact: repository/account compromise or dispatch error can become arbitrary production database execution.

Canonical direction: require refs/heads/production in workflow/job and fail-closed shell checks before secrets are consumed; restrict the Production environment to production; apply the strongest solo-owner-compatible approval; pin actions to reviewed immutable SHAs.

## Medium Findings

### SEC-07: Conditional user-triggered global safety rollback

When STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED is true, user-controlled content reaching a hard-floor classification can invoke a service-role global rollback. incidentAutoRollback.ts lacks trusted-actor, quorum, or repeated-event requirements. The variable exists in production configuration, but its encrypted value was not read; local configuration was disabled. Verify production, then make global rollback a trusted control-plane decision if enabled.

### SEC-08: Media parsers lack complete resource ceilings

ffmpeg processes in mediaAudioExtraction.ts, motionReferenceVideoNormalization.ts, and videoPosterVariant.ts lack consistent wall-clock/CPU/output ceilings. Sharp paths disable pixel limits. Crafted media can exhaust resources before rejection. This is DoS, not proven RCE. Use one constrained parser runner with byte, pixel, duration, frame, time, output, and concurrency ceilings.

### SEC-09: Shared provider fetch has DNS and buffering gaps

providerUploadSafety.ts resolves/checks a hostname, then fetches separately, leaving DNS rebinding/TOCTOU risk. Redirects are manually bounded and revalidated, which is strong. readProviderBodyWithLimit uses arrayBuffer before actual-size enforcement when Content-Length is absent/dishonest. Pin/revalidate the actual peer and stream with an aborting byte counter.

### SEC-10: CI credentials have excessive exposure

ci.yml places Playwright audit credentials at job scope, exposing them to checkout, mutable-tag actions, npm lifecycle scripts, build, and tests. No compromise was found. Scope credentials to the exact test step, pin actions to full SHAs, and make install-script exceptions explicit.

### SEC-11: CSP is broad relative to persisted sessions

Production CSP includes unsafe-inline, unsafe-eval, blob scripts, and broad HTTPS sources; Supabase sessions persist in localStorage. No exploitable XSS sink was found: React escapes user/model text and reviewed dangerous HTML used a source constant. This is defense in depth, not a confirmed XSS. Plan nonce/hash CSP only after the high findings and with Next.js compatibility proof.

### SEC-12: Process-local limits do not stop distributed abuse

rateLimit.ts accurately labels its Map limiter per-instance. Public database-writing routes and expensive authenticated routes can be distributed across instances/accounts. Vercel reduces forwarded-IP spoofing, but WAF rules were unavailable. Use edge/distributed controls for public abuse and durable account quotas for provider spend.

## Low Findings

- SEC-13: user_has_paid_media_library_access(uuid) is SECURITY DEFINER, accepts arbitrary UUIDs, and is executable by authenticated. It leaks a user's paid-status bit to a caller who knows the UUID. Derive auth.uid() or reject mismatches.
- SEC-14: auth callback error_description is rendered as escaped text. No XSS, but crafted trusted-domain URLs can display arbitrary phishing-like copy. Map codes to fixed messages.
- SEC-15: appErrorReporter.ts/authenticatedFetch.ts can retain endpoint query values, including searches and identifiers. Reuse existing URL redaction for persisted incidents.
- SEC-16: apply-hosted-sql-migration.yml interpolates sql_file inside a shell summary. Pass through env and print safely. SEC-06 is the larger authority issue.
- SEC-17: production npm audit found zero vulnerabilities. Full audit found high picomatch ReDoS and low esbuild Windows dev-server advisories, both development-only.
- SEC-18: Fal recovery/style-preview downloads buffer trusted provider results without a cap. Add streaming caps with SEC-09.

## Prompt Injection And Malware

Prompt injection conclusion:

- The Standard agent has web search but no model-callable billing, credits, signing, admin, shell, database, service-role, or provider mutation tool.
- Model actions are normalized to bounded app actions; model text is not executed as HTML/code.
- No cross-user RAG/retrieval corpus was found.
- Account/billing/data authority remains in server/database code rather than prompts.

Injection can manipulate answers or web-search content, but no path was found from model content to privileged authority, cross-user data, secrets, or arbitrary fetch. Preserve this architecture whenever tools are added. SEC-07 is the sole model-adjacent authority concern.

Malware conclusion:

- No archive extraction exists, so zip-slip/archive bombs are not currently applicable.
- Normal uploads use private paths, constrained types, and signature/MIME checks; SVG/HTML/script types are excluded.
- No antivirus/quarantine pipeline was found.
- SEC-02/03 matter because they bypass normal admission. Close bypasses first, establish one upload path, then add risk-based scanning for retained media types rather than parallel scanners.

## Strong Controls And Dismissed Candidates

Current evidence supports:

- Protected APIs reverify Supabase bearer tokens.
- Admin authority uses verified app_metadata.
- Stripe identity is bound to authenticated ownership; webhooks use signatures and idempotency.
- Credit reservation/settlement and paid generation are server-authoritative.
- Primary project/media reads and signed URLs pair identifiers with user ownership.
- Private objects are user-prefix scoped and signed for bounded periods.
- Auth return paths reject external/protocol-relative/backslash/auth-loop targets.
- Stale-session/history and PKCE callback paths have focused tests.
- Sensitive errors reviewed do not expose raw secrets/stacks.
- No permissive CORS; bearer APIs avoid ambient-cookie CSRF.
- Production blocks framing and uses HSTS; a sampled source map returned 404.

No supporting path was found for cross-user account/session access by URL, credit/Stripe theft, private-media reads through primary APIs, client-selected admin/service role, open redirects, prompt-to-XSS, privileged prompt injection, cache poisoning, archive extraction, or tracked production-secret exposure.

## Hosted Proof Gaps

1. Supabase migration parity, RLS state, grants/default privileges, function ownership/search_path, Auth settings, and storage policy parity.
2. Authenticated grants on SEC-05 generation tables.
3. Stripe webhook configuration, secret rotation, event set, and live product mapping.
4. Vercel WAF/rate-limit/bot rules and spend alerts.
5. Provider organization limits, budgets, upload retention, and abuse controls.
6. Production value of safety auto-rollback.
7. Supabase secure email change, MFA, session lifetime, breached-password protection, and Auth rate limits.
8. Authenticated production two-user isolation matrix after deployment.

These are not recorded as passed. No hosted database, Stripe, Vercel, provider, or production state was mutated.

## Validation

- Secret exposure script passed.
- Production dependency audit: zero vulnerabilities.
- Full audit: two development-only advisories.
- Package signature audit verified registry signatures/attestations.
- Main security suite: 9 files, 89 tests passed.
- Account/Stripe/admin lane: 197 tests passed.
- AI lane: 8 files, 50 tests passed.
- Browser/web lane: 11 files, 110 tests passed.
- SQL/source checks: 13 of 14 passed. One inventory assertion expected 62 RPC signatures while source has 64; this is stale test inventory, not proof of an unsafe RPC.
- Safe unauthenticated production probes confirmed 401s on sensitive APIs, no-store callback behavior, CSP/HSTS/frame protections, security.txt absence, and no sampled source-map exposure.
- Read-only GitHub inspection confirmed SEC-06 environment posture.

No exploit payloads, malware, paid requests, destructive operations, authenticated production mutations, or unauthorized penetration tests were run.

## Recommended Order

1. Close generic Supabase/provider upload admission (SEC-02/03) at one canonical upload/workflow authority.
2. Remove Kie SSRF (SEC-04) through one hardened fetch boundary.
3. Add durable paid-provider admission and distributed spend controls (SEC-01).
4. Read hosted generation grants, then enforce relational ownership/revoke unnecessary writes (SEC-05).
5. Restrict production SQL workflows/environment to production (SEC-06).
6. Add parser/fetch ceilings (SEC-08/09/18).
7. Verify/redesign safety rollback if enabled (SEC-07).
8. Address CI scope, WAF proof, callback/telemetry oracles, CSP, and dev dependencies.

Each implementation lane should fix one canonical boundary, preserve UI/UX and intended zero-credit signup behavior, add focused regression tests, and stop at deploy/hosted-apply authority.

## Primary Sources

- OWASP API Top 10: https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- OWASP File Upload: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- OWASP SSRF: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP GenAI Excessive Agency: https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
- OpenAI prompt injection: https://openai.com/index/designing-agents-to-resist-prompt-injection/
- OpenAI agent link safety: https://openai.com/index/ai-agent-link-safety/
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase functions: https://supabase.com/docs/guides/database/functions
- Supabase storage access: https://supabase.com/docs/guides/storage/security/access-control
- Supabase storage ownership: https://supabase.com/docs/guides/storage/security/ownership
- Supabase advisors: https://supabase.com/docs/guides/database/database-advisors
- Stripe webhooks: https://docs.stripe.com/webhooks
- Stripe idempotency: https://docs.stripe.com/api/idempotent_requests
- Vercel firewall: https://vercel.com/docs/vercel-firewall
- Vercel rate limiting: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- Next.js CSP: https://nextjs.org/docs/app/guides/content-security-policy
- GitHub secure use: https://docs.github.com/en/actions/reference/security/secure-use
- GitHub environments: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- GitHub script injection: https://docs.github.com/en/actions/concepts/security/script-injections
- NIST SSDF: https://csrc.nist.gov/pubs/sp/800/218/final

## Final Boundary

The research/audit goal is complete. The next correct move is a fresh implementation goal for SEC-02/03, followed by SEC-04. Do not continue broad security tinkering from this report. Re-audit the selected boundary, fix its canonical source, validate locally, and obtain separate deploy/hosted proof.
