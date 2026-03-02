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
20. `2026-03-01-phase-11-slice-b-provider-header-contract-centralization.md` - centralizes provider header boolean parsing and decouples Kie status contracts from submit-contract module dependencies.
21. `2026-03-01-phase-11-slice-b-kie-model-id-runtime-canonicalization.md` - promotes Kie model ids into model-runtime canonical constants and rewires catalog/registry + provider-integration re-exports to remove cross-layer literal drift.
22. `2026-03-01-phase-11-slice-b-kie-canonical-id-parity-guard.md` - enforces canonical Kie model-id parity across runtime constants, model catalog provider classification, and API-doc mapping checks.
23. `2026-03-01-phase-11-slice-b-kie-registry-canonical-id-parity-guard.md` - extends canonical Kie model-id parity checks to model registry entries so runtime catalog/registry/docs stay in lockstep.
24. `2026-03-01-phase-11-slice-b-runtime-model-surface-parity-guard.md` - enforces full runtime model surface parity between catalog and registry (model presence + provider classification) for all providers.
25. `2026-03-01-phase-11-slice-b-provider-source-provenance-parity-guard.md` - enforces provider source-url host provenance parity (`fal`/`kie`/`openai`) in model-catalog governance checks.
26. `2026-03-01-phase-11-slice-b-kie-allowlist-normalization-and-validation.md` - enforces normalized + validated Kie allowlist entry parsing in runtime config to fail closed on invalid/non-Kie patterns.
27. `2026-03-01-phase-11-slice-b-model-contract-completeness-parity-guard.md` - enforces model-contract completeness checks (aspect/duration defaults + required Kie contract fields) in model-catalog governance.
28. `2026-03-01-phase-11-slice-b-kie-primary-source-contract-capture-and-alignment.md` - captures Veo/Kling primary-source contract details and aligns Kie dark-path submit/status/media adapters with documented request/callback shapes.
29. `2026-03-01-phase-11-slice-b-kie-callback-code-and-aspect-alias-alignment.md` - aligns remaining Kie doc-shape deltas (`aspectRatio` submit alias and callback `code` lifecycle fallback mapping).
30. `2026-03-01-phase-11-slice-b-kie-primary-source-fixture-regression-lock.md` - adds shared primary-source-shaped Veo/Kling fixtures and fixture-backed contract tests to lock request/callback behavior against drift.
31. `2026-03-01-phase-11-slice-b-kie-status-url-template-dispatch.md` - adds `{requestId}` query-template support for Kie status/detail polling URLs while preserving Fal dispatch behavior and trusted-host fail-closed checks.
32. `2026-03-01-phase-11-slice-b-kie-model-catalog-topology-defaults.md` - moves Kie submit/status topology defaults into model-catalog contracts (env remains override), with parity checks and mixed-provider regression coverage.
33. `2026-03-01-phase-11-slice-b-kie-record-info-envelope-regression-lock.md` - extends Kie status/result parsing coverage for nested record-info envelope shapes and locks fixture-backed behavior for lifecycle, response URL, retry-code, and media URL extraction.
34. `2026-03-01-phase-11-slice-b-kie-envelope-normalizer-canonicalization.md` - adds a shared Kie envelope normalizer so status/recovery parsing consumes canonical lifecycle/response/result shape before validation and policy decisions.
35. `2026-03-01-phase-11-slice-b-kie-recovery-probe-envelope-consumption-lock.md` - adds recovery-probe integration coverage that verifies nested Kie record-info envelopes are normalized and converged to completed/media outcomes.
36. `2026-03-01-phase-11-slice-b-kie-submit-transport-logical-status-normalization.md` - adds Kie submit transport normalization so HTTP `200` responses with non-success body `code` values are treated as logical upstream failures/retry candidates for deterministic fallback behavior.

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
