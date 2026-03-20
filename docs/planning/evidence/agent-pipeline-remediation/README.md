# Agent Pipeline Remediation Evidence

Purpose: canonical evidence namespace for the 2026-03-20 AI Studio agent pipeline regression remediation program.

Program docs:
1. `docs/planning/ai-studio-agent-pipeline-regression-remediation-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md`
3. `docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-execution-plan-2026-03-20.md`
4. `docs/planning/ai-studio-agent-pipeline-regression-phase-2-openai-execution-plan-2026-03-20.md`

Scope lock:
1. Phase 1 and Phase 2 evidence are OpenAI-only (`studio-agent`, `generate-prompt`, `describe-image`).
2. `fal-submit` implementation evidence is out of scope for Phases 1-2.

## Expected Phase Folders
1. `phase-1/` for Stability + Policy Parity evidence packets.
2. `phase-2/` for Prompt Quality + Continuity Hardening evidence packets.
3. `phase-3/` for Operational Hardening + Rollout Guardrails evidence packets.

## Evidence Packet Minimums
1. Date and commit SHA.
2. Environment profile snapshot (`local`/`preview`/`production` as applicable).
3. Validation commands and outcomes.
4. Route/telemetry screenshots or trace excerpts for claimed fixes.
5. Explicit pass/fail against phase exit criteria.
