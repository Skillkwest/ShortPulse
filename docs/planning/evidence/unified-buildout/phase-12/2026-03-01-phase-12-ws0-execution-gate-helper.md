# Phase 12 WS-0 Evidence: Execution Gate Helper

Date: 2026-03-01  
Owner: Engineering  
Status: Complete (helper added; WS-1..WS-6 still precondition-gated)

## Objective
Add a deterministic local helper so teams can quickly verify whether Phase 12 cleanup slices are still deferred or ready to execute.

## Implementation
1. Added script:
   - `scripts/phase12_execution_gate.mjs`
2. Added npm command:
   - `npm -C frontend run phase12:execution-gate`

## Gate Inputs
1. `--phase04-signoff <true|false>` (default `false`)
2. `--phase11-decision <pending|promote|hold|rollback>` (default `pending`)
3. `--run-validation <none|quick|full>` (default `none`)
4. `--allow-unsafe` (optional override; warns and proceeds even when blocked)
5. `--out-file <path>` (optional JSON summary output)

## Gate Logic
1. Blocks WS-1..WS-6 by default when any prerequisite is unmet:
   - Phase 04 signoff not complete.
   - Phase 11 checkpoint windows not closed (`canary-2` checkpoint not reached).
   - Phase 11 decision is still `pending`.
   - Phase 11 decision is `rollback`.
2. Returns exit code `2` for deferred state, so automation can detect blocked execution.
3. Can run canonical Fal regression validation only when requested (`--run-validation`).

## Example Commands
1. Check current status (expected deferred pre-signoff):
   - `npm -C frontend run phase12:execution-gate`
2. Check with explicit rollout inputs:
   - `npm -C frontend run phase12:execution-gate -- --phase04-signoff true --phase11-decision promote`
3. Emit JSON summary:
   - `npm -C frontend run phase12:execution-gate -- --out-file /tmp/phase12-gate.json`

## Result
1. Phase 12 execution readiness is now validated with a single deterministic command.
2. Cleanup execution remains safely deferred until signoff preconditions are met.
