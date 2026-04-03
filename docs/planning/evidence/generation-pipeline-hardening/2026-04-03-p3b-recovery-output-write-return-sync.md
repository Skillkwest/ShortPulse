# 2026-04-03 p3b-recovery-output-write-return-sync

## slice_id
`p3b-recovery-output-write-return-sync`

## date_utc
`2026-04-03`

## phase
`Phase 3B`

## surface
- `frontend/lib/server/api/generationOutputs.ts`
- `frontend/lib/server/falIntegration/recoveryExecution.ts`
- `frontend/lib/server/falIntegration/__tests__/recoveryExecution.test.ts`

## commands_run
- `node --input-type=module` against approved dev Supabase via local env loader to classify convergence defects
- `npm -C frontend run test -- lib/server/falIntegration/__tests__/recoveryExecution.test.ts lib/server/generationControlPlane/__tests__/recoveryBatchExecution.test.ts lib/server/generationControlPlane/__tests__/observationBatchExecution.test.ts`
- `npm -C frontend run test -- lib/server/falIntegration/__tests__/recoveryExecutionRuntime.test.ts`

## results
- Runtime defect classification on approved dev data returned:
  - `success_with_outputs_total = 106`
  - `outputs_without_publications = 91`
  - all other Phase 3A defect buckets = `0`
- The newest live defect row showed:
  - `ai_generation_outputs.metadata.recovery_execution = true`
  - `generation_publications = 0`
  - `generation_projection.task_state = running`
  - `generation_projection.publication_state = pending`
  - `ai_generations.metadata.recovery_execution_at` present
- Chosen fix:
  - stop the recovery success path from rereading `ai_generation_outputs` immediately after write
  - return canonical output ids/urls from `persistGenerationOutputRecords`
  - feed those write-returned rows directly into publication/projection sync
- Regression coverage added for the exact stale-read shape:
  - output write succeeds
  - immediate reread is empty
  - publication/projection sync still uses write-returned rows

## failure_codes_asserted
- none added in this slice

## contract_parity_delta
- Recovery success convergence now depends first on the authoritative write response from `ai_generation_outputs`, with reread as fallback only.
- No runtime contract changes for queue submission, provider dispatch, settlement, or observation processing.

## rollback_note
- Revert the three touched files in this slice to restore reread-first recovery behavior.

## linked_pr
- `none`

## task_contract_checklist
- DoD:
  - runtime defect mix identified from approved dev data
  - first Phase 3B seam chosen from data, not conjecture
  - bounded fix implemented with focused regression coverage
- Required gates:
  - targeted recovery/control-plane tests passed
  - no unrelated UI files touched
- Docs/tracker/evidence parity:
  - evidence packet added
  - evidence index updated

## audit_findings
- blocking:
  - none
- non-blocking:
  - latest live defect also suggests a possible projection regression writer after recovery success; not addressed in this slice
- deferred:
  - rerun the Phase 3A defect classifier after fresh recovery traffic to confirm `outputs_without_publications` drops

## parity_check
- `pass`
- Notes:
  - slice stays inside the recovery publication/projection convergence seam
  - no queue-lane, billing-lane, or UI-surface drift

## changelog_decision
- `deferred`
- Owner/date: `Codex / 2026-04-03`
