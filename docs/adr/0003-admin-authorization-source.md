# ADR 0003: Admin Authorization Uses App Metadata or Email Allowlist

## Status
Accepted

## Context
- The admin surface (`/admin` and `/api/admin/*`) can adjust credits and view operational incidents.
- Previous logic treated both `app_metadata` and `user_metadata` role claims as admin authority.
- In Supabase, `user_metadata` is user-editable profile metadata and should not be trusted for privilege elevation.
- We need a durable, low-ambiguity rule for operator access with minimal operational overhead for a small admin team.

## Decision
- Admin authorization is granted by either:
  - `app_metadata.role`/`app_metadata.roles` containing `admin` or `operator`, or
  - Email allowlist match from `SHORTPULSE_ADMIN_EMAILS`.
- `user_metadata` is not used for admin authorization checks.
- Client-side admin gating mirrors the same role source (`app_metadata`) and still relies on server validation for final authority.

## Consequences
- Positive:
  - Removes a privilege escalation path tied to user-editable metadata.
  - Keeps authorization behavior explicit across API, UI, and ops docs.
  - Preserves a pragmatic fallback (`SHORTPULSE_ADMIN_EMAILS`) for small teams.
- Negative:
  - Environments relying only on `user_metadata` roles must migrate admin role claims to `app_metadata` or set the email allowlist.
- Follow-ups:
  - Keep runbooks and checklists aligned with this rule.
  - Add automated tests for admin auth helpers when test harness is introduced.

## Alternatives considered
- Continue trusting `user_metadata` roles: rejected due to unsafe privilege model.
- Email allowlist only: rejected because it is less expressive than role-based access and harder to delegate cleanly.
