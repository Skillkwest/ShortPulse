# Dave Security Reports Index

Purpose: conditional-load index for Dave the Security Guy's sanitized retained security reports.

This index helps future Dave runs find relevant prior evidence without loading old reports by default. Reports remain non-authoritative retained artifacts; current repo code, SQL, canonical docs, and live provider/environment evidence outrank these notes.

## Load Policy

- Do not load this folder during ordinary Dave startup.
- Load this index when a current security lane may overlap prior Dave evidence.
- Open only the report that matches the current asset, trust boundary, or environment.
- Do not carry old route targets, hunches, or remediation plans forward unless current repo evidence re-proves them.

## Reports

| Report | Primary boundary | Use when |
| --- | --- | --- |
| `2026-05-23-prod-storage-state-exposure.md` | secret/session artifact exposure | Reviewing tracked credential/session evidence, storage-state files, or secret-scanner coverage. |
| `2026-05-23-security-remediation-prep.md` | initial security remediation planning | Checking historical prep context only; do not treat as current target authority. |
| `2026-05-30-generated-image-admitted-variant-security-review.md` | private media variants and service-role derivative helpers | Reviewing admitted generated-image derivatives, variant storage, or signed derivative URL scope. |
| `2026-06-01-account-isolation-billing-credit-audit.md` | account, billing, credit, storage entitlement RPCs | Reviewing user account isolation, Stripe/customer state, credits, or hosted storage entitlement grants. |
| `2026-06-02-media-storage-signed-url-isolation-audit.md` | media rows, private storage paths, signed URLs | Reviewing cross-user media leakage, media-list hydration, upload staging, or storage-path signing. |
| `2026-06-02-project-workspace-account-isolation-audit.md` | project rows, workspace snapshots, project API errors | Reviewing project/workspace isolation, snapshot reference sanitization, or sensitive project-route error disclosure. |
| `2026-06-02-provider-request-ownership-audit.md` | provider request IDs and service-role settlement | Reviewing Fal/Kie status polling, provider result hydration, generation settlement, or request ownership. |
| `2026-06-03-control-plane-scheduler-and-agent-safety-remediation-handoff.md` | Supabase control-plane scheduler timeouts and agent-safety RPC grant drift | Continuing Dave launch checks after Nuclo already completed the production Supabase remediation and hosted proof for this lane. |
| `2026-06-03-post-nuclo-control-plane-and-account-boundary-audit.md` | internal control-plane routes and account identity mutation | Checking Dave's continuation after Nuclo's Supabase remediation handoff, especially internal cron route auth and account/email/profile mutation boundaries. |
| `2026-06-03-custom-voice-ownership-boundary-audit.md` | ElevenLabs custom voice ownership and shared-provider isolation | Reviewing whether provider-created/cloned voices can be listed, used, or deleted across users through ShortPulse routes. |
| `2026-06-03-billing-credit-customer-boundary-audit.md` | billing, credits, Stripe customer, subscription, webhook, and admin billing isolation | Reviewing whether users can access or mutate another user's credits, Stripe customer/subscription, billing rows, transaction feed, or recurring storage billing state. |
| `2026-06-03-project-persistence-account-boundary-recheck.md` | project persistence rows, workspace snapshots, display rows, and preview signing | Rechecking whether Project Persistence can leak project/workspace/media/generation references across user accounts after regression concerns. |
| `2026-06-03-media-folder-membership-and-signed-delivery-boundary-audit.md` | Media Library folder membership, prompt/media rows, and private storage signing | Reviewing whether folder IDs, media IDs, prompt IDs, or signed media paths can cross user accounts through global Media Library APIs. |
| `2026-06-03-service-role-admin-internal-provider-boundary-audit.md` | service-role helpers, admin gates, internal cron routes, and provider webhook recovery | Reviewing whether non-admin users, unauthenticated callers, scheduler inputs, or provider payloads can cross privileged route or generation ownership boundaries. |
| `2026-06-03-prompt-injection-and-provider-state-boundary-audit.md` | AI Studio prompt-injection controls and Standard Responses provider-state handles | Reviewing whether user messages, Pulse context, image-derived text, runtime prompts, safety policy controls, or provider response IDs can cross authority or account boundaries. |
| `2026-06-03-generation-credit-provider-ownership-boundary-audit.md` | generation credit reservations, provider request ownership, direct-submit tracking, project/media attachments | Reviewing whether users can spend, reserve, poll, settle, associate, or attach provider generation state across another user's account. |
| `2026-06-03-token-first-auth-proxy-metadata-boundary-fix.md` | protected API auth, proxy-injected metadata, admin authorization | Reviewing whether caller-supplied `x-shortpulse-*` headers can influence verified user metadata or admin access. |
| `2026-06-03-auth-callback-return-path-boundary-fix.md` | auth callback URLs, password reset/signup/email-change return paths, open-redirect prevention | Reviewing whether auth `next` values can steer users away from the trusted ShortPulse origin. |
| `2026-06-03-email-confirmation-billing-error-boundary-fix.md` | email-change confirmation, downstream Stripe customer sync, sensitive account-route error safety | Reviewing whether email-change confirmation can leak raw billing/provider/internal errors to authenticated users. |
| `2026-06-03-production-auth-callback-url-smoke.md` | production auth callback URL host authority and hostile `next` handling | Checking whether deployed production matches the local auth return-path safety contract before full auth-email smoke testing. |
| `2026-06-03-dirty-worktree-secret-artifact-audit.md` | dirty worktree secret/session artifact exposure | Checking whether modified or untracked repo surfaces contain raw secrets, session tokens, signed URLs, storage-state files, or HAR captures before launch work continues. |
| `2026-06-03-adaptive-media-gate-security-classification.md` | adaptive media gate security relevance triage | Checking why Dave should not treat the current adaptive-media CI failure as a security fix unless fresh evidence shows a protected media-delivery boundary failure. |
| `2026-06-03-public-growth-telemetry-error-boundary-fix.md` | public growth telemetry error response boundary | Reviewing why `/api/telemetry/growth` must keep downstream telemetry/attribution failures behind stable generic public errors. |
| `2026-06-03-primary-generation-route-account-boundary-audit.md` | primary generation routes, provider request ownership, project/media attachment, and credit settlement | Checking current primary working generation routes for cross-user project/media/provider/credit leakage without pursuing legacy or fallback routes. |
| `2026-06-03-primary-account-billing-credit-route-boundary-audit.md` | primary account, billing, credit, Stripe customer, subscription, storage add-on, and webhook routes | Checking current primary working account/billing/credit routes for cross-user account, Stripe customer/subscription, credit, payment-history, or recurring-storage billing leakage without pursuing legacy or fallback routes. |
| `2026-06-03-billing-credit-storage-sql-rpc-boundary-audit.md` | billing, credit, storage entitlement SQL/RLS/RPC grants, and runtime SQL audit guardrails | Checking canonical SQL/RPC account isolation posture for billing, credits, storage entitlement helpers, and the security audit script that guards privileged grant drift. |
| `2026-06-03-primary-media-upload-list-signing-boundary-audit.md` | primary Media Library upload, prepared-upload finalize, list, signing, folder membership, and move boundaries | Checking whether a caller can list, sign, move, finalize, or folder-attach another user's media rows, prompt rows, storage paths, variants, or companion-art paths through primary media routes. |
| `2026-06-03-media-autosave-local-preference-isolation-fix.md` | Media Library autosave preference local fallback and per-user account isolation | Reviewing why signed-in autosave fallback localStorage must be scoped by authenticated user id so shared browsers cannot bleed account-local media persistence preferences across users. |
