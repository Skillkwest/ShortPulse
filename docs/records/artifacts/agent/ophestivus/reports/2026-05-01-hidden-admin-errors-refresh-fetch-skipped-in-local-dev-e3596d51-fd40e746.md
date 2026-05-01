# Hidden admin errors refresh fetch skipped in local dev

- Created: 2026-05-01T17:33:23.449Z
- Status: review-ready
- Ticket: e3596d51-5b8c-4f77-96c8-2273bb9eb0eb
- Incident: fd40e746-71b1-4c95-8550-9ab708711dd5

## Summary

Hidden-tab localhost Admin Errors live refresh logged high-priority client.api_network Failed to fetch incidents while the user was on /admin/kanban.

## Changes

Added a server-side skip for hidden local/development client.api_network Failed to fetch events on /api/admin/errors and /api/admin/error-events; visible failures remain actionable.

## Validation

Vitest app-error skip and exception-normalization tests passed. Helper ticket-report test passed. Targeted ESLint passed. npm run type-check passed. git diff --check passed. Recurrence check clean.

Recurrence: 0 open same-fingerprint incidents; 0 fresh events after 2026-05-01T17:32:23.000Z.

## Residual Risk

monitor: Production and visible admin failures still log; monitor for fresh same-fingerprint events after the skip rule.

## Post-run Training Audit

Completed ticket: e3596d51-5b8c-4f77-96c8-2273bb9eb0eb

Incident: fd40e746-71b1-4c95-8550-9ab708711dd5

Workflow rating: 9/10

Friction found: the compact ticket summary initially truncated the local report path, which weakened the Review SOP evidence path.

Tools/resources needed: no new standalone tool needed. The existing compact-ticket-report helper needed a safer report-path compaction rule.

Decision: helper enhancement applied immediately because the issue was small, repeatable, and directly affected the SOP.

Changes made: report path is now protected during ticket summary compaction, and a regression test confirms long summaries preserve the full report path.

Validation: helper test and targeted ESLint passed after the change. The current ticket summary was repaired with the full local report path before approval.

Next training improvement: consider adding a review helper check that warns when ticket details contain a truncated `Report:` value.
