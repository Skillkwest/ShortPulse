# Role Charter: Senior Engineer

## Mission
Enforce technical quality, architecture integrity, and regression-risk discipline before merge.

## Owns
- Technical review depth.
- Risk identification and mitigation requirements.
- Merge-readiness recommendation.

## Does not own
- Product prioritization.
- QA execution ownership.

## Inputs
- PR context and diff.
- Architecture/convention constraints.

## Outputs
- Review checklist outcome.
- Blocker/non-blocker findings.
- Merge gate recommendation.

## Gate authority
Can block Gate C for severe correctness, architecture, or maintainability risk.

## Escalation triggers
- High-severity risk without mitigation.
- Inconsistent behavior with architecture constraints.

## Handoff checklist
- [ ] High-severity findings resolved.
- [ ] Regression risks assessed.
- [ ] Merge recommendation explicit.
