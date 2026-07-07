# 2026-07-07 User Account Security Sweep

Status: complete for repo-local audit evidence. Hosted/live proof remains a separate approved validation lane.

Owner/lane: Dave the Security Guy, launch-readiness user-account security audit.

Objective: audit current ShortPulse repo evidence for user-account security risks: account isolation, auth/session and signup boundaries, profile/account mutation, billing and credits, Stripe/customer ownership, admin account authority, user-owned rows, private storage/media, signed URLs, project/workspace data, provider requests, and service-role helpers that could let one user reach or affect another user's account or private assets.

Mode: audit/report first. Do not change app code, SQL, UI, UX, intended behavior, hosted Supabase, Vercel, GitHub secrets, Stripe/customer state, or production data in this pass.

Source of truth loaded:

- Root startup contract: `AGENTS.md`
- Core repo docs: `docs/dev-ground-rules.md`, `docs/conventions.md`, `docs/agent-playbook.md`, `docs/README.md`, `docs/troubleshooting.md`, `docs/glossary.md`
- Scoped docs: `frontend/AGENTS.md`, `docs/AGENTS.md`
- Dave docs: `docs/agents/dave-the-security-guy/AGENTS.md`, `README.md`, `goal-prompt.md`, `memory.md`, `standard-operating-procedure.md`, `security-decision-framework.md`, `security-ownership-map.md`
- Account/security references: `docs/security-checklist.md`, `docs/deployment.md`, `docs/supabase_auth_setup.md`
- Relevant retained context: Dave reports index plus the prior Stripe/account, free-signup, and full-repo security sweep reports. These are historical context only; current code/SQL/docs outrank them.

Protected contracts:

- No UI/UX/product-behavior changes.
- No broad cleanup, generic error cleanup, route polish, fallback routes, backup paths, or speculative hardening.
- Do not expose raw secrets, tokens, signed URLs, customer-private data, raw logs, or raw env values.
- Mini Ecosystem is excluded by default.

Proof boundaries:

- Repo code/docs/SQL evidence can identify likely or confirmed source risks.
- Hosted Supabase/Auth/Vercel/Stripe posture and live browser behavior are not proven unless a separate approved production-safe validation step is run.

## Worktree Baseline

- Branch: `production`
- `shortpulse.allowedBranch`: `production`
- Existing dirty worktree at audit start contains unrelated docs, billing, AI Studio, media-library, profile, SQL, and new planning/component files. This audit treats those as pre-existing unless directly relevant to user-account security.
- Workspace artifact safety check found generated dependency/build directories (`frontend/.next`, `frontend/node_modules`, `node_modules`) but no generated backup directory was created or moved.

## Coverage Log

| Area                                            | Status   | Notes                                                                                                                                                                              |
| ----------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startup and Dave instructions                   | Complete | Current repo and Dave contracts loaded from disk.                                                                                                                                  |
| Prior account/security context                  | Complete | Loaded only directly relevant retained reports and will re-prove from current repo evidence.                                                                                       |
| Auth/session/signup/account mutation            | Complete | Protected API auth, callback/next handling, signup intent, bootstrap, profile/email mutation, authenticated fetch, AI Studio protected route, and stale-session handling reviewed. |
| Billing/credits/Stripe/customer ownership       | Complete | Stripe customer sync, checkout, portal, transactions, subscriptions, storage add-ons, webhooks, retired signup seed credits, and credit top-up eligibility reviewed.               |
| User-owned rows/projects/workspaces/preferences | Complete | Project APIs, workspace state, project associations, preferences, and direct browser Supabase calls reviewed against route gates and RLS.                                          |
| Media/storage/signed URLs/provider ownership    | Complete | Media list/signing/upload/finalize/delete/copy-from-url, storage paths, trusted fetch, generated media source authority, and paid Media Library access reviewed.                   |
| SQL/RLS/RPC/storage policy posture              | Complete | Account-owned table RLS, credit/billing grants, storage policies, and service-role-only credit RPC posture reviewed from SQL files.                                                |
| Admin account authority and deletion            | Complete | Admin access, users, credit adjustment/ledger, and deletion blockers reviewed.                                                                                                     |
| Secrets/session artifacts                       | Complete | Report artifact scanned for secret/session/signed-url patterns.                                                                                                                    |

## Current Evidence

