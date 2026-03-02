# Phase 13 Wave H Pass 1: Operator Packet Readiness

Date: 2026-03-02  
Owner: Platform + Ops  
Status: Completed

## Scope
Complete Wave H H1 readiness by freezing UTC canary windows, locking the reproducible command packet, and publishing evidence templates for both decision windows.

## Frozen Window Packet (UTC)
1. `canary-1`
- `start_at`: `2026-03-01 18:46:07+00`
- `end_at`: `2026-03-02 18:46:07+00`
- checkpoint closes at/after: `2026-03-02T18:46:07Z`

2. `canary-2`
- `start_at`: `2026-03-02 18:46:07+00`
- `end_at`: `2026-03-03 18:46:07+00`
- checkpoint closes at/after: `2026-03-03T18:46:07Z`

## Locked Thresholds
1. `duplicate_settlement_count = 0`
2. `duplicate_media_persistence_count = 0`
3. `unresolved_no_media_percent < 0.1`
4. `recovery_success_percent >= 99` when `recovery_success_sample_size > 0`.

Decision rule:
1. window result is `PASS` only when all required checks pass.
2. promotion requires two consecutive `PASS` windows.
3. any hard-stop breach is rollback-first (`HOLD/ROLLBACK`).

## Reproducible Command Packet
1. Run local no-regression gate (quick):
```bash
bash scripts/phase11_shadow_checkpoint_gate.sh --quick
```

2. Optional guarded execution by window label:
```bash
node scripts/phase11_checkpoint_window_guard.mjs --window canary-1 --mode quick
node scripts/phase11_checkpoint_window_guard.mjs --window canary-2 --mode quick
```

3. Run SQL summary in Supabase SQL editor:
- file: `sql/check_phase11_shadow_canary_gate_summary_windowed.sql`
- set `params.start_at` and `params.end_at` to the frozen values above.

4. Save SQL output JSON and evaluate:
```bash
node scripts/phase11_evaluate_gate_summary.mjs --window canary-1 --file /tmp/phase13-canary1-gate.json
node scripts/phase11_evaluate_gate_summary.mjs --window canary-2 --file /tmp/phase13-canary2-gate.json
```

5. Optional packet automation (generates markdown-ready evidence from SQL JSON):
```bash
node scripts/phase13_wave_h_capture_packet.mjs --window canary-1 --file /tmp/phase13-canary1-gate.json --append-template
node scripts/phase13_wave_h_capture_packet.mjs --window canary-2 --file /tmp/phase13-canary2-gate.json --append-template
```

6. Record outputs in:
- `2026-03-02-phase-13-wave-h-canary-window-1-template.md`
- `2026-03-02-phase-13-wave-h-canary-window-2-template.md`

## Deliverables Published
1. Wave H operator packet readiness evidence note (this file).
2. Window-1 evidence template.
3. Window-2 evidence template.

## Risks
1. Running before checkpoint close can produce premature decisions.
- Mitigation: use `phase11_checkpoint_window_guard.mjs` gate timestamps.
2. Threshold drift between SQL/evaluator/docs.
- Mitigation: treat RCP-4 as canonical threshold authority.

## Gate Result
1. H1 readiness artifacts: `PASS`.
2. Next phase: H2 canary window execution.
