# AI Studio Agent Rollout Operations SOP

Purpose: define the operational runbook for Phase 5 progressive rollout of the AI Studio agent hardening/modularization program.

## Scope
- In scope: staging soak, production canary rings (5/25/50/100), freeze decisions, rollback execution, and evidence capture.
- Out of scope: net-new product features, non-agent route changes, and legacy-route decommission execution.

## Preconditions (must be true before Phase 5 starts)
1. Phase 4 governance checks are in `enforce` mode and green.
2. Required checks remain passing on the rollout commit SHA.
3. Branch/ruleset evidence is refreshed in `docs/planning/evidence/docs/`.
4. `DEP-03` dashboard/alert wiring is marked ready in the tracker.
5. Incident packet template and rollback drill template are prepared.

## Ring Execution Order
1. Staging soak 24h.
2. Production 5% for 24h.
3. Production 25% for 24h.
4. Production 50% for 24h.
5. Production 100% only after all promotion gates pass.

Rule: only one active canary for this subsystem at a time.

## Promotion Gates (all required per ring)
1. p95/p99/5xx/timeout/refusal metrics stay within plan budgets.
2. No open Sev-1 or Sev-2 defects attributed to agent changes.
3. Contract, disable-path, and continuity suites remain green.
4. No doc/runtime/schema drift failures.
5. Rollback path for current ring is verified and documented.

## Freeze Triggers
1. Any hard-threshold breach in performance/reliability budgets.
2. Continuity SLI < 99.5%.
3. Contract rejection spike > 2x baseline.
4. Missing rollback verification evidence.

## Rollback Actions
1. Latency regression: disable latest rollout flag tier and revert to prior ring (target <= 15 minutes).
2. Contract break: route to last-known-good compatibility adapter (target <= 15 minutes).
3. Refusal spike: revert prompt/runtime policy flags (target <= 30 minutes).
4. Continuity failure: disable stable-session write path and use last-good fallback (target <= 30 minutes).
5. Legacy wrapper failure: bypass wrapper to canonical endpoint for first-party callers (target <= 30 minutes).

Rollback-first posture is mandatory unless explicitly waived by incident command.

## Required Evidence Per Ring
1. Rollout report entry with metrics and decision.
2. Dashboard screenshots/links for latency, error/timeout, refusal delta, continuity.
3. CI links for required checks on the deployed SHA.
4. Incident packet if freeze/rollback occurs.
5. Staging soak checkpoints recorded in checkpoint log before 5% promotion decision.
6. 5% promotion decision packet completed at soak exit.

Store evidence under `docs/planning/evidence/agent/phase-5/`.

## Post-Ring Close Checklist
1. Record pass/fail decision and approver in rollout report.
2. Update `docs/planning/ai-studio-agent-modularization-tracker.md` ring table.
3. Confirm next ring start time and owner handoff.
4. Re-validate alert routing/on-call coverage before promotion.
5. For staging soak -> 5% transition, ensure:
   - `docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-checkpoint-log.md` is updated through C4.
   - `docs/planning/evidence/agent/phase-5/2026-02-21-phase-5-5pct-promotion-decision-packet.md` is completed.
