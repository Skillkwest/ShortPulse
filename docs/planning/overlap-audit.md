# Overlap And Conflict Audit

Date: 2026-02-20
Status: complete
Authority: Working
Owner: Engineering

## Risk register

| Risk ID | Category | Description | Affected plans | Severity | Resolution | Impact |
| --- | --- | --- | --- | --- | --- | --- |
| R-001 | Migration ordering | Multiple plans touch conversation-state hardening and can diverge | FP, DG, DM | High | Lock `028` as sole forward hardening migration; no edits to `018` | Prevents schema drift and rollback ambiguity |
| R-002 | TTL/cap mismatch | Proposed caps conflict (`200` vs `1000`) | FP, DG, DM | High | Lock cap max at `200` in SQL and docs | Prevents runtime/doc inconsistency |
| R-003 | Function privilege scope | RPC execute grant broader than runtime need | FP, DG | High | Restrict execute grant to `service_role`; revoke `authenticated` | Reduces abuse/call surface |
| R-004 | Non-deterministic retention | Timestamp ties may evict unintended rows | FP, DG, DM | High | Deterministic ordering with tie-breaker and current-conversation keep rule | Predictable retention behavior |
| R-005 | CI check naming collisions | New jobs may collide with existing required checks | FP, DG, DM | Medium | Register canonical job names before wiring protection rules | Avoids blocked merges |
| R-006 | Route/auth contract drift | Runtime guard behavior and docs list can diverge | FP, DG | Medium | Runtime source of truth: `frontend/lib/authGuard.ts` + `_app.tsx` prefix semantics | Avoids false security assumptions |
| R-007 | KEI sequencing risk | Deleting KEI tests before replacement coverage | KR | High | Require replacement suites before deletion phase | Avoids auth/ownership regressions |
| R-008 | Archive policy mismatch | New planning archive path conflicts with docs archive policy | DG, FP | Medium | Controlled exception for `docs/planning/archive/original-plans/` | Preserves verbatim plan evidence |
| R-009 | Enforcement timing risk | Enforcing drift checks before compatibility windows close | KR, DG, DM | High | Warn/evaluate first; enforce after gates + two green cycles | Prevents rollout breakage |

## Locked conflict resolutions

1. Retention cap max is `200` (not `1000`).
2. Route protection parity uses prefix runtime behavior, not exact string matching only.
3. KEI routes remain `410` tombstones during compatibility hold.
4. CI required-check names are immutable once protection rules are bound.
5. `docs/planning/archive/original-plans/` is a controlled exception for verbatim source preservation.

## Traceability

- Source mapping: `docs/planning/_inventory.md`
- Feasibility dependencies: `docs/planning/feasibility-report.md`
- Stage execution contracts: `docs/planning/stages/stage-*.md`
