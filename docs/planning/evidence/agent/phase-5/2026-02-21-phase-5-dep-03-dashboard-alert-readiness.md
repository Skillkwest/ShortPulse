# Phase 5 Evidence: DEP-03 Dashboard And Alert Readiness

Date: 2026-02-21  
Program: AI Studio Agent Hardening + Modularization  
Phase: 5 (Progressive Rollout)

## Scope
Verify repo-level readiness for `DEP-03` (dashboard + alert wiring for ring-gate promotion) and document operator actions required outside the repo.

## Source Verification
1. Agent telemetry emission is implemented with flow/path/status/model/retry/latency payloads:
   - `frontend/features/agent-runtime/studioAgentRouteOutcomes.ts`
2. Route-level trace/session and stage-latency collection is implemented:
   - `frontend/pages/api/ai/studio-agent.ts`
   - `frontend/features/agent-runtime/studioAgentRouteEnvelope.ts`
3. Admin incident/event APIs expose threshold-based breach signals and server env thresholds:
   - `frontend/pages/api/admin/error-events.ts`
   - `docs/monitoring.md`

## Required Panel Mapping (Program -> Source)
1. Latency by stage + flow:
   - Source: `[studio-agent][telemetry]` log payload (`latency_ms_total`, `latency_ms_stage`, `flow`, `path`).
2. Error + timeout rates by ring:
   - Source: `/api/admin/error-events` and `app_error_events` scoped to `/api/ai/studio-agent` plus timeout patterns.
3. Refusal-rate delta vs baseline:
   - Source: telemetry `status=refuse` ratio vs pre-rollout baseline window.
4. Contract rejection rate by reason:
   - Source: studio-agent contract guard failures + structured error codes from route envelope/guards.
5. Continuity success rate:
   - Source: continuity test suite signal + staging ring runtime checks tied to `clientSessionKey` continuity behavior.

## Alert Baseline
1. Existing threshold env vars are documented and wired for admin event spikes:
   - `SHORTPULSE_ADMIN_ALERT_TOTAL_15M`
   - `SHORTPULSE_ADMIN_ALERT_HIGH_15M`
   - `SHORTPULSE_ADMIN_ALERT_GENERATION_15M`
2. Phase-5 freeze thresholds remain governed by:
   - `docs/planning/ai-studio-agent-modularization-program.md` (Section: Performance/Reliability budgets + freeze rules).
3. Incident response runbook source:
   - `docs/sops/sop_provider_incident_response.md`

## Validation Snapshot
1. CI guardrails on rollout commit SHA `415b8b74c1ee142774452f4a6b38281ae00024d1`:
   - `22258999203` final status `success`.
2. Transient runner/network flake observed during first attempt on same run:
   - `agent_disable_continuity` `npm ci` failed on Supabase CLI checksum fetch (`502`).
   - Failed-job rerun completed green; no code regression indicated.

## DEP-03 Status
`In Progress`:
1. Repo-level instrumentation and runbook wiring are ready.
2. External dashboard/alert resource provisioning remains an operator task outside this repository and must be linked in rollout evidence before 5% production ring promotion.

## External Artifacts Required Before 5% Promotion
The following must be attached to this file before advancing beyond staging soak:

1. Dashboard links:
   - [ ] Latency by stage + flow panel URL.
   - [ ] Error + timeout by ring panel URL.
   - [ ] Refusal-rate delta versus baseline panel URL.
   - [ ] Contract rejection rate by reason panel URL.
   - [ ] Continuity success-rate panel URL.
2. Alert routing links:
   - [ ] Sev-2 latency/error/timeout policy URL.
   - [ ] Sev-2 continuity SLI policy URL.
   - [ ] Sev-3 contract-rejection spike policy URL.
   - [ ] On-call escalation target reference URL.
3. Verification metadata:
   - [ ] Validation timestamp (UTC):
   - [ ] Operator:
   - [ ] Reviewer:
   - [ ] Tracker dependency update completed (`DEP-03`):

Promotion gate rule:
Do not start Production 5% ring until every checklist item above is complete and linked.
