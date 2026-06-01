# Dave Security Review Template

Purpose: reusable sanitized report template for Dave-led security reviews.

## Summary

- Date:
- Reviewer:
- Scope:
- Environment:
- Mode: review / implementation / incident response
- Launch relevance:
- Fix now or defer:

## Assets

- Protected data:
- Protected actions:
- Public entry points:
- Authenticated entry points:
- Server-only surfaces:

## Trust Boundaries

- Browser to Next.js:
- Next.js to Supabase:
- Next.js to providers:
- Internal cron/worker boundary:
- Admin/operator boundary:

## Findings

| Severity | Status | Launch ROI | Surface | Evidence | Impact | Recommendation | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  | confirmed / likely / speculative / blocked | high / medium / low |  |  |  |  |  |

## Validation

- Commands run:
- Manual checks:
- Blocked checks:
- Residual risk:

## Follow-Up

- Owner:
- Suggested next step:
- Backlog decision:
- Docs or SOP updates needed:
