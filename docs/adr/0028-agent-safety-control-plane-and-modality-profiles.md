# ADR 0028: Agent Safety Control Plane And Modality Profiles

## Status
Accepted

## Context
AI Studio currently has safety behavior spread across runtime seams (agent coordinator, describe-image path, provider error classification). Phase 13 requires introducing tunable safety knobs without regressions, while keeping production hard-floor protections immutable and auditable.

Key constraints:
1. No broad refactor of AI Studio page orchestration.
2. Provider-specific contracts must remain isolated from user-lane response semantics.
3. Rollback must be policy-plane scoped and operationally fast.
4. Production responses must remain stable and normalized.

## Decision
1. Introduce a dedicated safety control plane with modality-aware policy profiles (text/image/video).
2. Enforce immutable production hard floors ahead of tunable profile decisions.
3. Keep provider parsing separate from policy evaluation and normalize final user-lane outcomes through a shared contract.
4. Add admin-governed policy activation/rollback endpoints with cooldown locking and auditable events.
5. Roll back policy version/state only on incidents (no full runtime shutdown path as default response).

## Consequences
- Positive:
1. Safety tuning becomes controlled, auditable, and reversible.
2. Modality-specific tuning no longer requires scattered changes across runtime branches.
3. Production UX remains stable while preserving deeper diagnostics in development contexts.

- Negative:
1. Introduces additional policy-plane schema and operational surfaces to maintain.
2. Requires strict migration/grant discipline for new admin and runtime policy operations.

- Follow-ups:
1. Implement Wave F phases F1-F5 per `docs/planning/ai-studio-agent-safety-control-plane-plan.md`.
2. Add required policy telemetry and rollback drill evidence to Phase 13 evidence packets.
3. Keep docs/SOP/API references synchronized as each slice lands.

## Alternatives considered
- Option A: Continue with hardcoded per-route safety logic.
  - Rejected: high drift risk and poor operability for rollback/tuning.
- Option B: Allow tunable policy to override all production floors.
  - Rejected: violates minimum safety invariants and incident-response requirements.
