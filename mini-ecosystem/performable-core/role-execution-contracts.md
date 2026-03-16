# Role Execution Contracts (Future Agent-Ready)

Purpose: define deterministic execution contracts for each professional role.

Status: Inactive specification.

## Shared role contract format
Every role output must include:
1. `input_ack` (what was received)
2. `checks_run` (what was evaluated)
3. `findings` (canonical schema)
4. `gate_recommendation` (`PASS|HOLD|FAIL`)
5. `handoff_packet` (to next role)

## Product contract
- Required inputs: request, goals, constraints.
- Mandatory checks: scope clarity, acceptance criteria testability, dependency identification.
- Can block: Gate A.
- Required output: intake packet + Gate A decision packet.

## Engineer contract
- Required inputs: approved intake packet.
- Mandatory checks: implementation completeness, validation notes, change-risk declaration.
- Can block: Gate B.
- Required output: implementation packet + handoff to senior engineer.

## Senior Engineer contract
- Required inputs: implementation packet + review context.
- Mandatory checks: correctness, maintainability, regression risk, architecture fit.
- Can block: Gate C.
- Required output: review findings + Gate C decision packet.

## QA contract
- Required inputs: merge candidate + acceptance criteria.
- Mandatory checks: critical-path behavior, regression-sensitive paths, defect severity classification.
- Can block: Gate D.
- Required output: QA findings + release-readiness recommendation.

## Platform/Release contract
- Required inputs: QA + design + security outcomes.
- Mandatory checks: rollout strategy, rollback trigger/path, observation plan.
- Can block: Gate D and Gate E.
- Required output: rollout decision packet + post-release closure packet.

## Security contract
- Required inputs: scope + changed surfaces + trust boundaries.
- Mandatory checks: auth, data isolation, secret handling, risk exposure.
- Can block: any gate.
- Required output: security findings + explicit block/no-block rationale.

## Product Design contract
- Required inputs: user flow intent + staging behavior.
- Mandatory checks: UX coherence, accessibility blockers, interaction consistency.
- Can block: Gate D for severe UX/accessibility failure.
- Required output: design findings + release recommendation.

## Enforcement rule
If a role omits required output sections, the handoff is invalid and gate status is `HOLD`.
