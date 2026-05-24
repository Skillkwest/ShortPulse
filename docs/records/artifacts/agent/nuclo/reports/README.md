# Nuclo Reports

Purpose: store full environment audits, branch-to-environment maps, cutover packets, and validation summaries authored by Nuclo.

Current context note:

- Dated reports in this folder are historical snapshots.
- They may describe earlier branch-ladder decisions, cutover posture, or environment mappings that are useful for traceability but are not Nuclo's current standing branch instruction.
- For the current operating rule, use `docs/agents/nuclo/README.md` and `docs/agents/nuclo/memory.md`.

## Current Reports

- `2026-05-08-environment-separation-and-production-cutover-plan.md`: audited environment-separation, production-readiness, and cutover plan based on live Vercel, GitHub, and Supabase inspection.
- `2026-05-08-operator-runbook-and-environment-ledger.md`: exact approved environment ledger, value-mapping model, and execution order for production bootstrap and later cutover.
- `2026-05-08-production-bootstrap-progress-and-blockers.md`: live production bootstrap progress, current missing-table gap against staging, and the blocker that still prevents production cutover.
- `2026-05-08-production-data-migration-gates.md`: evidence that staging is already carrying live runtime data and storage objects, making data/auth/storage migration the new cutover gate.
- `2026-05-09-storage-parity-and-live-drift-freeze-gate.md`: evidence that storage parity is now solved and the remaining cutover gate is a coordinated freeze window for continued live writes.
- `2026-05-09-freeze-window-cutover-checklist.md`: audited freeze-window checklist for mandatory maintenance-window freeze, final sync, and Vercel/GitHub production rewiring.
- `2026-05-09-cutover-preflight-and-rollback-packet.md`: non-secret live Vercel/GitHub environment inventory and rollback-relevant facts captured before the final cutover window, preserved as a historical pre-cutover snapshot.
- `2026-05-09-production-cutover-execution-and-residual-risks.md`: execution record for the production Supabase cutover, the final live deployment IDs/aliases, validation evidence, and the post-cutover governance/config hardening that followed.
- `2026-05-09-post-cutover-secret-rotation-runbook.md`: exact non-secret rotation sequence for the credentials exposed during the production cutover lane.

## Organization Rule

- Use this folder for evidence-heavy environment audits, promotion plans, deployment-readiness packets, and cutover summaries.
- Keep short durable lessons in Nuclo memory instead of creating unnecessary reports.
