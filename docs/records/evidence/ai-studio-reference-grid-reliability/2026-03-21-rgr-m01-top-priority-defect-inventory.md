# Reference Grid Reliability Evidence Packet: RGR-M01

- slice_id: RGR-M01
- date_utc: 2026-03-21
- phase: P0
- workstream: WG-1
- commands_run:
  1. `rg -n "scheduleBackgroundRecovery|clearRecoveryTimer|not_found|QUEUE_RESUME_NOT_FOUND" frontend/features/ai-studio/hooks/useAiStudioTasks.ts frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts`
  2. `nl -ba frontend/features/ai-studio/hooks/useAiStudioTasks.ts | sed -n '450,510p'`
  3. `nl -ba frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts | sed -n '256,320p'`
  4. `nl -ba frontend/lib/server/api/generationQueue/statusRecoveryKick.ts | sed -n '200,280p'`
  5. `nl -ba frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts | sed -n '196,252p'`
- results: completed defect inventory lock for `RGR-M01` with concrete seam references and P0 mapping
- risk_class: High
- rollback_note: documentation-only packet; rollback is remove/revert this packet and tracker reference
- linked_pr_or_commit: working-tree (planning-only)

## Scope
1. Capture the top-priority defects that explain "preview visible but grid missing/delayed" behavior.
2. Lock P0 target seams before behavior-changing implementation starts.
3. Provide source references for tracker rows `RGR-M02` through `RGR-M04`.

## Defect Inventory
1. Recovery timer cancellation race in hard-stop path:
   - `scheduleBackgroundRecovery(...)` is immediately followed by `clearRecoveryTimer(outputId)` in the same flow.
   - Reference: `frontend/features/ai-studio/hooks/useAiStudioTasks.ts:473-475`.
   - P0 mapping: `P0-S1` / `RGR-M02`.

2. Queue `not_found` fail policy can diverge across client/server paths:
   - Client resume watchdog applies retry+age gate before terminal fail.
   - Reference: `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts:273-289`.
   - Server status-claim path applies due/age/attempt filters independently.
   - Reference: `frontend/lib/server/api/generationQueue/statusRecoveryKick.ts:225-277`.
   - P0 mapping: `P0-S2` / `RGR-M03`.

3. Premature lifecycle cleanup risk around optimistic output rows:
   - Optimistic placeholder rows can be removed at multiple pre-submit guard exits.
   - Reference: `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts:205-243`.
   - P0 mapping: `P0-S3` / `RGR-M04`.

## task_contract_checklist
- [x] Objective and non-goal boundaries confirmed
- [x] Impacted seams identified with source references
- [x] Required docs and tracker links identified
- [x] Evidence packet stored in canonical namespace

## audit_findings
### blocking
1. None for planning lock; behavior-changing work remains gated by P0 slice execution.

### non-blocking
1. P0 implementation requires targeted tests across hooks and queue-status server seams.

### deferred
1. Hydration/decode convergence issues are intentionally deferred to `P2`.

## follow_up_actions
1. Complete `P0-S1` and attach timer-lifecycle evidence packet.
2. Complete `P0-S2` and attach cross-path `not_found` parity evidence packet.
3. Complete `P0-S3` and attach retention-window evidence packet.
4. Publish `P0-S4` closeout packet and mark `RGR-M02`..`RGR-M04` complete or waived.
