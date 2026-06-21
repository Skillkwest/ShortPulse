# ADR 0093: Legal Policy Control Plane

## Status

Accepted

## Context

ShortPulse public legal pages (`/terms`, `/privacy`, `/refund-policy`) originally rendered Markdown files from `frontend/content/legal/`. That solved route availability, but it did not let an admin update legal documents globally without a deploy. Legal policy text is also a public commitment, so overwriting one current file without version history or stale-write protection is too weak for the launch posture.

Legal content authority remains outside implementation: Austerity, the user, or counsel-approved text controls what policy language may be published. The app needs a technical authority for storing and rendering approved documents.

## Decision

Use a service-role-only legal policy control plane as the runtime authority for public policy pages:

- `legal_policy_versions` stores immutable Markdown versions per slug.
- `legal_policy_runtime` points each managed slug to the active version and stores the stale-write token.
- `legal_policy_events` records publication events.
- `get_active_legal_policy` and `publish_legal_policy` are service-role-only RPCs.
- `/admin/legal` is the operator UI for editing/uploading Markdown or plain text, previewing, and publishing the three managed documents.
- `frontend/content/legal/` remains bootstrap seed content only; it is not the production runtime authority once the control plane is configured.

## Consequences

- Positive: Admin legal updates can affect public pages globally without a frontend redeploy.
- Positive: Policy publications get version history, attribution, and stale-write protection.
- Positive: Public legal routes keep stable URLs and footer behavior.
- Negative: Production readiness now requires migration `163_add_legal_policy_control_plane.sql` before the deployed app can use the live runtime authority.
- Negative: PDF storage/import remains outside v1; admins upload Markdown or plain text matching the existing renderer.
- Follow-ups: Add rollback UI only if the operator needs it after the initial publish workflow proves stable.

## Alternatives considered

- Edit repo Markdown from admin: rejected because deployed admin cannot safely mutate repo files and updates would still require deploy.
- Single active database row per policy: rejected because it lacks adequate audit and recovery posture for public legal commitments.
- PDF storage as canonical policy source: deferred because current public pages are text-rendered and PDF delivery would add accessibility, SEO, storage, and extraction questions.
