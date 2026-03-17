# Lane D Master Plan (2026-03-16)

Last updated: 2026-03-17  
Status: Active  
Owner: Engineering  
Roadmap anchor: `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`  
Tracker anchor: `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`  
Tracker spec: `docs/planning/lane-d-tracker-spec-2026-03-16.md`  
Execution plan: `docs/planning/lane-d-execution-plan-2026-03-16.md`  
Evidence root: `docs/planning/evidence/lane-d/`

## Summary
Lane D hardens runtime safety and stability in core production paths without behavior drift or scope bloat.

Locked objectives:
1. Remove high-signal runtime warning patterns in production seams (`set-state-in-effect` and related suppressions).
2. Retire emergency hard-disable debt that is now permanently forcing fallback behavior.
3. Reduce runtime diagnostic noise to explicit, intentional audit lanes.
4. Strengthen lane-specific runtime safety gates so regressions fail fast.
5. Keep touched files behavior-stable and non-bloating under strict slice discipline.

## Baseline Findings (Audit Snapshot)
As of 2026-03-17:
1. `npm -C frontend run lint` reports `7` warnings, including `4` high-signal `react-hooks/set-state-in-effect` warnings in active AI Studio paths:
   - `frontend/features/ai-studio/components/DetailModal.tsx`
   - `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts`
   - `frontend/features/ai-studio/hooks/useAiStudioEditSubmitIntent.ts`
2. One explicit suppression remains in a core split controller:
   - `frontend/features/ai-studio/hooks/useReferenceGridHorizontalSplit.ts` (`react-hooks/set-state-in-effect`)
3. Core AI Studio page still contains an unconditional emergency hard-disable:
   - `AI_STUDIO_EMERGENCY_DISABLE_SELECTOR_STORE = true` in `frontend/pages/ai-studio.tsx`
4. CI governance control-plane variables are currently in `enforce` mode for architecture/size/docs/migration/agent guardrails.
5. Existing tests cover key seams (`DetailModal`, `useAiStudioAgentBridge`, `useReferenceGridHorizontalSplit`) but `useAiStudioEditSubmitIntent` lacks direct hook-level tests.
6. Strict runtime lint profile currently fails with `4` errors and `3` remaining warnings, confirming live debt concentration in Lane D seams.
7. Full baseline `npm -C frontend run test` is currently red because of one unrelated admin ledger assertion failure in `frontend/tests/pages/admin.users-credits.test.tsx`; this is baseline noise, not Lane D runtime-warning debt.

## Scope
In scope:
1. Runtime warning elimination in production seams.
2. Hard-disable and risky fallback cleanup with rollback-safe policy.
3. Runtime logging hygiene in core flows.
4. Lane-specific gate updates and evidence policy for runtime safety.
5. No-bloat controls for touched hotspot files (line-count non-growth unless explicitly justified).

Out of scope:
1. Lane B structural modularization and decomposition.
2. Lane C characterization matrix expansion work.
3. Track P1 generation payload/dispatch/queue contract hardening.
4. Large image-rendering architecture rebuild work (separate project track).
5. Broad style-system/token migration work (handled in Lane B `B-Style`).

## Contact Matrix
Source of truth: `docs/operator-map.md`

| Contact Domain | system_id (operator map) | Primary owner | Backup owner | Primary runbook |
| --- | --- | --- | --- | --- |
| Adaptive/reference-grid runtime behavior | `adaptive_media_reference_grid_rendering` | worldbuilder | worldbuilder | `docs/sops/sop_adaptive_media_change_control.md` |
| Generation/credits stability signal handoff | `generation_submit_queue_recovery` | worldbuilder | worldbuilder | `docs/sops/sop_generation_recovery_diagnostics.md` |
| Incident/event visibility during runtime hardening | `admin_incident_ingestion_triage` | worldbuilder | worldbuilder | `docs/monitoring.md` |
| Security/auth boundary validation for runtime changes | `security_boundary_auth_rls_storage` | worldbuilder | worldbuilder | `docs/security-checklist.md` |