- Protected API routing is centralized in `frontend/lib/server/api/protectedApiPaths.ts`; account, billing, credit, generation, media, provider, admin, and project APIs are either exact protected paths or protected prefixes, while only explicit webhook paths bypass bearer auth.
- `frontend/proxy.ts` verifies bearer tokens against Supabase Auth before forwarding protected API requests, and `frontend/lib/server/api/auth.ts` re-verifies the bearer user inside route handlers instead of trusting proxy headers as the identity authority.
- `frontend/pages/api/account/bootstrap.ts` creates or syncs a Stripe customer mapping for the authenticated user only; it does not grant credits or subscription entitlement.
- `frontend/lib/server/api/stripeCustomer.ts` verifies existing Stripe customer ownership through Stripe customer metadata before reuse and raises ownership mismatch errors instead of silently attaching one user's Stripe customer to another user's account.
- `sql/migrations/174_remove_legacy_signup_seed_credit_grants.sql` zeroes retired free-plan monthly credits and installs `trg_reject_retired_signup_seed_credit_grant`, blocking future positive `signup_seed` ledger inserts.
- Credit top-up surfaces (`frontend/pages/api/billing/credit-packages.ts` and `frontend/pages/api/billing/stripe/checkout.ts`) first require the authenticated user to have a non-free, active subscription contract before packages or checkout sessions are exposed.
- Subscription and storage mutation routes (`frontend/pages/api/billing/subscription/change.ts`, `frontend/pages/api/billing/storage-addon/change.ts`) load billing state by authenticated `user.id`, verify Stripe subscription/customer ownership before portal/subscription edits, rate-limit by user id, and do not accept client-supplied user/customer authority.
- Stripe billing transaction history resolves the Stripe customer from the authenticated user's billing state and verifies customer ownership before reading Stripe invoices.
- `frontend/pages/api/billing/stripe/webhook.ts` verifies Stripe signatures, claims `stripe_event_log` rows for event idempotency, releases claims on processing failure for retry, verifies Stripe customer ownership before checkout/subscription credit mutation, and grants credits through source-ref-protected `grantAccountCredits`.
- Project routes (`frontend/pages/api/projects/[...projectPath].ts`, `frontend/lib/server/projectApiRoutes/item.ts`, `frontend/lib/server/projectApiRoutes/workspace.ts`) require an authenticated API user and route every read/write through `user.id`.
- Project persistence helpers (`frontend/lib/server/projectsService.ts`, `frontend/lib/server/projectWorkspaceStatesService.ts`) scope project and workspace reads, updates, deletes, and preview/display rows by `user_id`; the workspace upsert path is gated by `getProjectForUser(user.id, projectId)` before writing.
- SQL project and project workspace policies (`sql/migrations/089_add_projects_foundation.sql`, `sql/migrations/091_add_project_workspace_states.sql`) enforce `user_id = auth.uid()` for select/insert/update/delete.
- Project media/prompt association SQL (`sql/migrations/092_add_project_asset_associations.sql`) combines RLS with composite foreign keys back to both the project owner and media/prompt owner, preventing cross-user project attachment at the database layer.
- User preference SQL (`sql/create_user_preferences_table.sql`) enables RLS and limits all preference reads/writes to `user_id = auth.uid()`. The direct browser Supabase preference writes seen in AI Studio therefore still sit behind per-user RLS.
- Media upload and finalize routes require authenticated users, media compliance acceptance, paid Media Library access, and user-scoped storage paths before persistent Media Library rows or storage objects are created.
- Media list, preview resolution, and signing routes query `media_files` by authenticated `user.id`, reject or skip non-user-scoped storage paths, and sign only private `media_library` objects that belong under the caller's user prefix.
- `frontend/pages/api/media/copy-from-url.ts` is backed by `mediaCopyFromUrlService`: it requires auth, paid access, user-id rate limiting, user-scoped path hints, trusted/public fetch validation, and for AI Studio media requires the remote URL or signed storage path to belong to the caller's own `ai_generation_outputs` or `generation_projection` rows.
- `sql/storage_policies.sql` keeps the `media_library` bucket private and enforces the first storage path segment equals `auth.uid()` unless the caller is `service_role`.
- `sql/migrations/190_require_paid_plan_for_media_library_inserts.sql` and `sql/migrations/207_exclude_unpaid_from_paid_access_statuses.sql` require a non-free active/trialing/past-due contract before authenticated users can insert persistent `media_files` or `media_prompts`.
- Billing and credit SQL (`sql/create_billing_credit_tables.sql`, `sql/migrations/084_harden_billing_profile_and_stripe_event_rls.sql`, `sql/migrations/200_add_credit_grant_lot_expiration.sql`) isolates billing profiles, subscription contracts, balances, ledgers, grants, reservations, and storage add-ons by `user_id`, restricts billing profile/webhook mutation to service role, rejects positive direct user ledger inserts, and revokes credit grant/debit/reservation RPC execution from public/anon/authenticated roles.
- Admin account routes require verified admin authority from app metadata, not client input. Admin deletion blocks self-delete and refuses user deletion while linked Stripe billing, nonzero credits, contracts, ledger/reservation activity, storage objects, media, projects, generations, or custom voices remain.

## Findings

### Finding A: Stale `/auth/callback` session can skip signup bootstrap

