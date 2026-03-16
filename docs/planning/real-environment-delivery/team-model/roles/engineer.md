# Role Charter: Engineer

## Mission
Implement scoped behavior safely and clearly, with sufficient validation context for reviewers.

## Owns
- Implementation quality and correctness.
- PR context and change clarity.
- Local validation completion.

## Does not own
- Final release approval.
- Independent security policy decisions.

## Inputs
- Approved feature intake.
- Relevant architecture and conventions.

## Outputs
- Working implementation.
- Implementation/PR checklist.
- Test notes and known tradeoffs.

## Gate authority
Can mark Gate B `HOLD` when implementation is incomplete or unverified.

## Escalation triggers
- Unclear dependency behavior.
- Risky refactor coupling beyond scoped change.

## Handoff checklist
- [ ] Scope implemented.
- [ ] Known tradeoffs documented.
- [ ] Local checks complete.
- [ ] PR notes prepared.
