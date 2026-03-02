# Phase 13 RCP-4: Runtime Canary Threshold And Decision Tuning

Date: 2026-03-02  
Owner: Engineering  
Status: Complete

## Trigger
Required before Wave H (controlled webhook canary + closeout).

## Primary Sources Reviewed
1. `sql/check_phase11_shadow_canary_gate_summary_windowed.sql`
2. `scripts/phase11_evaluate_gate_summary.mjs`
3. `scripts/phase11_checkpoint_window_guard.mjs`
4. `scripts/phase11_shadow_checkpoint_gate.sh`
5. `docs/planning/stages/unified-phase-13-cross-plan-master-rollout.md`
6. `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-c-pass-4-webhook-canary-controls.md`
7. `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-f-pass-6-control-plane-sql-observation-window-1.md`

## Threshold Packet (Locked)
1. `duplicate_settlement_count = 0` (required).
2. `duplicate_media_persistence_count = 0` (required).
3. `unresolved_no_media_percent < 0.1` with `unresolved_min_age_minutes = 30`.
4. `recovery_success_percent >= 99` when `recovery_success_sample_size > 0`.
5. If `recovery_success_sample_size = 0`, mark recovery-rate gate as `N/A` and do not auto-fail the window.

## Window And Decision Rules
1. Use explicit UTC windows only (no rolling-time substitutions).
2. Run local regression gate before each checkpoint window:
   - quick: `bash scripts/phase11_shadow_checkpoint_gate.sh --quick`
   - full: `bash scripts/phase11_shadow_checkpoint_gate.sh --full`
3. Evaluate SQL one-row gate output with:
   - `node scripts/phase11_evaluate_gate_summary.mjs --window <label> --file <gate-json>`
4. Promote requires:
   - two consecutive window summaries with decision `PASS`,
   - zero duplicate-settlement/media counts in both windows,
   - no unresolved incidents outside threshold criteria.
5. Hold requires:
   - any single-window gate summary decision `HOLD`,
   - or missing/incomplete window evidence packet.
6. Rollback requires:
   - any duplicate-settlement/media count > `0`,
   - or unresolved-no-media rate materially above threshold (for example `>= 0.5%`),
   - or recovery-success rate materially below floor (for example `< 95%`) when sample > 0,
   - or confirmed production-impacting canary incident tied to webhook/status contract behavior.

## Counter-Metric Mapping
| Metric | Source | Threshold | Decision Role |
| --- | --- | --- | --- |
| `duplicate_settlement_count` | `check_phase11_shadow_canary_gate_summary_windowed.sql` | `= 0` | hard stop / rollback trigger |
| `duplicate_media_persistence_count` | `check_phase11_shadow_canary_gate_summary_windowed.sql` | `= 0` | hard stop / rollback trigger |
| `unresolved_no_media_percent` | `check_phase11_shadow_canary_gate_summary_windowed.sql` | `< 0.1%` | pass/hold discriminator |
| `recovery_success_percent` | `check_phase11_shadow_canary_gate_summary_windowed.sql` | `>= 99%` | pass/hold discriminator |
| `recovery_success_sample_size` | `check_phase11_shadow_canary_gate_summary_windowed.sql` | informational gate modifier | `N/A` handling for zero-sample windows |

## Rejected Alternatives
1. Rolling 24h checkpoint SQL for decisions:
   - rejected because scheduled wave windows require deterministic UTC interval evaluation.
2. Single-window promotion:
   - rejected to reduce transient-noise and low-sample decision risk.
3. Recovery-rate strict failure on zero-sample windows:
   - rejected because it blocks low-volume windows without signal.

## Implementation Locks From This Checkpoint
1. Wave H canary decisions must use explicit UTC window packets and evaluator output.
2. Promote/hold/rollback decision states must be recorded per window in Phase 13 evidence.
3. Any hard-stop metric breach requires rollback-first decisioning before further promotion attempts.

## Test/Gate Impact
1. Required local gate commands before each window:
   - `npm -C frontend run test:phase11:fal-regression` (quick)
   - `npm -C frontend run validate:phase11:fal-regression` (full)
2. Required SQL/evaluator pair per window:
   - run windowed SQL summary with exact `start_at/end_at`,
   - run `phase11_evaluate_gate_summary.mjs` against captured JSON result.