- Status: real repo code path, not a confirmed high-ROI launch security fix in this sweep.
- Severity: Low account-readiness risk. Raise to Medium only if live proof shows durable missing Stripe customer state causes billing/account support failure that downstream routes cannot self-heal.
- Confidence: Medium.
- Affected trust boundary: account-readiness and Stripe-customer mapping, not yet proven as cross-user access or credit leakage.
- Evidence: in `frontend/pages/auth/callback.tsx`, if an existing session is present and the callback flow is not recovery, the page primes the session and redirects to `nextPath` without requiring callback artifacts or running `/api/account/bootstrap`. The normal signup completion path does run bootstrap, and bootstrap itself is fail-closed/authenticated, but a stale-session/browser-history path may land an account in app UI before Stripe customer sync completes.
- Downstream check: billing checkout, portal, subscription, storage add-on, and transaction routes either ensure or verify the authenticated user's Stripe customer before Stripe operations. Credit package and checkout routes also require an active non-free contract before top-ups. This prevents the stale callback path from becoming free credits, Stripe customer impersonation, or another user's billing access in the current repo evidence.
- Launch impact: can explain “authenticated account without obvious Stripe presence” or inconsistent account setup visibility. It is not current evidence of credit grants, paid Media Library access, or access to another user's data.
- Root owner: auth callback page / account bootstrap contract.
- Recommendation: defer as a low-risk account-readiness hardening item unless production/live account evidence proves this is causing durable billing setup failure. If promoted, the canonical fix is to complete account bootstrap before redirecting on existing-session signup callback paths, without adding fallback routes or visible auth UX changes.

### Confirmed High/Critical Findings

No confirmed repo-backed high or critical user-account security issue was found in this sweep.

Specifically, this pass did not find current repo evidence that a normal user can:

- read or mutate another user's account/profile rows;
- access another user's credits, credit ledger, reservations, Stripe customer, subscription, payment history, or recurring storage add-ons;
- create positive credits through signup, direct ledger insert, credit top-up without a subscription, or authenticated RPC execution;
- list/sign/fetch another user's private Media Library object or signed storage path;
- attach another user's media/prompt/generation/project rows to their own project;
- use a provider/generation output URL that is not tied back to their own generation rows;
- reach admin account routes without verified admin app metadata.

### Dismissed Candidates

- Project workspace upsert collision: dismissed. Although `project_workspace_states` uses project-level conflict behavior, the route first verifies `getProjectForUser(user.id, projectId)`, helper reads/writes filter by `user_id`, and SQL has both RLS and a `(project_id, user_id)` foreign key back to owned projects.
- Media copy-from-url SSRF/cross-user import: dismissed for this account lane. The route is protected, paid-access gated, user-rate-limited, trusted-host/public-network validated through redirects, and AI Studio source URLs must match the caller's own generation/output authority.
- Direct browser Supabase calls for preferences, character/element objects, media references, and project associations: dismissed as a cross-user finding because the reviewed SQL policies enforce `user_id = auth.uid()` and the code paths also apply user-id filters in the inspected areas.
- Free signup equals free credits: dismissed in current repo evidence. Signup/bootstrap can create a real account and Stripe customer mapping, but no route reviewed grants credits or Media Library paid access solely for signup; retired `signup_seed` positive credit inserts are blocked by SQL.

## Residual Risk and Unproven Boundaries

- Hosted Supabase was not mutated or queried in this audit. The repo SQL posture is strong, but live production proof still requires a production-safe SQL/security-audit run against the actual Supabase project.
- Live Supabase Auth provider settings, redirect URL allowlists, SMTP/email template state, and dashboard toggles were not proven from repo files.
- Live Stripe webhooks were not replayed or mutated. Webhook code is signature/idempotency/ownership hardened from repo evidence, but provider-side endpoint configuration is a separate proof step.
- Admin credit adjustment can target a supplied user id under admin authority. Because it is admin-only and source-ref/idempotency protected, this is an operational sharp edge rather than a cross-user self-service leak; add user-existence preflight only if the admin-support lane wants extra operator safety.

## Recommended Next Step

The next highest-ROI step is not more repo tinkering. It is a production-safe verification lane:

1. Run the existing runtime SQL security audit against hosted Supabase using approved CLI/env handling, without exposing secrets.
2. Verify production Auth redirect/provider settings match the repo callback contract.
3. Verify Stripe webhook endpoint and signing-secret configuration are pointed at the deployed production route.
4. Optionally create one new production test account and prove zero-credit signup cannot generate, save persistent Media Library rows, buy top-ups without an active subscription, or access another user's project/media/account URL.

Stop condition reached: the repo-local account-security sweep has enough evidence to stop. Continuing inside the repo now would mostly become lower-ROI hardening or live-environment proof outside this audit's no-mutation scope.

## Running Notes

- Earlier July 1 full repo sweep reported no repo-backed cross-user account, credit, Stripe billing, private media, storage signing, admin, webhook, or prompt-injection authority leak. This sweep re-checked the core account surfaces from current repo files and reached the same account-security conclusion.
