# Phase 13 Wave H Canary Window 1 Template

Window label: `canary-1`  
UTC interval: `2026-03-01 18:46:07+00` -> `2026-03-02 18:46:07+00`

## Commands Run
1. `bash scripts/phase11_shadow_checkpoint_gate.sh --quick`
2. `node scripts/phase11_checkpoint_window_guard.mjs --window canary-1 --mode quick`
3. `sql/check_phase11_shadow_canary_gate_summary_windowed.sql` with frozen window bounds.
4. `node scripts/phase11_evaluate_gate_summary.mjs --window canary-1 --file <gate-json-file>`

## SQL One-Row Summary (paste JSON)
```json
[]
```

## Evaluator Output (paste summary + JSON)
```text
```

```json
{}
```

## Decision
1. Window recommendation: `PASS | HOLD`.
2. Hard-stop breach present: `yes | no`.
3. Promote eligibility status after window 1: `not yet eligible`.

## Notes
1. If `recovery_success_sample_size=0`, evaluator may report recovery as `N/A`; other required checks still govern PASS/HOLD.
