# Unified Buildout Phase 11 Evidence

Add run logs, research notes, rollout observations, rollback notes, and signoff references for phase 11.

## Evidence Inventory
1. `2026-02-27-phase-11-slice-a-shadow-canary-readiness-and-threshold-template.md` - pre-cutover checklist with simple threshold definitions, observation windows, and go/hold/rollback decision template.
2. `2026-02-27-phase-11-baseline-capture-window-0.md` - baseline gate-summary capture from `check_phase11_shadow_canary_metrics.sql` before shadow/canary windows.
3. `2026-02-27-phase-11-shadow-window-1-live-log.md` - active shadow-window execution log with UTC schedule and pending checkpoint capture.
4. `2026-03-01-phase-11-canary-window-1-live-log.md` - canary window 1 execution log template with checkpoint packet.
5. `2026-03-02-phase-11-canary-window-2-live-log.md` - canary window 2 execution log template with checkpoint packet.
6. `2026-02-27-phase-11-slice-b-provider-canonical-request-identity.md` - provider-neutral payload identity extraction (request/event/status aliases) wired into Fal submit/webhook paths with targeted regression tests.
7. `2026-03-01-phase-11-slice-b-kie-model-contract-dark-scaffold.md` - dark-path Kie model metadata scaffolding + fail-closed allowlist guard update with no public route/cutover enablement.
8. `2026-03-01-phase-11-slice-b-kie-selector-fail-closed-guard.md` - AI Studio model-selection fail-closed guard that excludes Kie provider options by default, with regression coverage.
9. `2026-03-01-phase-11-slice-b-kie-model-contract-execution-boundary.md` - provider-integration Kie model-contract payload boundary with fail-closed unsupported-model enforcement and dispatcher wiring.
10. `2026-03-01-phase-11-slice-b-kie-status-result-contract-boundary.md` - provider-integration Kie status/result contract boundary with shared payload/policy delegation and focused unit coverage.
11. `2026-03-01-phase-11-slice-b-kie-result-media-normalization-boundary.md` - provider/model-aware media URL normalization boundary for Kie result payloads, reused by recovery and webhook paths.
12. `2026-03-01-phase-11-slice-b-kie-topology-model-gating-and-queue-resolution.md` - model-aware Kie status/response topology fail-closed enforcement and deterministic queued submit target-resolution error classification with mixed-provider queue coverage.
13. `2026-03-01-phase-11-slice-b-kie-submit-contract-constraint-enforcement.md` - stricter Kie submit contract enforcement for allowed aspect/duration/resolution fields and optional field typing with focused constraint coverage.
14. `2026-03-01-phase-11-slice-b-kie-status-result-shape-validation.md` - model-aware Kie status/result payload shape validation with fail-closed malformed-field and unsupported-model handling.
15. `2026-03-01-phase-11-slice-b-kie-retry-policy-payload-aware-mapping.md` - payload-aware Kie transient retry mapping in shared status policy with strict no-retry header precedence.
16. `2026-03-01-phase-11-slice-b-mixed-provider-recovery-convergence-tests.md` - mixed-provider recovery runtime/execution coverage for Kie media convergence and running-state retry queue transitions.
17. `2026-03-01-phase-11-slice-b-regression-gate-coverage-expansion.md` - expands canonical Phase 11 Fal regression gate script coverage to include queue dispatch integrity and mixed-provider recovery execution/runtime suites.
18. `2026-03-01-phase-11-slice-b-kie-model-catalog-contract-drift-lock.md` - removes duplicated Kie submit constraints in provider integration and sources them from canonical model catalog contracts with fail-closed guards.
19. `2026-03-01-phase-11-slice-b-kie-model-id-contract-centralization.md` - centralizes Kie model-id constants across provider-integration contract boundaries to prevent cross-module drift.

## Supporting Command Packets
1. `sql/check_phase11_shadow_canary_metrics.sql` - read-only baseline/canary metrics capture queries that map directly to the Phase 11 evidence template.
2. `sql/check_phase11_shadow_canary_gate_summary_windowed.sql` - explicit UTC windowed one-row gate query for checkpoint runs (avoid accidental rolling-window samples).
3. `npm -C frontend run test:phase11:fal-regression` - canonical Fal no-regression test gate to run before each shadow/canary checkpoint decision.
4. `bash scripts/phase11_shadow_checkpoint_gate.sh --quick` - checkpoint helper that runs the no-regression gate and prints the required SQL/evidence handoff steps (`--full` runs full validation).
5. `npm -C frontend run phase11:window-guard -- --window canary-1` - blocks early/invalid checkpoint runs until scheduled UTC checkpoint closure (use `--mode full` for full local validation and `--gate-file` to auto-evaluate SQL output).
6. `npm -C frontend run phase11:gate-eval -- --window shadow-1 --file <gate-summary.json>` - evaluates section `G` output into a deterministic pass/hold packet with `N/A` handling for `recovery_success_sample_size = 0`.

## Decisioning Rule
1. Use `sql/check_phase11_shadow_canary_gate_summary_windowed.sql` for checkpoint decisions.
2. Treat rolling `now() - interval '24 hours'` SQL output as observational only (non-decisioning) during scheduled windows.
3. Current deferred checkpoints:
   - Canary 1 decision is valid at/after `2026-03-02 18:46:07 UTC`.
   - Canary 2 decision is valid at/after `2026-03-03 18:46:07 UTC`.
