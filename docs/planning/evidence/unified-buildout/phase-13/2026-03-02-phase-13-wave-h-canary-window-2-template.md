# Phase 13 Wave H Canary Window 2 Template

Window label: `canary-2`  
UTC interval: `2026-03-02 18:46:07+00` -> `2026-03-03 18:46:07+00`

## Commands Run
1. `bash scripts/phase11_shadow_checkpoint_gate.sh --quick`
2. `node scripts/phase11_checkpoint_window_guard.mjs --window canary-2 --mode quick`
3. `sql/check_phase11_shadow_canary_gate_summary_windowed.sql` with frozen window bounds.
4. `node scripts/phase11_evaluate_gate_summary.mjs --window canary-2 --file <gate-json-file>`

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
3. Two-window outcome: `PROMOTE | HOLD | ROLLBACK`.

## Notes
1. Final decision must follow locked Wave H rules from RCP-4 and the Wave H closeout plan.
