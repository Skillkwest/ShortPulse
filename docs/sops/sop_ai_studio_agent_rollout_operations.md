# AI Studio Agent Rollout Operations SOP

Purpose: define the operational runbook for progressive rollout of AI Studio agent runtime changes, including the prompt-compiler remediation stream.

## Scope
- In scope: staging soak, production canary rings (5/25/50/100), freeze decisions, rollback execution, and evidence capture.
- Out of scope: net-new product features, non-agent route changes, and legacy-route decommission execution.

Remediation-scope precedence:
1. For the 2026-03-20 OpenAI prompt-compiler remediation stream, this SOP maps rollout evidence and closeout to:
   - `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md`
   - `docs/records/evidence/agent-pipeline-remediation/phase-4/`
2. Legacy modularization evidence paths remain valid only for the historical modularization rollout stream.

## Preconditions (must be true before Phase 5 starts)
1. Phase 4 governance checks are in `enforce` mode and green.
2. Required checks remain passing on the rollout commit SHA.
3. Branch/ruleset evidence is refreshed in `docs/planning/evidence/docs/`.
4. `DEP-03` dashboard/alert wiring is marked ready in the tracker, or a formal DEP-03 waiver is active with compensating controls.
5. Incident packet template and rollback drill template are prepared.

## Ring Execution Order
1. Staging soak 24h.
2. Production 5% for 24h.
3. Production 25% for 24h.
4. Production 50% for 24h.
5. Production 100% only after all promotion gates pass.

Rule: only one active canary for this subsystem at a time.

Pre-user MVP exception:
If there is no external production traffic cohort yet, production rings may be formally waived with an evidence artifact. This is a temporary exception and ring progression must resume before/at first user onboarding.

## Promotion Gates (all required per ring)
1. p95/p99/5xx/timeout/refusal metrics stay within plan budgets.
2. No open Sev-1 or Sev-2 defects attributed to agent changes.
3. Contract, disable-path, and continuity suites remain green.
4. No doc/runtime/schema drift failures.
5. Rollback path for current ring is verified and documented.
6. If DEP-03 waiver is active, manual compensating-control evidence is attached for the ring.

Compiler-native threshold binding (mandatory for remediation lanes):
1. Use `docs/planning/ai-studio-agent-pipeline-regression-threshold-contract-2026-03-20.md` as the only numeric source of truth.
2. Promotion/hold/rollback decisions must evaluate:
   - `schema_failure_rate` delta
   - `fallback_rate` delta
   - `false_refusal_rate` delta
   - `repair_rate` delta
   - `p95_latency_ms` delta
   - `error_rate` absolute
3. If any rollback threshold is breached, rollback is immediate and ring promotion is blocked.
4. Hold-level breaches require hold-and-observe behavior; no ad hoc promotion overrides.

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

## Rollback Drill Checklist (Required Before Ring Promotion)
Execute and attach a rollback drill packet before advancing rings for remediation scope.

Checklist:
1. Confirm current ring baseline snapshot is archived (metrics + active flags + runtime scope key lineage).
2. Trigger rollback lever sequence in staging:
   - `STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED=true`
   - if needed, `STUDIO_AGENT_SINGLE_STAGE_ENABLED=false`
3. Verify contracts after rollback:
   - `Agent-Contract-Version` unchanged
   - refusal/fallback reason-code contract unchanged
   - canonical continuity guard behavior unchanged
4. Run required validation bundle:
   - `npm -C frontend run test -- tests/api/studio-agent.runtime.test.ts`
   - `npm -C frontend run test -- tests/api/agent-route-outcome-parity.test.ts`
   - `npm -C frontend run audit:staging:openai-lanes:strict:lineage -- --samples 10 --concurrency 1 --request-timeout-ms 60000`
   - `npm -C frontend run audit:staging:openai-lanes:strict -- --samples 10 --concurrency 1 --request-timeout-ms 60000`
   - `npm -C frontend run docs:check`
5. Record rollback drill outcome with:
   - timestamps,
   - operator,
   - command transcript summary,
   - pass/fail and follow-up actions.

## Prompt-Only Runtime Ring Controls
For the prompt-only single-stage release, ring operators must apply flags in this order:

1. Promotion defaults:
   - `STUDIO_AGENT_SINGLE_STAGE_ENABLED=true`
   - `STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED=false`
2. First rollback lever (no contract change):
   - set `STUDIO_AGENT_LEGACY_V2_FALLBACK_ENABLED=true`
3. Second rollback lever:
   - set `STUDIO_AGENT_SINGLE_STAGE_ENABLED=false`
4. Preserve external contract:
   - keep `Agent-Contract-Version: 1`
   - do not alter response envelope during ring mitigation

## Required Evidence Per Ring
1. Rollout report entry with metrics and decision.
2. Dashboard screenshots/links for latency, error/timeout, refusal delta, continuity.
3. CI links for required checks on the deployed SHA.
4. Incident packet if freeze/rollback occurs.
5. Staging soak checkpoints recorded in checkpoint log before 5% promotion decision.
6. 5% promotion decision packet completed at soak exit.
7. If dashboard/alert links are unavailable due tooling constraints, include a waiver artifact with explicit compensating controls and approval context.

For remediation rollout operations, store evidence under `docs/records/evidence/agent-pipeline-remediation/phase-4/`.

### Optional Automation: Gate Snapshot Generator
Use the snapshot generator to standardize ring evidence blocks and gate decisions from structured input.

Template pack (remediation):
- `docs/records/evidence/agent-pipeline-remediation/phase-4/rollout-checklist-template.md`
- `docs/records/evidence/agent-pipeline-remediation/phase-4/ring-decision-log-template.md`
- `docs/records/evidence/agent-pipeline-remediation/phase-4/stabilization-window-report-template.md`

Command examples:
```bash
node scripts/generate_phase5_rollout_snapshot.js \
  --input <legacy-phase5-snapshot-input.json>
```

Append output to active report:
```bash
node scripts/generate_phase5_rollout_snapshot.js \
  --input <ring-metrics.json> \
  --append-to <legacy-phase5-rollout-report.md>
```

CI/automation mode (fails on freeze decision):
```bash
node scripts/generate_phase5_rollout_snapshot.js \
  --input <ring-metrics.json> \
  --fail-on-freeze
```

## Post-Ring Close Checklist
1. Record pass/fail decision and approver in rollout report.
2. Update remediation tracker phase closeout status and evidence links in `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md` (`PX-04` for Phase 4 closeout).
3. Confirm next ring start time and owner handoff.
4. Re-validate alert routing/on-call coverage before promotion.
5. For each ring promotion transition, ensure:
   - `docs/records/evidence/agent-pipeline-remediation/phase-4/rollout-checklist-template.md` is instantiated and updated for the current window.
   - `docs/records/evidence/agent-pipeline-remediation/phase-4/ring-decision-log-template.md` is instantiated and updated with promote/hold/rollback decision evidence.
6. If DEP-03 waiver is active, ensure waiver evidence is linked in the rollout report and decision packet.
