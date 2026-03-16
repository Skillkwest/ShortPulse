# Generation Pipeline Hardening Contact Map (2026-03-16)

Last updated: 2026-03-16  
Status: Active  
Source of truth: `docs/operator-map.md`

## Purpose
Define the required owner/escalation contacts for this separate track so failures can be triaged without ambiguity.

## Named Owner Baseline
Current operating model is single-owner. Until delegation is explicitly published in `docs/operator-map.md`, all primary and backup ownership remains:
- `owner_id`: `owner_worldbuilder`
- `name`: `worldbuilder`
- `role`: Platform owner and operator

## Track Contact Matrix
| Contact Domain | system_id (operator map) | Primary owner | Backup owner | Primary runbook |
| --- | --- | --- | --- | --- |
| Submit queue, dispatch, recovery loop | `generation_submit_queue_recovery` | worldbuilder | worldbuilder | `docs/sops/sop_generation_recovery_diagnostics.md` |
| Webhook ingestion and shared recovery execution | `fal_webhook_shared_recovery_execution` | worldbuilder | worldbuilder | `docs/sops/sop_provider_incident_response.md` |
| Credits reservation/capture/release settlement | `credits_reservation_settlement` | worldbuilder | worldbuilder | `docs/sops/sop_billing_credits_operations.md` |
| Incident ingestion and admin triage | `admin_incident_ingestion_triage` | worldbuilder | worldbuilder | `docs/monitoring.md` |
| Security/auth/RLS/storage guardrails | `security_boundary_auth_rls_storage` | worldbuilder | worldbuilder | `docs/security-checklist.md` |
| Deployment parity and scheduler controls | `deployment_route_parity_scheduler_controls` | worldbuilder | worldbuilder | `docs/deployment.md` |

## Required Escalation Packet
For every `Blocked` or incident slice, attach:
1. `Slice ID` and commit/PR link.
2. Error code and first-seen timestamp (UTC).
3. Affected model family and route(s).
4. Evidence links (test output, route logs/telemetry, SQL diagnostics if relevant).
5. Immediate rollback posture and trigger threshold.
6. Owner acknowledgment and next checkpoint time.

## Maintenance Rules
1. If ownership changes, update `docs/operator-map.md` first, then this contact map in the same PR.
2. New generation-pipeline failure codes must be reflected in the relevant SOP triage sections.
3. No placeholder or unassigned owner rows are allowed for active track slices.
