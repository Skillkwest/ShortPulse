# Agent Pipeline Remediation Evidence

Purpose: canonical evidence namespace for the 2026-03-20 AI Studio agent pipeline regression remediation program.

Program docs:
1. `docs/planning/ai-studio-agent-pipeline-regression-remediation-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md`
3. `docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-execution-plan-2026-03-20.md`
4. `docs/planning/ai-studio-agent-pipeline-regression-phase-2-openai-execution-plan-2026-03-20.md`
5. `docs/planning/ai-studio-agent-pipeline-regression-phase-3-openai-execution-plan-2026-03-20.md`
6. `docs/planning/ai-studio-agent-pipeline-regression-phase-4-openai-execution-plan-2026-03-20.md`
7. `docs/planning/ai-studio-agent-pipeline-regression-threshold-contract-2026-03-20.md`
8. `docs/planning/ai-studio-agent-pipeline-regression-authority-precedence-addendum-2026-03-20.md`
9. `docs/planning/ai-studio-agent-pipeline-regression-tracker-gate-clarification-2026-03-20.md`
10. `docs/planning/ai-studio-agent-pipeline-regression-environment-label-normalization-2026-03-20.md`
11. `docs/planning/ai-studio-agent-pipeline-regression-supporting-docs-plan-2026-03-20.md`

Scope lock:
1. Master planning evidence in `master/` remains authoritative for gate approvals.
2. Any phase execution evidence remains OpenAI-only (`studio-agent`, `generate-prompt`, `describe-image`) unless scope is explicitly amended.
3. `fal-submit` implementation evidence is out of scope for the current baseline.

Scope amendment record:
1. 2026-03-20 Phase 2 amendment: limited shared precheck parity updates touched Fal submit precheck wiring/tests without provider migration or payload-contract changes.
2. Amendment evidence packet: `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-precheck-scope-parity-progress.md`.
3. Follow-up continuity packet: `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-continuity-guard-validation.md`.
4. Follow-up quality/refusal + runtime-truth local baseline packet: `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-quality-refusal-and-runtime-truth-local-baseline.md`.
5. Staging runtime-truth packet: `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-runtime-truth-staging-packet.md`.
6. Golden quality + false-refusal comparative report: `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-golden-quality-false-refusal-comparative-report.md`.
7. Phase 2 closeout packet (staging scope): `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-closeout-packet-staging-scope.md`.
8. Phase 3 telemetry parity packet: `docs/planning/evidence/agent-pipeline-remediation/phase-3/2026-03-20-phase-3-runtime-scope-telemetry-parity-generate-describe.md`.

## Expected Phase Folders
1. `master/` for workstream-level architecture, policy, and governance gate evidence.
2. `phase-1/` for Stability + Policy Parity evidence packets.
3. `phase-2/` for Prompt Quality + Continuity Hardening evidence packets.
4. `phase-3/` for Operational Hardening + Rollout Guardrails evidence packets.
5. `phase-4/` for Controlled Production Activation + Program Closeout evidence packets.

## Evidence Packet Minimums
1. Date and commit SHA.
2. Environment profile snapshot (`local`/`preview`/`production` as applicable).
3. Validation commands and outcomes.
4. Route/telemetry screenshots or trace excerpts for claimed fixes.
5. Explicit pass/fail against phase exit criteria.
6. If using `internal` ring labels, include mapping note per environment normalization doc.
