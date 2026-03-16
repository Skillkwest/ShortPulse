# Activation Readiness Checklist

Purpose: define strict preconditions before enabling any performable/agent-style execution.

Status: Inactive readiness contract.

## Contract readiness
- [ ] All performable-core docs exist and are internally consistent.
- [ ] Role outputs align to canonical finding and packet schema.
- [ ] Severity taxonomy and gate rules are accepted as authoritative.

## Operational readiness
- [ ] Gate decisions are reproducible from the same input.
- [ ] Escalation rules are clear and conflict-tested.
- [ ] Stop conditions (`HOLD/FAIL`) are unambiguous.

## Safety readiness
- [ ] Security blocker authority is preserved across all modes.
- [ ] Release blocker authority is preserved for Gate D/E.
- [ ] No activation path bypasses rollback requirements.

## Evaluation readiness
- [ ] At least one feature flow packet validates contract completeness end-to-end.
- [ ] At least one codebase audit packet validates multi-role handoffs.
- [ ] Schema conformance checks are documented.

## Activation decision packet (required)
Before turning on execution, capture:
- Activation date/time
- Scope of activation
- Responsible operator
- Rollback-to-inactive conditions
- Initial observation window

## Default policy
If any checklist item is incomplete, system remains inactive.
