# ADR 0003: Admin Authorization Uses App Metadata Roles Only

## Status

Accepted

## Context

- The admin surface (`/admin` and `/api/admin/*`) can adjust credits and view operational incidents.
- Previous logic treated both `app_metadata` and `user_metadata` role claims as admin authority.
- In Supabase, `user_metadata` is user-editable profile metadata and should not be trusted for privilege elevation.
- We need a durable, low-ambiguity rule for operator access on routes that can view or mutate any user's data.

## Decision

- Admin authorization is granted only when `app_metadata.role`/`app_metadata.roles` contains `admin` or `operator`.
- `user_metadata` is not used for admin authorization checks.
- Client-side admin gating mirrors the same role source (`app_metadata`) and still relies on server validation for final authority.

## Consequences

- Positive:
  - Removes a privilege escalation path tied to user-editable metadata.
  - Removes env-driven email-based privilege grants from the admin boundary.
  - Keeps authorization behavior explicit across API, UI, and ops docs.
- Negative:
  - Environments relying on `SHORTPULSE_ADMIN_EMAILS` must migrate operator access to `app_metadata` roles before admin APIs will authorize again.
- Follow-ups:
  - Keep runbooks and checklists aligned with this rule.
  - Add automated tests for admin auth helpers when test harness is introduced.

## Alternatives considered

- Continue trusting `user_metadata` roles: rejected due to unsafe privilege model.
- Email allowlist fallback: rejected because it turns mailbox control into admin authority and is weaker than explicit role-based access.
