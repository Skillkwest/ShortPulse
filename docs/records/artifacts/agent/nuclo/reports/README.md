# Nuclo Reports

Purpose: store full environment audits, branch-to-environment maps, cutover packets, and validation summaries authored by Nuclo.

## Current Reports

- `2026-05-08-environment-separation-and-production-cutover-plan.md`: audited environment-separation, production-readiness, and cutover plan based on live Vercel, GitHub, and Supabase inspection.
- `2026-05-08-operator-runbook-and-environment-ledger.md`: exact approved environment ledger, value-mapping model, and execution order for production bootstrap and later cutover.
- `2026-05-08-production-bootstrap-progress-and-blockers.md`: live production bootstrap progress, current missing-table gap against staging, and the blocker that still prevents production cutover.
- `2026-05-08-production-data-migration-gates.md`: evidence that staging is already carrying live runtime data and storage objects, making data/auth/storage migration the new cutover gate.

## Organization Rule

- Use this folder for evidence-heavy environment audits, promotion plans, deployment-readiness packets, and cutover summaries.
- Keep short durable lessons in Nuclo memory instead of creating unnecessary reports.
