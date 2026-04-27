# Generation Pipeline Hardening Evidence

Purpose: store execution evidence packets for Track P1 generation-pipeline hardening slices.

## Required packet fields
1. `slice_id`
2. `date_utc`
3. `phase`
4. `surface`
5. `commands_run`
6. `results`
7. `failure_codes_asserted`
8. `contract_parity_delta`
9. `rollback_note`
10. `linked_pr`
11. `task_contract_checklist` (DoD, required gates, docs/tracker/evidence parity)
12. `audit_findings` (`blocking`, `non-blocking`, `deferred`)
13. `parity_check` (`pass`/`fail` + notes)
14. `changelog_decision` (`updated` or `deferred` with owner/date)

## Audit budget rule
- If more than 2 non-blocking findings are discovered in one slice, stop scope expansion and open a follow-up slice.
- Cross-domain findings are logged for follow-up unless they are release blockers for the current slice.

## Naming format
Use dated packet names:
- `YYYY-MM-DD-<slice-id>-<short-topic>.md`

Examples:
- `2026-03-16-p1-01-shared-contract-gate.md`
- `2026-03-16-p3-02-dispatch-hardening.md`

## Linked docs
- `docs/archive/planning/generation-pipeline-hardening-master-plan-2026-03-16.md`
- `docs/archive/planning/generation-pipeline-hardening-tracker-spec-2026-03-16.md`
- `docs/archive/planning/generation-pipeline-hardening-contact-map-2026-03-16.md`
- `docs/archive/planning/generation-pipeline-hardening-execution-plan-2026-03-16.md`

## Packets
- `2026-03-17-p0-01-baseline-lock.md`
- `2026-03-17-p1-01-shared-contract-gate.md`
- `2026-03-17-p2-01-contract-completeness.md`
- `2026-03-17-p3-01-submit-hardening.md`
- `2026-03-17-p3-02-dispatch-hardening.md`
- `2026-03-17-p3-03-identity-invariant-lock.md`
- `2026-03-17-p4-01-claim-collision-remediation.md`
- `2026-03-17-p5-01-docs-adr-closeout.md`
- `2026-04-02-p0a-p0b-runtime-posture-and-executor-path-baseline.md`
- `2026-04-02-p1a-p1b-telemetry-persistence-and-baseline.md`
- `2026-04-02-p2a-worker-cadence-latency-reduction.md`
- `2026-04-02-p2a-dispatch-priority-reorder.md`
- `2026-04-02-p2a-queue-claim-generation-field-hoist.md`
- `2026-04-03-p2a-control-plane-stage-timing-attribution.md`
- `2026-04-03-p2a-dispatch-substage-and-attempt-fast-path.md`
- `2026-04-03-p2a-capacity-query-tightening.md`
- `2026-04-03-p2a-queue-remove-before-projection-sync.md`
- `2026-04-03-p2a-single-write-accepted-running-attempt.md`
- `2026-04-03-p2a-parallel-shared-capacity-snapshots.md`
- `2026-04-03-p2a-provider-submit-diagnostics-attribution.md`
- `2026-04-03-p2a-deferred-dispatch-tail-flush.md`
- `2026-04-03-p2a-insert-first-accepted-running-attempt.md`
- `2026-04-03-p2a-reservation-submit-metadata-trim.md`
- `2026-04-03-p2b-guarded-claimed-batch-concurrency.md`
- `2026-04-03-p2b-per-pass-capacity-snapshot-cache.md`
- `2026-04-03-p2b-generation-transition-metadata-trim.md`
- `2026-04-03-p2b-provider-submit-target-attempt-diagnostics.md`
- `2026-04-03-p2b-queued-post-submit-commit-rpc.md`
- `2026-04-03-p2b-burst-tail-reassessment-stop-check.md`
- `2026-04-03-p3a-convergence-defect-class-definition.md`
- `2026-04-03-p3b-recovery-output-write-return-sync.md`
- `2026-04-03-p3b-recovery-output-write-return-runtime-validation.md`
- `2026-04-03-p3b-convergence-backlog-replay-operator-tool.md`
- `2026-04-03-p3b-bounded-backlog-replay-batch-01.md`
- `2026-04-03-p3b-bounded-backlog-replay-batch-02.md`
- `2026-04-03-p3b-bounded-backlog-replay-batch-03.md`
- `2026-04-03-p3b-bounded-backlog-replay-batch-04.md`
- `2026-04-03-p3b-already-persisted-convergence-backfill.md`
