# 2026-04-03 p3b-already-persisted-convergence-backfill

## slice_id
`p3b-already-persisted-convergence-backfill`

## date_utc
`2026-04-03`

## phase
`Phase 3B`

## surface
- `frontend/lib/server/falIntegration/recoveryExecution.ts`
- `frontend/lib/server/falIntegration/__tests__/recoveryExecution.test.ts`
- approved dev Supabase runtime backlog
- `scripts/replay_generation_convergence_backlog.ts`
- `sql/check_generation_convergence_defect_classes.sql`

## commands_run
- `npx tsx scripts/replay_generation_convergence_backlog.ts --execute --expected-project-ref jwmcytzyhcvacjwqtynn --limit 10 --scan-limit 200`
- `npm -C frontend run test -- lib/server/falIntegration/__tests__/recoveryExecution.test.ts lib/server/falIntegration/__tests__/recoveryExecutionRuntime.test.ts lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts`
- `npx tsx scripts/replay_generation_convergence_backlog.ts --execute --expected-project-ref jwmcytzyhcvacjwqtynn --generation-id f48de927-151a-45b5-9dbe-c6f05548382e --generation-id 6b915bfe-f17a-439e-bbbe-248c007789e8`
- `node --input-type=module` against approved dev Supabase via local env loader to inspect raw `generation_publications` / `generation_projection` rows for the two anomaly generations
- `node --input-type=module` against approved dev Supabase via local env loader to recompute convergence defect metrics

## results
- Batch 5 replay changed the posture from pure operator drain to a code-backed defect:
  - 8 of the 10 replayed rows converged normally
  - 2 rows returned `replayState = already_persisted` with `publicationCountAfter = 0` and no projection in the same replay output:
    - `f48de927-151a-45b5-9dbe-c6f05548382e`
    - `6b915bfe-f17a-439e-bbbe-248c007789e8`
- Raw row inspection showed the defect class precisely:
  - `ai_generation_outputs` already existed
  - `generation_attempts.metadata.recovery_outcome = already_persisted`
  - `generation_publications` and `generation_projection` were absent
- Root cause:
  - both `already_persisted` fast paths in `executeGenerationRecovery` returned after lifecycle/settlement updates without running publication/projection convergence
- Code change:
  - both `already_persisted` branches now call `syncRecoveredGenerationProjection(...)` before returning
  - focused tests now assert that already-persisted success paths publish outputs and upsert projection state
- Runtime validation of the patched code:
  - replaying the two anomaly generations through the current branch returned:
    - `replayState = already_persisted`
    - `publicationCountAfter = 1`
    - `projectionTaskStateAfter = success`
    - `projectionPublicationStateAfter = published`
  - raw table inspection after replay confirmed both `generation_publications` and `generation_projection` rows now exist for those ids
- Defect-class counts:
  - before Batch 5 execute: `outputs_without_publications = 47`
  - after Batch 5 execute but before code fix: `outputs_without_publications = 39`
  - after targeted replay through the patched code: `outputs_without_publications = 37`
  - all other defect buckets remained `0`

## failure_codes_asserted
- none

## contract_parity_delta
- No contract change.
- Fix restores convergence parity for already-persisted recovery outcomes instead of leaving publication/projection backfill incomplete.

## rollback_note
- Roll back this slice only if already-persisted recovery paths must stop creating publication/projection rows, which would re-open a confirmed convergence defect.

## linked_pr
- `none`

## task_contract_checklist
- DoD:
  - runtime anomaly reproduced and classified
  - already-persisted convergence fast path patched
  - focused recovery tests passed
  - live anomaly rows re-replayed and confirmed converged
  - defect-class counts rerun after fix
- Required gates:
  - no unrelated UI files touched
  - diff stayed inside recovery convergence lane
- Docs/tracker/evidence parity:
  - evidence packet added
  - evidence index updated

## audit_findings
- blocking:
  - none
- non-blocking:
  - remaining backlog is `37` rows, but the previously hidden already-persisted convergence gap is now closed for the two validated anomaly rows
- deferred:
  - resume bounded backlog drain only after this code slice is committed
  - if another non-draining replay state appears, classify it before assuming operator cleanup again

## parity_check
- `pass`
- Notes:
  - this slice keeps the operator workflow lean by fixing a real fast-path defect instead of layering more ad hoc replay behavior on top

## changelog_decision
- `deferred`
- Owner/date: `Codex / 2026-04-03`