## No-Bloat Controls (Mandatory)
1. One seam per PR and one primary file focus per slice.
2. Net LOC for the primary file should reduce or stay neutral; increases require explicit tracker rationale.
3. No new runtime dependencies for Lane D scope.
4. No compatibility aliases or broad suppressions added without owner and sunset criterion.
5. Any kill-switch retained after cleanup must include owner, rollback trigger, and sunset target.

## Implementation Phases
### D0: Baseline Lock
1. Capture baseline outputs for `lint`, `type-check`, `build`, `docs:check`, `test`.
2. Capture warning inventory for touched runtime seams (including suppression count).
3. Freeze Lane D non-goals and rollback posture.
4. Record strict runtime lint profile output as a lane baseline artifact.

### D1: Effect Pattern Hardening
1. Remove `set-state-in-effect` warnings in:
   - `DetailModal` avatar synchronization flow.
   - `useAiStudioAgentBridge` session/tool reset flow.
   - `useAiStudioEditSubmitIntent` non-edit reset flow.
2. Convert implicit effect-driven state resets to explicit event/reducer/derived-state patterns where practical.
3. Add or extend targeted tests for touched seams (including direct tests for `useAiStudioEditSubmitIntent`).
4. Keep Lane C dependency rule: if fragile-path behavior ambiguity appears, capture characterization evidence before merge.

### D2: Suppression Retirement
1. Eliminate `react-hooks/set-state-in-effect` suppression in `useReferenceGridHorizontalSplit` by preserving synchronous behavior with safe alternative wiring.
2. Block new suppressions for this rule in active runtime surfaces.

### D3: Hard-Disable Cleanup
1. Replace unconditional emergency disable constants with explicit governed runtime controls or retire dead fallback branches.
2. Keep rollback-safe kill-switch posture where risk requires it, with owner and sunset criterion.
3. Validate parity on selector-store/page-decouple seams before and after cutover.
4. Audit stale emergency/temporary constants in reference-grid seams and either retire or explicitly document required retention.

### D4: Runtime Logging Hygiene
1. Gate perf/audit console logging behind explicit audit runtime controls and non-production defaults.
2. Remove accidental core-flow logging noise from production paths while preserving operational telemetry.

### D5: Guardrail Convergence
1. Add Lane D runtime-safety gate policy to CI/docs governance mapping.
2. Require lane-specific strict lint checks for touched runtime seams.
3. Close lane only after warning debt and suppression debt targets are met with evidence packets.
4. Publish concrete slice sequencing in the companion execution plan:
   - `docs/planning/lane-d-execution-plan-2026-03-16.md`

## Merge Gates
Per slice:
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run check:architecture-boundary`
4. `npm -C frontend run check:size-budget`
5. `npm -C frontend run build`
6. `npm -C frontend run docs:check`
7. Targeted tests for touched seams
8. Warning count must not increase for touched surfaces.

Lane D strict runtime check (required for D1-D4 slices):
1. `cd frontend && npx eslint pages features lib --ext .ts,.tsx,.js,.jsx --rule 'react-hooks/set-state-in-effect:error' --rule 'react-hooks/exhaustive-deps:error'`

Adaptive/reference-grid protection (when touched):
1. `npm -C frontend run test:adaptive-v2-gate`

Final gate:
1. `npm -C frontend run test`

## Assumptions And Defaults
1. No new runtime dependencies are introduced in Lane D.
2. Behavior/UI/API contracts remain unchanged unless explicitly approved and documented.
3. Any retained kill-switch or compatibility branch must include owner and sunset criterion.
4. Lane D slices stay isolated from Lane B modularization and Track P1 pipeline hardening.
5. Low-signal warning cleanup outside Lane D seams is deferred unless touched by a Lane D slice.
