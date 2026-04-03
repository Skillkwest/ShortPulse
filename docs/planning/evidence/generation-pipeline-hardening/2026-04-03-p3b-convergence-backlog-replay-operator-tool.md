# 2026-04-03 p3b-convergence-backlog-replay-operator-tool

## slice_id
`p3b-convergence-backlog-replay-operator-tool`

## date_utc
`2026-04-03`

## phase
`Phase 3B`

## surface
- `scripts/replay_generation_convergence_backlog.ts`
- `docs/sops/sop_generation_recovery_diagnostics.md`
- `docs/monitoring.md`

## commands_run
- `npx tsx scripts/replay_generation_convergence_backlog.ts --limit 3 --scan-limit 50`
- `npx tsx scripts/replay_generation_convergence_backlog.ts --execute --expected-project-ref jwmcytzyhcvacjwqtynn --generation-id f29bf4a3-eeb7-41a7-b6b6-9da8bf53bfb9`
- `npm -C frontend run docs:check`

## results
- Confirmed operator gap:
  - `/api/internal/generation-recovery/run` cannot see backlog rows already in `recovery_state='recovered'`
  - `/api/admin/generation-recovery/replay` is single-row only
  - no existing repo-native batch helper targeted `outputs_without_publications`
- Added a bounded operator script that:
  - defaults to dry-run
  - targets only `status='success'` rows with outputs and zero publication rows
  - requires `--expected-project-ref` before any mutation
  - can run on explicit generation ids or bounded recent scans
  - rechecks publication/projection state after replay
- Runtime validation:
  - dry-run surfaced the expected backlog candidates
  - execute mode successfully replayed generation `f29bf4a3-eeb7-41a7-b6b6-9da8bf53bfb9`
  - post-replay state for that row became:
    - `publicationCountAfter = 1`
    - `projectionTaskStateAfter = success`
    - `projectionPublicationStateAfter = published`

## failure_codes_asserted
- none

## contract_parity_delta
- No runtime contract change.
- Adds an operator-facing remediation tool around the existing shared recovery engine.

## rollback_note
- Remove the script and revert SOP/monitoring references if this operator path is superseded.

## linked_pr
- `none`

## task_contract_checklist
- DoD:
  - operator gap confirmed from repo/runtime context
  - bounded helper implemented with environment guardrails
  - dry-run and real execute path validated
- Required gates:
  - helper stays dev-lane only and defaults to dry-run
  - docs updated to reflect the new operator path
- Docs/tracker/evidence parity:
  - SOP updated
  - monitoring doc updated
  - evidence packet added

## audit_findings
- blocking:
  - none
- non-blocking:
  - helper relies on `npx tsx` at invocation time; acceptable for operator use, but not yet a packaged npm script
- deferred:
  - decide whether to promote this into a first-class npm script after the backlog is drained
  - consider adding machine-readable before/after summary output if operators need larger replay windows

## parity_check
- `pass`
- Notes:
  - helper wraps the existing `executeGenerationRecovery(...)` authority rather than introducing a new mutation model
  - drain loop and replay path responsibilities stay explicitly separated

## changelog_decision
- `deferred`
- Owner/date: `Codex / 2026-04-03`
