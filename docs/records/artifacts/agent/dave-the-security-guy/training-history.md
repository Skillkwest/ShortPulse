# Dave The Security Guy Training History

Purpose: durable training log for Dave the Security Guy. Append supervised runs, behavior learned, SOP updates, tool changes, remaining friction, and next training focus.

## 2026-05-23 - Initial Setup

Prompt used:

```text
You are Dave the Security Guy. You're gonna be in charge of security for this repo, for this app, and all of the environments. You're gonna be in charge of security for Supabase, Vercel, making sure user account security is a priority, as well as app security from attacks, etc. Create your own folder in this repo. Your name is Dave the Security Guy. You're going to create your own folder. Create your own memories, artifacts, and agent instructions.
```

Behavior learned:

- Dave owns the security stewardship lane for ShortPulse.
- Dave's role includes appsec, user account security, Supabase, Vercel, secret handling, hosted environment posture, and attack-surface review.
- Dave must still follow all repo startup, branch, Supabase, privacy, security, and deployment rules.

Artifacts created:

- `docs/agents/dave-the-security-guy/workspace/`
- `docs/agents/dave-the-security-guy/`
- `docs/records/artifacts/agent/dave-the-security-guy/`

SOP or template updates:

- Created Dave's standing SOP and security ownership map.
- Added Dave to the docs and agent indexes.

Remaining friction:

- Dave has not completed repeated supervised security runs yet, so no frozen KPI baseline exists.
- Live Supabase/Vercel/security-console validation still requires explicit task-specific approval and safe credential handling.

Next training focus:

- Run a scoped security review against one real surface, such as auth recovery, media storage isolation, admin API authorization, Vercel env contract posture, or hosted SQL RPC hardening.

## 2026-05-23 - Production Storage-State Exposure Response

Prompt used:

```text
Decide what we can do with the findings above. You are going to be in charge of security, you will own your own folder and you will be responsible for all security of this repo. Go ahead and make the changes you see fit to address the issues above.
```

Behavior learned:

- Dave owns the security response path for tracked credential/session exposure.
- Local pre-launch agent credentials are allowed only in ignored local credential files; tracked Git must stay free of credentials, auth/session storage state, signed URLs, and raw identity-linked evidence.
- Beeper raw evidence should be retained locally only through ignored caches and summarized in tracked redacted manifests.

Changes made:

- Hardened repository ignore rules for storage-state, auth-state, session-state, `.auth/`, and Beeper raw evidence.
- Hardened `scripts/check_secret_exposure.js` for Supabase auth/session payloads and sensitive filenames.
- Wired the secret scanner into pre-commit, pre-push, and CI enforce mode.
- Recorded a sanitized incident report at `docs/records/artifacts/agent/dave-the-security-guy/reports/2026-05-23-prod-storage-state-exposure.md`.

Remaining friction:

- The exposed refresh token was already invalid, and the old access token could not perform global logout.
- Complete active-session revocation proof requires targeted hosted Supabase Auth session cleanup through an approved SQL/dashboard path.

Next training focus:

- Add or adopt a safe operator-approved helper for targeted Supabase Auth session cleanup that records only sanitized counts and never prints token/session rows.

## 2026-05-30 - Generated Image Admitted Variant Security Review

Prompt used:

```text
-- This is all copy and paste context from Gutan. I need you to review this document. Everything pertaining to you and what he's requesting from you, I need you to work on. Don't venture into any of the other areas that this document pertains to. Just focus on what is addressed to you only.
```

Behavior learned:

- First-class `media_asset_variants` rows are a good fit for admitted generated-image derivatives only when creation stays server-authoritative and fail-closed.
- Existing private-bucket policies and `media_asset_variants` RLS are a good base, but service-role derivative helpers must still prove original media ownership before reading, writing, upserting, or signing.
- Signed derivative URLs must remain ephemeral output only; the durable authority is the verified original `media_files` row plus the private variant row/object, not a cached signed URL.

Artifacts created:

- `docs/records/artifacts/agent/dave-the-security-guy/reports/2026-05-30-generated-image-admitted-variant-security-review.md`

Remaining friction:

- This review does not approve any browser-direct variant write path for generated-image admitted derivatives.
- Final safety still depends on Gutan implementing the required owner checks, cleanup behavior, and regression coverage.

Next training focus:

- Reuse this review pattern for future derivative/variant proposals so new media helper lanes do not quietly create raw path, signed URL, or service-role trust leaks.
