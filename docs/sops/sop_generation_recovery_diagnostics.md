# SOP: Generation Recovery Diagnostics

Purpose: standardize how to investigate and triage stuck generation queue/recovery state and settlement integrity drift before any manual cleanup.

## Scope
- Fal generation queue/recovery blockers.
- Reservation settlement integrity after release/failure/recovery cycles.
- Read-only diagnostics first; guarded remediation only when explicitly approved.

## Prerequisites
- DB access with read permissions to:
  - `public.ai_generation_submit_queue`
  - `public.ai_generations`
  - `public.ai_credit_reservations`
  - `public.ai_credit_ledger`
- Use production-safe SQL scripts in `sql/`:
  - `sql/check_generation_queue_blockers.sql`
  - `sql/check_generation_settlement_integrity.sql`
  - `sql/check_runtime_sql_security_audit.sql`
- Incident context from runtime health:
  - `/api/internal/generation-recovery/run`
  - `/api/fal/queue-status`
  - operator traces/logs

## Workflow

1. Run blocker diagnostics (read-only).
   - Execute `sql/check_generation_queue_blockers.sql`.
   - Capture:
     - provider-attached reserved holds by age bucket
     - queue depth by status
     - queue hotspots by `user_id/model_id`
     - recovery backlog (`recovery_state`, `status`)
     - stale generation candidates (`>= 2h`)

2. Run settlement integrity diagnostics (read-only).
   - Execute `sql/check_generation_settlement_integrity.sql`.
   - Confirm:
     - non-waived released reservations that converged to success have exactly one `generation_charge`.
     - duplicate `generation_charge` keys by `(user_id, source_ref)` are zero.

3. Run security audit diagnostics (read-only).
   - Execute `sql/check_runtime_sql_security_audit.sql`.
   - Confirm no policy/RPC security regressions before remediation.

4. Prefer runtime recovery over SQL mutation.
   - Trigger `/api/internal/generation-recovery/run` repeatedly (with normal cadence) and re-check SQL diagnostics.
   - Only consider manual cleanup when counts are stable and clearly stale.

5. If manual cleanup is required, use strict guarded filters.
   - Use the commented remediation block in `sql/check_generation_queue_blockers.sql`.
   - Keep age filter (`>= 2h`) and recovery-state constraints.
   - Execute in a transaction and review returned IDs before commit.
   - If reservation release calls are required, run only for confirmed stale rows.

## Decision Rules
- Do not run write statements in diagnostics scripts by default.
- Never widen age/state filters during incident pressure.
- Never bulk-fail generations without capturing candidate evidence first.
- Re-run diagnostics after each remediation batch and stop when metrics normalize.

## Evidence To Capture
- Timestamped outputs for each diagnostics block.
- Candidate row counts before/after recovery runs.
- Any manual cleanup transaction output (`RETURNING` rows).
- Final integrity check output showing zero missing/duplicate settlement keys.

## Escalation
- If missing/duplicate settlement anomalies persist after recovery runs:
  - pause manual cleanup,
  - escalate to billing/runtime owners,
  - preserve evidence for postmortem and ledger reconciliation.
