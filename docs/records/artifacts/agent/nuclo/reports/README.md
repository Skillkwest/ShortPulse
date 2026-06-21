# Nuclo Reports

Purpose: store full environment audits, branch-to-environment maps, cutover packets, and validation summaries authored by Nuclo.

Current context note:

- Dated reports in this folder are historical snapshots.
- They may describe earlier branch-ladder decisions, cutover posture, or environment mappings that are useful for traceability but are not Nuclo's current standing branch instruction.
- For the current operating rule, use `docs/agents/nuclo/README.md` and `docs/agents/nuclo/memory.md`.

## Load Policy

- Do not load this whole folder by default.
- Start from the group below that matches the current task.
- Use `docs/agents/nuclo/README.md`, `docs/agents/nuclo/memory.md`, and `docs/agents/nuclo/CURRENT-HANDOFF.md` first for active operating guidance.

## Report Groups

### Targeted Schema And Storage Reviews

- `2026-05-30-generated-image-admitted-variant-nuclo-review.md`: Nuclo-only review of Gutan's proposed `admitted_reference_25mb` variant shape, migration impact, storage-accounting posture, and stop conditions.
- `2026-05-30-generated-image-admitted-variant-post-migration-proof.md`: hosted production proof after migration `140`, including lint, live constraint verification, storage-scope drift results, and the pre-deploy admitted-variant baseline.
- `2026-06-01-media-files-preview-field-authority-proof.md`: hosted production proof that `media_files` preview authority is canonical variant/original fields rather than a `preview_storage_path` column, including live PostgREST rejection evidence and the hand-back to Holomony.
- `2026-06-02-kie-vercel-production-env-audit.md`: read-only Vercel environment audit for Kie/Kling auth failures, covering key-name precedence, submit-URL override posture, effective env-pull observations, and the remaining contradiction between CLI pull output and operator dashboard claim.
- `2026-06-14-production-security-billing-proof-closeout.md`: production-only hosted SQL security and billing bootstrap closeout, including runtime SQL audit `failing_checks = 0`, signup trigger proof, billing readiness results, and explicit deferrals for Stripe/two-account/workflow proof.
- `2026-06-14-production-supabase-db-url-reliability-diagnostics-closeout.md`: production GitHub Environment `SUPABASE_DB_URL` session-pooler repair plus hosted reliability diagnostics closeout; environment connectivity passed, but async convergence proof remains blocked by nonzero production defect classes.
- `2026-06-20-supabase-egress-optimization-production-audit.md`: production egress optimization audit with live route proof, transform guard proof, storage and media byte-risk proof, Supabase dashboard service-split tooltip proof, and the current PostgREST-heavy optimization direction.

Load when:

- you need Nuclo's scoped answer on generated-image admitted derivatives
- you need the approved storage/schema shape for Gutan's Phase 5 review gate
- you need the exact migration, accounting, and validation requirements before implementation
- you need the post-migration hosted proof before Gutan deploys app code or runs production smoke
- you need the hosted proof packet for `media_files.preview_storage_path` browser `400` errors before Holomony removes stale app queries
- you need the Kie/Kling Vercel env audit packet before another agent continues the runtime auth-failure investigation
- you need the production security/billing hosted proof boundary before continuing Stripe, two-account isolation, or reliability-workflow release evidence
- you need the hosted production reliability diagnostics result after the GitHub `SUPABASE_DB_URL` IPv4/session-pooler repair
- you need the latest Nuclo proof packet for Supabase egress optimization, video variant coverage, storage object delivery health, dashboard service split, or PostgREST payload/cadence optimization

Load guidance for the egress report:

- Do not load the full report by default. Start at the latest dashboard/service-split and PostgREST payload sections unless the task explicitly asks for historical media/storage proof.
- Treat media/storage cleanup as secondary unless refreshed Supabase Usage proof shows Storage dominating again.

### Foundation And Environment Model

- `2026-05-08-environment-separation-and-production-cutover-plan.md`: environment-separation audit, production-readiness posture, and the original cutover plan.
- `2026-05-08-operator-runbook-and-environment-ledger.md`: approved environment ledger, value-mapping model, and execution order.

Load when:

- you need the original branch-to-environment-to-database model
- you need the earliest production cutover rationale
- you need the historical environment ledger

### Production Bootstrap And Migration Gates

- `2026-05-08-production-bootstrap-progress-and-blockers.md`: production bootstrap progress and missing-schema blocker state.
- `2026-05-08-production-data-migration-gates.md`: why production became a data/auth/storage migration problem rather than a schema-only problem.
- `2026-05-09-storage-parity-and-live-drift-freeze-gate.md`: storage parity proof and the freeze-window gate created by continued live writes.

Load when:

- you need schema/bootstrap history
- you need storage parity or migration-gate evidence
- you need to explain why historical cutover required a freeze window

### Cutover Execution Packet

- `2026-05-09-freeze-window-cutover-checklist.md`: maintenance-window checklist for final sync and production rewiring.
- `2026-05-09-cutover-preflight-and-rollback-packet.md`: non-secret pre-cutover inventory and rollback facts.
- `2026-05-09-production-cutover-execution-and-residual-risks.md`: execution record, validation evidence, deployment IDs, and residual risks after cutover.

Load when:

- you need the exact historical production cutover sequence
- you need rollback-relevant facts
- you need deployment-alias or validation evidence from the cutover run

### Post-Cutover Follow-On

- `2026-05-09-post-cutover-secret-rotation-runbook.md`: non-secret follow-on sequence for rotating credentials exposed during the cutover lane.

Load when:

- you need the historical secret-rotation sequence
- you need to separate cutover validation from later credential hygiene

## Organization Rule

- Use this folder for evidence-heavy environment audits, promotion plans, deployment-readiness packets, and cutover summaries.
- Keep short durable lessons in Nuclo memory instead of creating unnecessary reports.
- Prefer adding one targeted report to the right group over creating a new top-level pointer or duplicate summary file.
