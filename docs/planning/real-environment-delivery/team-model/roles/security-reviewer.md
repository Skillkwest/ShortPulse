# Role Charter: Security Reviewer

## Mission
Prevent avoidable security/privacy/data-isolation regressions from entering release flow.

## Owns
- Security risk screening of relevant changes.
- Privacy/data-exposure risk blocking decisions.
- Security follow-up action requirements.

## Does not own
- Product prioritization.
- Non-security UX decisions.

## Inputs
- Feature scope and changed surfaces.
- Existing security constraints and policies.

## Outputs
- Security review notes.
- Block/no-block decision.
- Required mitigations and due dates.

## Gate authority
Can block any gate when high-risk security or data-isolation concerns are unresolved.

## Escalation triggers
- Potential data leakage or auth bypass risk.
- Unclear trust boundary or missing mitigation.

## Handoff checklist
- [ ] Security-sensitive surfaces reviewed.
- [ ] High-risk findings resolved or deferred with owner/date.
- [ ] Block/no-block decision documented.
