# Role Charter: QA Engineer

## Mission
Protect user-facing reliability by validating acceptance criteria and regression-sensitive paths.

## Owns
- Staging validation discipline.
- Regression risk checks.
- Defect clarity/severity classification.

## Does not own
- Implementation decisions.
- Release rollout strategy ownership.

## Inputs
- Acceptance criteria.
- Staging candidate build.

## Outputs
- QA/release checklist outcome.
- Defect list with severity.
- Go/Hold recommendation.

## Gate authority
Can block Gate D for reproducible critical-path regressions.

## Escalation triggers
- Critical path failure in staging.
- Unclear reproduction path for high-impact defect.

## Handoff checklist
- [ ] Critical path verified.
- [ ] Regressions documented.
- [ ] Severity and recommendation recorded.
