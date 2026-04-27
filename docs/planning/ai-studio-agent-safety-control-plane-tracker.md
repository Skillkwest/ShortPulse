# AI Studio Agent Safety Control Plane Tracker

Date: 2026-03-02  
Authority: Working  
Owner: Engineering  
Program Doc: `docs/planning/ai-studio-agent-safety-control-plane-plan.md`
Status: active

## Status Overview
| Phase | Status | Owner | Entry Gate | Exit Gate | Evidence |
| --- | --- | --- | --- | --- | --- |
| F0: Docs + Contract Lock | Completed | Engineering | Phase 13 Wave F pending + RCP-3 required | Plan/tracker/ADR published and indexed | `docs/planning/evidence/unified-buildout/phase-13/` |
| F1: Runtime Policy Core | Completed | AI Platform | F0 complete | Policy engine integrated + contract tests green | `docs/planning/evidence/unified-buildout/phase-13/` |
| F2: Modality Wiring | Completed | Frontend + AI Platform | F1 complete | Text/image/video policy wiring validated | `docs/planning/evidence/unified-buildout/phase-13/` |
| F3: Persistence + Admin Operations | Completed | Platform | F2 complete | Migrations + admin APIs + security checks green | `docs/planning/evidence/unified-buildout/phase-13/` |
| F4: Observability + Auto-Rollback | In Progress | Platform + Ops | F3 implementation landed | Incident rollback/cooldown path verified in integrated runtime + rollout window | `docs/planning/evidence/unified-buildout/phase-13/` |
| F5: Validation + Rollout | Planned | Platform + Ops | F4 complete | Promotion gates + rollback drill evidence green | `docs/planning/evidence/unified-buildout/phase-13/` |

## Current Gate Notes
1. RCP-3 completed on 2026-03-02.
2. Wave F Pass 1 runtime policy core is completed and evidenced.
3. Wave F Pass 2 modality wiring is completed and evidenced.
4. Wave F Pass 3 implementation slice (migrations + admin APIs) is landed and validated in code/test/doc gates.
5. Wave F Pass 4 implementation slice is landed: structured telemetry fields + hard-floor incident auto-rollback gating are wired in `studio-agent` and `describe-image` runtime paths.
6. Operational SQL apply evidence is now green in target environment:
   - `check_agent_safety_policy_control_plane.sql` => `7/7/0`
   - `check_runtime_sql_security_audit.sql` => `120/120/0`
7. Wave F Pass 4 telemetry-version alignment is landed:
   - `studio-agent` coordinator now emits control-plane/runtime-resolved `policyVersion` values (with fallback),
   - regression coverage locks telemetry parity for non-suffixed profile IDs.
8. Wave F Pass 5 local integrated validation window 1 is green:
   - combined safety runtime/admin/API regression suite passed (`67/67`),
   - local lint/type-check/build/docs gates passed.
9. Staging SQL hard-gate revalidation is green (operator-executed):
   - `check_agent_safety_policy_control_plane.sql` => `7/7/0`
   - `check_runtime_sql_security_audit.sql` => `120/120/0`
10. Wave F Pass 6 SQL control-plane observation window 1 is green (operator-executed):
   - `activate_agent_safety_policy(...)` returned `cooldown_blocked` while cooldown was active,
   - `rollback_agent_safety_policy(...)` returned `already_safe` on `prod_safe_v1`,
   - post-call `get_active_agent_safety_policy()` snapshot remained consistent with expected safe profile/version payload.
11. Admin API observation window remains open due deployment drift:
   - current staging alias (`shortpulse-git-staging-preview-kirk-artmans-projects.vercel.app`) resolves to deployment commit `d8020d6bad40884aebab20a2f9096cad73be1ead` (`2026-02-27T00:23:54.852Z`),
   - SQL control-plane functions are present in target DB, but route-level probe of `/api/admin/agent-safety-policy/active` on that deployment returns app-lane `404` after bearer auth (endpoint not present in deployed bundle).
12. RCP-4 remains pending and is tracked under Wave H canary promotion gates.
13. Deferment lock (2026-03-03):
   - Remaining Wave F staging-route checks and promote/hold windows are intentionally deferred to a later operator window.
   - Deferred scope is limited to: staging alias parity probe rerun, staging manual route matrix, and staging promotion/rollback decision packet.
   - Implementation/code gates are complete for this slice; deferment is operational scheduling, not a code-readiness blocker.

## Execution Checklist
### F0: Docs + Contract Lock
- [x] Create safety control plane plan doc.
- [x] Create safety control plane tracker doc.
- [x] Create ADR for modality profiles + rollback/cooldown policy.
- [x] Update canonical phase-13 governance docs for RCP-3 completion.

### F1: Runtime Policy Core
- [x] Add policy type/catalog modules.
- [x] Add policy decision engine.
- [x] Integrate into studio agent coordinator + legacy describe safety path.
- [x] Add unit tests for action mapping + hard-floor invariants.

### F2: Modality Wiring
- [x] Wire policy decisions into text/image/video safety submission seams.
- [x] Remove replaced hardcoded policy branches.
- [x] Add modality independence regression tests.

### F3: Persistence + Admin Operations
- [x] Add migration `047_*` policy persistence schema.
- [x] Add migration `048_*` grants/audit parity.
- [x] Add admin active/activate/rollback APIs.
- [x] Add API auth/cooldown/validation tests.

### F4: Observability + Auto-Rollback
- [x] Add required telemetry fields for safety policy decisions.
- [x] Implement hard-floor incident rollback automation.
- [x] Implement and test cooldown enforcement.

### F5: Validation + Rollout
- [x] Run local integrated validation window 1.
- [ ] Run staging shadow validation. (Deferred 2026-03-03: await staging deployment parity window)
- [ ] Collect promotion/hold evidence windows. (Deferred 2026-03-03: coupled to staging shadow validation)
- [ ] Execute rollback drill and archive evidence. (Deferred 2026-03-03: execute in same operator window as staging checks)

## Required Validation Commands (per implementation slice)
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. Slice-specific unit/integration tests for touched policy modules/routes.
6. SQL checks for migration/grant/audit slices.

## Risks and Mitigations
1. Risk: provider error-shape drift.
   - Mitigation: provider parse layers remain isolated; normalized contract tests stay required.
2. Risk: production safety leakage through verbatim payloads.
   - Mitigation: default production-normalized mode + explicit debug-mode gating.
3. Risk: aggressive rollback loops.
   - Mitigation: cooldown lock + auditable policy events.
